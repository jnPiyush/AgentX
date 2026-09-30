#!/usr/bin/env pwsh
#Requires -Version 7.0

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$modulePath = Join-Path $repoRoot '.frontier\runtime\repository-context.ps1'
$script:passed = 0
$script:failed = 0
$script:skipped = 0
$script:fixtures = [Collections.Generic.List[string]]::new()
$beginMarker = '<!-- frontier:repo-context:begin -->'
$endMarker = '<!-- frontier:repo-context:end -->'
$utf8 = [Text.UTF8Encoding]::new($false)
$gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passed++; Write-Host "[PASS] $Name" }
    else { $script:failed++; Write-Host "[FAIL] $Name" }
}

function Assert-Throws([scriptblock]$Action, [string]$Pattern, [string]$Name) {
    try {
        $null = & $Action
        Assert-True $false "$Name (did not throw)"
    } catch {
        Assert-True ($_.Exception.Message -match $Pattern) "$Name ($($_.Exception.Message))"
    }
}

function Write-Skip([string]$Name) {
    $script:skipped++
    Write-Host "[SKIP] $Name"
}

function New-Fixture([string]$Name) {
    $path = Join-Path ([IO.Path]::GetTempPath()) ("frontier-repo-context-{0}-{1}" -f $Name, [guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($path)
    $script:fixtures.Add($path)
    return $path
}

function Write-Fixture([string]$Root, [string]$Relative, [string]$Text) {
    $path = Join-Path $Root $Relative
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path))
    [IO.File]::WriteAllText($path, $Text, $utf8)
}

function Remove-Fixture([string]$Path) {
    foreach ($entry in [IO.DirectoryInfo]::new($Path).EnumerateFileSystemInfos()) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            if ($entry.Attributes -band [IO.FileAttributes]::Directory) { [IO.Directory]::Delete($entry.FullName) }
            else { [IO.File]::Delete($entry.FullName) }
        } elseif ($entry.Attributes -band [IO.FileAttributes]::Directory) {
            Remove-Fixture $entry.FullName
        } else {
            if ($entry.Attributes -band [IO.FileAttributes]::ReadOnly) { $entry.Attributes = $entry.Attributes -band (-bnot [IO.FileAttributes]::ReadOnly) }
            [IO.File]::Delete($entry.FullName)
        }
    }
    [IO.Directory]::Delete($Path)
}

function Invoke-GitFixture([string]$Root, [string[]]$Arguments) {
    $output = & $gitCommand.Source -C $Root -c core.fsmonitor=false @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Fixture Git failed: $output" }
}

function Read-Graph($Result) {
    return [IO.File]::ReadAllText($Result.graphPath) | ConvertFrom-Json -Depth 32
}

function Get-StateSnapshot($Result) {
    return [pscustomobject]@{
        GraphHash = (Get-FileHash -LiteralPath $Result.graphPath -Algorithm SHA256).Hash
        MapHash = (Get-FileHash -LiteralPath $Result.mapPath -Algorithm SHA256).Hash
        GraphTime = [IO.File]::GetLastWriteTimeUtc($Result.graphPath).Ticks
        MapTime = [IO.File]::GetLastWriteTimeUtc($Result.mapPath).Ticks
    }
}

function Assert-StableState($Before, $After, [string]$Name) {
    Assert-True ($Before.GraphHash -eq $After.GraphHash -and $Before.MapHash -eq $After.MapHash) "$Name preserves artifact bytes"
    Assert-True ($Before.GraphTime -eq $After.GraphTime -and $Before.MapTime -eq $After.MapTime) "$Name preserves artifact modification times"
}

function Invoke-Case([string]$Name, [scriptblock]$Action) {
    try { & $Action }
    catch { Assert-True $false "$Name raised an unexpected error: $($_.Exception.Message) at $($_.ScriptStackTrace)" }
}

try {
    Invoke-Case 'Passive module load' {
        $fixture = New-Fixture 'passive'
        Push-Location -LiteralPath $fixture
        try {
            $beforePreference = $ErrorActionPreference
            $ROOT = 'parent-owned-sentinel'
            $output = @(. $modulePath)
            Assert-True ($output.Count -eq 0) 'dot-sourcing has no output'
            Assert-True (@([IO.Directory]::EnumerateFileSystemEntries($fixture)).Count -eq 0) 'dot-sourcing performs no discovery or writes'
            Assert-True ($ROOT -eq 'parent-owned-sentinel' -and $ErrorActionPreference -eq $beforePreference) 'dot-sourcing does not mutate caller variables'
        } finally { Pop-Location }
    }
    . $modulePath

    Invoke-Case 'Cold and warm graph' {
        $fixture = New-Fixture 'cold-warm'
        Write-Fixture $fixture 'src\main.ts' "import { help } from '../lib/helper';`nexport function start() { return help(); }"
        Write-Fixture $fixture 'lib\helper.ts' 'export function help() { return 42; }'
        Write-Fixture $fixture 'docs\architecture.md' "# Architecture`n[Entry](../src/main.ts)"
        $cold = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query start
        Assert-True ($cold -is [pscustomobject] -and $cold.schemaVersion -eq 1 -and $cold.status -eq 'created') 'cold invocation returns the public result object'
        Assert-True ($cold.fileCount -eq 3 -and $cold.edgeCount -eq 2 -and $cold.sourceReads -eq 3) 'cold graph analyzes exactly three sources and two observed references'
        Assert-True ($cold.changedFiles -eq 3 -and $cold.deletedFiles -eq 0) 'cold change counters describe added records'
        Assert-True ($cold.context -match 'src/main.ts' -and $cold.context -match 'lib/helper.ts' -and $cold.context -match 'architecture.md') 'context includes matching source, neighbor and architecture pointers'
        $graph = Read-Graph $cold
        Assert-True ($graph.root -eq $fixture -and $graph.schemaVersion -eq 1 -and $graph.nodes.Count -eq 3) 'graph has the requested root and file inventory'
        Assert-True (($graph.limits -join ' ') -match 'sourceReads.*extraction opens.*not total I/O' -and
            ($graph.limits -join ' ') -match 'no separate warm source-hashing pass') 'metadata documents extraction counts separately from fingerprint and other I/O work'
        Assert-True (@($graph.edges | Where-Object { $_.from -eq 'src/main.ts' -and $_.to -eq 'lib/helper.ts' -and $_.line -eq 1 }).Count -eq 1) 'import edge is grounded at its actual line'
        $map = [IO.File]::ReadAllText($cold.mapPath)
        Assert-True ($map -match '```mermaid' -and $map -match 'flowchart LR' -and $map -match 'observed references') 'map contains an actual labeled Mermaid graph'
        Assert-True ($map -match 'zero means extraction reuse' -and $cold.context -match 'sourceReads: extraction, not total I/O') 'map and bounded result explain that sourceReads is not a total-I/O metric'
        Assert-True ($map -match '\.\./\.\./\.\./src/main\.ts' -and $map -match 'click g\d+ "\.\./\.\./\.\./') 'map has workspace-relative source links'
        $before = Get-StateSnapshot $cold
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query start
        Assert-True ($warm.status -eq 'reused' -and $warm.sourceReads -eq 0 -and $warm.changedFiles -eq 0 -and $warm.deletedFiles -eq 0) 'warm invocation reuses every source extraction record'
        Assert-True ($warm.context -ceq $cold.context -and $warm.fingerprint -ceq $cold.fingerprint) 'warm context and fingerprint are deterministic'
        Assert-StableState $before (Get-StateSnapshot $warm) 'Warm query'
        $forced = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Refresh
        Assert-True ($forced.status -eq 'reused' -and $forced.sourceReads -eq 3 -and $forced.changedFiles -eq 0) 'forced revalidation reads sources without fabricating changes'
        Assert-StableState $before (Get-StateSnapshot $forced) 'Unchanged forced refresh'
    }

    Invoke-Case 'Bounded overview with complete inventory' {
        $fixture = New-Fixture 'bounded-map'
        for ($group = 0; $group -lt 18; $group++) {
            $name = 'group-{0:d2}' -f $group
            $imports = [Collections.Generic.List[string]]::new()
            for ($target = 0; $target -lt 18; $target++) {
                if ($target -ne $group) { $imports.Add(("import '../../group-{0:d2}/one/main';" -f $target)) }
            }
            if ($group -eq 0) {
                for ($repeat = 0; $repeat -lt 9; $repeat++) { $imports.Add("import '../../group-01/one/main';") }
            }
            Write-Fixture $fixture "$name\one\main.ts" ($imports -join "`n")
            Write-Fixture $fixture "$name\two\helper.ts" 'export function helper() {}'
        }
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $graph = Read-Graph $result
        $map = [IO.File]::ReadAllText($result.mapPath)
        $diagram = [regex]::Match($map, '(?s)```mermaid(.*?)```').Groups[1].Value
        $nodes = [regex]::Matches($diagram, '(?m)^\s*g\d+\["')
        $links = [regex]::Matches($diagram, '(?m)^\s*g\d+\s+-->\|(?<count>\d+) refs\|\s+g\d+\s*$')
        Assert-True ($nodes.Count -eq 12 -and $links.Count -eq 24) 'overview enforces 12 nodes and 24 aggregate-link limits on a dense graph'
        Assert-True ($result.fileCount -eq 36 -and $result.edgeCount -eq 315 -and $graph.edges.Count -eq 315) 'visual reduction retains every file and observed reference in JSON'
        Assert-True ($diagram.Contains('Other groups') -and $map.Contains('7 smaller top-level groups')) 'excess top-level folders are grouped generically rather than dropped'
        Assert-True ($links.Count -gt 0 -and [int]$links[0].Groups['count'].Value -eq 10) 'highest-count observed aggregate link is selected first'
        $descending = $true
        for ($i = 1; $i -lt $links.Count; $i++) {
            if ([int]$links[$i].Groups['count'].Value -gt [int]$links[$i - 1].Groups['count'].Value) { $descending = $false }
        }
        Assert-True $descending 'overview links are selected deterministically by descending observed-reference count'
        $inventoryGroups = @($graph.nodes.group | Sort-Object -Unique)
        $allGroupsPresent = $true
        foreach ($name in $inventoryGroups) {
            if (-not $map.Contains("[$name](")) { $allGroupsPresent = $false }
        }
        Assert-True ($inventoryGroups.Count -eq 36 -and $allGroupsPresent) 'complete detailed group inventory is retained beyond the old 30-group display limit'
        Assert-True ($map.Contains('Omitted visual links') -and $map.Contains('[graph.json](graph.json)')) 'map explicitly directs readers to the complete graph for omitted visual links'
        $state = Get-StateSnapshot $result
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($warm.status -eq 'reused' -and $warm.sourceReads -eq 0 -and $warm.fingerprint -ceq $result.fingerprint) 'bounded overview is stable on unchanged warm queries'
        Assert-StableState $state (Get-StateSnapshot $warm) 'Warm bounded-overview query'
    }

    Invoke-Case 'Incremental files and reference changes' {
        $fixture = New-Fixture 'incremental'
        Write-Fixture $fixture 'src\main.ts' "import { work } from '../lib/original';`nexport function main() { return work(); }"
        Write-Fixture $fixture 'lib\original.ts' 'export function work() { return 1; }'
        $initial = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $beforeNode = @((Read-Graph $initial).nodes | Where-Object path -eq 'src/main.ts')[0] | ConvertTo-Json -Depth 8 -Compress
        Write-Fixture $fixture 'lib\original.ts' 'export function changedWork() { return 22; }'
        $edited = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query changedWork
        Assert-True ($edited.sourceReads -eq 1 -and $edited.changedFiles -eq 1 -and $edited.status -eq 'updated') 'one-file edit reanalyzes only that file'
        Assert-True ($edited.context -match 'changedWork' -and $edited.fingerprint -ne $initial.fingerprint) 'edited declaration is queryable with a new fingerprint'
        $afterNode = @((Read-Graph $edited).nodes | Where-Object path -eq 'src/main.ts')[0] | ConvertTo-Json -Depth 8 -Compress
        Assert-True ($afterNode -ceq $beforeNode) 'incremental edit preserves the unchanged importer record exactly'
        Write-Fixture $fixture 'lib\added.ts' 'export function added() { return 3; }'
        Write-Fixture $fixture 'src\main.ts' "import { added } from '../lib/added';`nexport function main() { return added(); }"
        [IO.File]::Delete((Join-Path $fixture 'lib\original.ts'))
        $added = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $graph = Read-Graph $added
        Assert-True ($added.sourceReads -eq 2 -and $added.changedFiles -eq 2 -and $added.deletedFiles -eq 1) 'addition, edit and deletion have exact incremental counters'
        Assert-True (@($graph.edges | Where-Object to -eq 'lib/added.ts').Count -eq 1 -and @($graph.edges | Where-Object to -eq 'lib/original.ts').Count -eq 0) 'new reference replaces the deleted target edge'
        [IO.File]::Move((Join-Path $fixture 'lib\added.ts'), (Join-Path $fixture 'lib\renamed.ts'))
        $renamed = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($renamed.changedFiles -eq 1 -and $renamed.deletedFiles -eq 1 -and $renamed.edgeCount -eq 0) 'rename removes unresolved old references without inventing new edges'
        Write-Fixture $fixture 'lib\added.ts' 'export function restored() { return 4; }'
        $restored = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($restored.sourceReads -eq 1 -and $restored.edgeCount -eq 1) 'adding a formerly missing target resolves cached references without rereading importers'
    }

    Invoke-Case 'Git ignore and repeated dirty edits' {
        if ($null -eq $gitCommand) { Write-Skip 'Git-specific inventory and dirty-edit cases require existing Git'; return }
        $fixture = New-Fixture 'git-dirty'
        Invoke-GitFixture $fixture @('init', '--quiet')
        Write-Fixture $fixture '.gitignore' "ignored/`nforced/`n*.ignored`n"
        Write-Fixture $fixture 'src\dirty.ts' 'export function alpha() { return 1; }'
        Write-Fixture $fixture 'ignored\hidden.ts' 'export function mustNotAppear() {}'
        Write-Fixture $fixture 'forced\kept.ts' 'export function trackedDespiteIgnore() {}'
        Write-Fixture $fixture 'new file.ts' 'export function untracked() {}'
        Invoke-GitFixture $fixture @('add', '--', '.gitignore', 'src/dirty.ts')
        Invoke-GitFixture $fixture @('add', '-f', '--', 'forced/kept.ts')
        $initial = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ((Read-Graph $initial).discovery -eq 'git' -and $initial.fileCount -eq 4) 'Git inventory includes tracked and nonignored untracked files only'
        Assert-True (@((Read-Graph $initial).nodes | Where-Object path -like 'ignored/*').Count -eq 0) 'Git ignore rules are respected'
        Assert-True (@((Read-Graph $initial).nodes | Where-Object path -eq 'forced/kept.ts').Count -eq 1) 'ignore pruning retains explicitly tracked files inside ignored directories'
        Write-Fixture $fixture 'src\dirty.ts' 'export function bravo() { return 2; }'
        $first = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query bravo
        $sourcePath = Join-Path $fixture 'src\dirty.ts'
        $writeTime = [IO.File]::GetLastWriteTimeUtc($sourcePath)
        Write-Fixture $fixture 'src\dirty.ts' 'export function delta() { return 3; }'
        if ($IsWindows) { [IO.File]::SetLastWriteTimeUtc($sourcePath, $writeTime) }
        $second = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query delta
        Assert-True ($first.sourceReads -eq 1 -and $second.sourceReads -eq 1 -and $second.changedFiles -eq 1) 'repeated already-dirty edits trigger fresh analysis'
        Assert-True ($second.fingerprint -ne $first.fingerprint -and $second.context -match 'delta') 'same-length dirty edit is not hidden by unchanged Git status or restored write time'
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($warm.sourceReads -eq 0 -and $warm.status -eq 'reused') 'unchanged dirty and untracked files require zero source reads'
        Invoke-GitFixture $fixture @('add', '--', 'src/dirty.ts')
        $staged = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($staged.sourceReads -eq 0 -and $staged.changedFiles -eq 1) 'Git index changes update metadata without rereading unchanged source bytes'
    }

    Invoke-Case 'Curation and marker integrity' {
        $fixture = New-Fixture 'curation'
        Write-Fixture $fixture 'README.md' '# Orientation'
        $mapPath = Join-Path $fixture '.frontier\state\repo-context\map.md'
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($mapPath))
        $prefix = "Human notes  `r`nKeep this exact spacing.`r`n"
        [IO.File]::WriteAllText($mapPath, $prefix, [Text.UTF8Encoding]::new($true))
        $first = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $text = [IO.File]::ReadAllText($mapPath)
        Assert-True ($text.StartsWith($prefix, [StringComparison]::Ordinal) -and $text.Contains($beginMarker)) 'map without markers is preserved and receives an appended managed region'
        $suffix = "`r`nHuman footer with no final newline  "
        [IO.File]::WriteAllText($mapPath, $text + $suffix, [Text.UTF8Encoding]::new($true))
        Write-Fixture $fixture 'src\new.ps1' 'function New-Feature {}'
        $next = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query 'spacing'
        $updated = [IO.File]::ReadAllText($mapPath)
        $bytes = [IO.File]::ReadAllBytes($mapPath)
        Assert-True ($updated.StartsWith($prefix, [StringComparison]::Ordinal) -and $updated.EndsWith($suffix, [StringComparison]::Ordinal)) 'refresh preserves curation prefix and suffix exactly'
        Assert-True ($bytes[0] -eq 0xef -and $bytes[1] -eq 0xbb -and $bytes[2] -eq 0xbf) 'curated map UTF-8 BOM is preserved'
        Assert-True ($next.context -match 'Curated map note \(untrusted\)' -and $next.context -match 'spacing') 'curated prose can inform the bounded output as untrusted data'
        foreach ($malformed in @(
            "$prefix$beginMarker",
            "$prefix$endMarker",
            "$beginMarker`n$endMarker`n$beginMarker`n$endMarker",
            "$endMarker`n$beginMarker",
            '<!-- frontier:repo-context:BEGIN -->'
        )) {
            [IO.File]::WriteAllText($mapPath, $malformed, $utf8)
            $before = Get-StateSnapshot $next
            Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Refresh } 'Malformed or duplicate.*markers' 'malformed curation markers fail explicitly'
            Assert-StableState $before (Get-StateSnapshot $next) 'Rejected malformed-marker refresh'
        }
    }

    Invoke-Case 'Curation-only fingerprints and session budgets' {
        $fixture = New-Fixture 'curation-freshness'
        Write-Fixture $fixture 'src\main.ts' "import { help } from '../lib/helper';`nexport function start() { return help(); }"
        Write-Fixture $fixture 'lib\helper.ts' 'export function help() { return 42; }'
        Write-Fixture $fixture '.frontier\state\repo-context\map.md' 'Human routing note: alpha.  '
        $cold = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query routing -MaxChars 1200
        $coldState = Get-StateSnapshot $cold
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query routing -MaxChars 1200
        Assert-True ($warm.fingerprint -ceq $cold.fingerprint -and $warm.sourceReads -eq 0 -and $warm.status -eq 'reused') 'initial map separators do not invalidate the first warm fingerprint'
        Assert-StableState $coldState (Get-StateSnapshot $warm) 'Warm query after adopting an unterminated curated map'
        $baseline = Read-Graph $cold
        $baselineNodes = ConvertTo-Json -InputObject $baseline.nodes -Depth 8 -Compress
        $baselineEdges = ConvertTo-Json -InputObject $baseline.edges -Depth 8 -Compress
        $mapText = [IO.File]::ReadAllText($cold.mapPath)
        $start = $mapText.IndexOf($beginMarker, [StringComparison]::Ordinal)
        $end = $mapText.IndexOf($endMarker, [StringComparison]::Ordinal) + $endMarker.Length
        $region = $mapText.Substring($start, $end - $start)
        $prefix = "Human routing note: beta.  `r`n"
        $suffix = "`r`nHuman routing footer: beta.  "
        [IO.File]::WriteAllText($cold.mapPath, $prefix + $region + $suffix, [Text.Encoding]::Unicode)

        $hook = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query routing -MaxChars 1200
        $hookGraph = Read-Graph $hook
        Assert-True ($hook.status -eq 'updated' -and $hook.fingerprint -cne $cold.fingerprint) 'curation-only edit updates the fingerprint used for session deduplication'
        Assert-True ($hook.sourceReads -eq 0 -and $hook.changedFiles -eq 0 -and $hook.deletedFiles -eq 0) 'curation-only refresh does not reread or count changes to source records'
        Assert-True ($hook.fileCount -eq 2 -and $hook.edgeCount -eq 1 -and
            (ConvertTo-Json -InputObject $hookGraph.nodes -Depth 8 -Compress) -ceq $baselineNodes -and
            (ConvertTo-Json -InputObject $hookGraph.edges -Depth 8 -Compress) -ceq $baselineEdges) 'curation-only refresh preserves the file and reference graph'
        Assert-True ($hookGraph.fingerprint -ceq $hook.fingerprint -and $hookGraph.curationHash -match '^[a-f0-9]{64}$' -and
            [IO.File]::ReadAllText($hook.mapPath).Contains($hook.fingerprint)) 'result, graph and generated map publish the same curation-aware fingerprint'
        Assert-True ($hook.context.Length -le 1200 -and $hook.context -match 'Human routing note: beta' -and
            $hook.context -match 'Curated map note \(untrusted\)') 'startup context exposes refreshed curation within its 1200-character budget'
        Assert-True ([IO.File]::ReadAllText($hook.graphPath) -notmatch 'Human routing note|Human routing footer') 'only a curation hash is stored in the graph, not the human prose'
        $updatedMap = [IO.File]::ReadAllText($hook.mapPath)
        $updatedBytes = [IO.File]::ReadAllBytes($hook.mapPath)
        Assert-True ($updatedMap.StartsWith($prefix, [StringComparison]::Ordinal) -and $updatedMap.EndsWith($suffix, [StringComparison]::Ordinal) -and
            $updatedBytes[0] -eq 0xff -and $updatedBytes[1] -eq 0xfe) 'curation-only refresh preserves exact prefix, suffix and UTF-16 encoding'
        $hookState = Get-StateSnapshot $hook
        $native = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query routing -MaxChars 3600
        Assert-True ($native.fingerprint -ceq $hook.fingerprint -and $native.status -eq 'reused' -and $native.sourceReads -eq 0 -and
            $native.context.Length -le 3600) 'native and startup budgets share one stable curation-aware fingerprint'
        Assert-StableState $hookState (Get-StateSnapshot $native) 'Warm native query after curation-only refresh'
        $fields = @('schemaVersion', 'status', 'graphPath', 'mapPath', 'fingerprint', 'fileCount', 'edgeCount', 'sourceReads',
            'changedFiles', 'deletedFiles', 'context', 'estimatedTokens', 'elapsedMs')
        Assert-True (@(Compare-Object -ReferenceObject $fields -DifferenceObject @($native.PSObject.Properties.Name)).Count -eq 0) 'curation freshness retains exactly the agreed public result fields'

        [IO.File]::WriteAllText($hook.mapPath, $updatedMap.Replace($suffix, "`r`nHuman routing footer: gamma.  "), [Text.Encoding]::Unicode)
        $footer = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query gamma -MaxChars 1200
        Assert-True ($footer.fingerprint -cne $hook.fingerprint -and $footer.sourceReads -eq 0 -and
            $footer.changedFiles -eq 0 -and $footer.context -match 'Human routing footer: gamma') 'suffix-only curation edits invalidate deduplication and can inform context'
        [IO.File]::AppendAllText($footer.mapPath, ' ', [Text.Encoding]::Unicode)
        $whitespace = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -MaxChars 3600
        Assert-True ($whitespace.fingerprint -cne $footer.fingerprint -and $whitespace.sourceReads -eq 0) 'whitespace-only changes outside the managed block also update the fingerprint'
        $stable = Get-StateSnapshot $whitespace
        $last = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -MaxChars 1200
        Assert-True ($last.fingerprint -ceq $whitespace.fingerprint -and $last.status -eq 'reused' -and $last.sourceReads -eq 0) 'curation-aware fingerprint stabilizes immediately after publication'
        Assert-StableState $stable (Get-StateSnapshot $last) 'Warm query after whitespace-only curation'
        $managedEdit = [IO.File]::ReadAllText($last.mapPath).Replace('flowchart LR', 'flowchart TD')
        [IO.File]::WriteAllText($last.mapPath, $managedEdit, [Text.Encoding]::Unicode)
        $repaired = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -MaxChars 1200
        Assert-True ($repaired.status -eq 'updated' -and $repaired.sourceReads -eq 0 -and $repaired.fingerprint -ceq $last.fingerprint -and
            [IO.File]::ReadAllText($repaired.mapPath).Contains('flowchart LR')) 'unchanged graph fast path still repairs a modified generated map region'
        $repairedState = Get-StateSnapshot $repaired
        Assert-True ($repairedState.GraphHash -eq $stable.GraphHash -and $repairedState.GraphTime -eq $stable.GraphTime) 'map-only repair does not reserialize or rewrite the unchanged graph'
    }

    Invoke-Case 'Source-only cache upgrade' {
        $fixture = New-Fixture 'curation-cache-upgrade'
        Write-Fixture $fixture 'README.md' '# Source-only cache'
        $current = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $legacy = Read-Graph $current
        $legacy.PSObject.Properties.Remove('curationHash')
        $payload = [ordered]@{}
        foreach ($name in @('schemaVersion', 'analysisVersion', 'root', 'discovery', 'nodes', 'edges', 'omitted', 'limits')) {
            $payload[$name] = $legacy.$name
        }
        $hasher = [Security.Cryptography.SHA256]::Create()
        try {
            $bytes = $utf8.GetBytes((ConvertTo-Json -InputObject $payload -Depth 16 -Compress))
            $legacy.fingerprint = [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
        } finally { $hasher.Dispose() }
        [IO.File]::WriteAllText($current.graphPath, (ConvertTo-Json -InputObject $legacy -Depth 16), $utf8)
        $upgraded = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -MaxChars 1200
        Assert-True ($upgraded.status -eq 'updated' -and $upgraded.sourceReads -eq 0 -and $upgraded.changedFiles -eq 0) 'valid source-only schema-1 caches upgrade without discarding extracted records'
        Assert-True ($upgraded.fingerprint -cne $legacy.fingerprint -and (Read-Graph $upgraded).curationHash -match '^[a-f0-9]{64}$') 'upgraded cache binds its fingerprint to curated map text'
        $state = Get-StateSnapshot $upgraded
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($warm.status -eq 'reused' -and $warm.fingerprint -ceq $upgraded.fingerprint -and $warm.sourceReads -eq 0) 'upgraded cache has stable warm reuse'
        Assert-StableState $state (Get-StateSnapshot $warm) 'Warm query after source-only cache upgrade'
    }

    Invoke-Case 'Engineer source relevance without repeated-heading bias' {
        $fixture = New-Fixture 'engineer-relevance'
        Write-Fixture $fixture 'runtime\model-routing.ps1' "function Sync-AgentState {}`nfunction Get-ModelRouting {}`nfunction Start-AgentSession {}"
        Write-Fixture $fixture 'tests\model-routing.ps1' 'function Test-AgentModelRoutingSessionStartup {}'
        Write-Fixture $fixture 'skills\agent-model-routing\scripts\run-comparison.py' 'class ModelSpec: pass'
        $headings = (1..96 | ForEach-Object { "## Agent model routing session startup example $_" }) -join "`r`n"
        Write-Fixture $fixture 'docs\model-routing-tutorial.md' $headings
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Agent engineer -Query 'agent model routing session startup' -MaxChars 1200
        $firstPointer = [regex]::Match($result.context, '(?m)^- \[([^\]]+)').Groups[1].Value
        Assert-True ($firstPointer.StartsWith('runtime/model-routing.ps1:', [StringComparison]::Ordinal)) 'direct engineer code-path matches rank ahead of tutorials, executable skill examples and test scaffolding'
        Assert-True ($result.context.Length -le 1200 -and $result.context -match 'Get-ModelRouting' -and $firstPointer.EndsWith(':2')) 'engineer startup slice points to the strongest matching declaration, not the first generic agent symbol'
        $document = @((Read-Graph $result).nodes | Where-Object path -eq 'docs/model-routing-tutorial.md')[0]
        Assert-True ($document.symbols.Count -eq 64 -and $document.metadataTruncated) 'faster extraction preserves the declaration/header cap and explicit truncation metadata'
        $state = Get-StateSnapshot $result
        $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Agent engineer -Query 'agent model routing session startup' -MaxChars 1200
        Assert-True ($warm.sourceReads -eq 0 -and $warm.context -ceq $result.context -and $warm.fingerprint -ceq $result.fingerprint) 'warm record/edge reuse preserves deterministic relevance and freshness'
        Assert-StableState $state (Get-StateSnapshot $warm) 'Warm engineer source query'
    }

    Invoke-Case 'Character budgets, role hints and unknown queries' {
        $fixture = New-Fixture 'budget'
        Write-Fixture $fixture 'src\payment.ts' 'export function authorizePayment() { return 1; }'
        Write-Fixture $fixture 'tests\payment.test.ts' "import { authorizePayment } from '../src/payment';"
        Write-Fixture $fixture 'docs\architecture.md' '# Payment architecture'
        foreach ($budget in @(512, 513, 1200, 3600, 4000, 15999, 16000)) {
            $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query authorizePayment -Agent tester -MaxChars $budget
            Assert-True ($result.context.Length -le $budget -and $result.context.Length -gt 0) "context obeys exact $budget character bound"
            Assert-True ($result.estimatedTokens -eq [Math]::Ceiling($result.context.Length / 4.0) -and $result.context -match 'estimate') 'token metric is explicitly only a character-based estimate'
            Assert-True ($result.context -match 'payment\.ts') 'tight budget retains a relevant source pointer'
        }
        foreach ($invalid in @(511, 16001)) {
            Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -MaxChars $invalid } '512|16000|range' "invalid $invalid budget is rejected"
        }
        $unknown = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query zzzNoSpecificSymbol -Agent tester -MaxChars 512
        Assert-True ($unknown.context -match 'No specific match' -and $unknown.context -match 'orientation') 'unknown query explicitly falls back to orientation, even with a matching role hint'
        $blank = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        Assert-True ($blank.context -match 'Repository orientation' -and $blank.context -match 'architecture.md') 'empty query surfaces existing context documents'
        Assert-True ([IO.File]::ReadAllText($blank.graphPath) -notmatch 'zzzNoSpecificSymbol|authorizePayment -Agent') 'query and role text are not persisted in graph state'
    }

    Invoke-Case 'Empty roots and nested non-Git boundaries' {
        $fixture = New-Fixture 'empty'
        $empty = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query anything
        $graph = Read-Graph $empty
        Assert-True ($empty.fileCount -eq 0 -and $empty.edgeCount -eq 0 -and $empty.sourceReads -eq 0) 'empty workspace is a valid empty inventory'
        Assert-True ($graph.nodes -is [array] -and $graph.edges -is [array] -and $empty.context -match 'No discoverable') 'empty graph preserves JSON arrays and explicit orientation'
        Assert-True ((Get-FrontierRepositoryContext -WorkspaceRoot $fixture).status -eq 'reused') 'empty graph is reusable without self-indexing generated state'
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot '.' } 'absolute' 'relative workspace roots are rejected'
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot (Join-Path $fixture 'missing') } 'no longer exists|not a directory' 'missing workspace roots fail explicitly'
        if ($null -eq $gitCommand) { Write-Skip 'Nested parent-Git boundary case requires existing Git'; return }
        $parent = New-Fixture 'parent-git'
        Invoke-GitFixture $parent @('init', '--quiet')
        Write-Fixture $parent 'parent-only.md' '# Parent must not be inventoried'
        Write-Fixture $parent 'child workspace\README.md' '# Nested child'
        Invoke-GitFixture $parent @('add', '--', 'parent-only.md')
        $child = Join-Path $parent 'child workspace'
        $nested = Get-FrontierRepositoryContext -WorkspaceRoot $child
        Assert-True ($nested.fileCount -eq 1 -and (Read-Graph $nested).discovery -eq 'filesystem') 'nested non-Git workspace does not inherit parent Git inventory'
        Assert-True (-not [IO.File]::Exists((Join-Path $parent '.frontier\state\repo-context\graph.json'))) 'nested workspace publication remains inside the requested child root'
    }

    Invoke-Case 'Sensitive paths, generated mirrors and analysis limits' {
        $fixture = New-Fixture 'exclusions'
        foreach ($path in @('.env', '.env.production', '.envrc', 'credentials.json', '.credentials.json', '.credentials\auth.txt', 'tokens.json', 'secrets.yaml', 'private.key', 'cert.pem', 'keys\service.json', '.docker\config.json',
            '.frontier\state\notes.md', '.frontier\sessions\prompt.json', '.frontier\config.json',
            '.frontier\runtime\.frontier\state\nested.json',
            'node_modules\dep\index.js', 'vendor\dep.py', 'dist\app.js', 'out\app.js', 'coverage\report.md',
            'build\bundle.js', '.cache\saved.txt', 'generated-assets\mirror.md',
            'an-extension\.github\frontier\AGENTS.md', 'an-extension\.github\agents\copied.md')) {
            Write-Fixture $fixture $path 'NeverPersistThisSecret'
        }
        Write-Fixture $fixture '.frontier\runtime\source.ps1' 'function Get-RealRuntime {}'
        Write-Fixture $fixture 'README.md' '# Real source'
        Write-Fixture $fixture 'large.txt' ('x' * 600000)
        [IO.File]::WriteAllBytes((Join-Path $fixture 'image.png'), [byte[]]@(0, 1, 2, 3))
        [IO.File]::WriteAllBytes((Join-Path $fixture 'binary.ts'), [byte[]]@(65, 0, 66, 0))
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $graph = Read-Graph $result
        Assert-True ($result.fileCount -eq 5 -and $result.sourceReads -eq 3) 'only allowed files are inventoried; known binary and oversized sources are never read'
        Assert-True (@($graph.nodes | Where-Object path -eq '.frontier/runtime/source.ps1').Count -eq 1) 'runtime source remains discoverable while mutable runtime data is excluded'
        Assert-True (@($graph.nodes | Where-Object { $_.path -eq 'large.txt' -and $_.analysis -eq 'oversized' }).Count -eq 1) 'oversized file retains honest inventory metadata'
        Assert-True (@($graph.nodes | Where-Object { $_.path -eq 'image.png' -and $_.analysis -eq 'metadata-only' }).Count -eq 1) 'known binary file retains metadata without content analysis'
        Assert-True (@($graph.nodes | Where-Object { $_.path -eq 'binary.ts' -and $_.analysis -eq 'binary-probe' }).Count -eq 1) 'binary masquerading as source is bounded to a probe'
        Assert-True ([IO.File]::ReadAllText($result.graphPath) -notmatch 'NeverPersistThisSecret|node_modules|an-extension/.github/agents/copied.md') 'excluded content and mirrored source records do not enter the graph'
        Assert-True ((Get-FrontierRepositoryContext -WorkspaceRoot $fixture).sourceReads -eq 0) 'analysis-limit records are reusable without repeat probes'
    }

    Invoke-Case 'Spaces, references, Mermaid escaping and no execution' {
        $fixture = New-Fixture 'untrusted-paths'
        Write-Fixture $fixture 'lib\space name.ts' 'export function spaced() {}'
        Write-Fixture $fixture 'src\entry.ts' "import { spaced } from '../lib/space name';"
        Write-Fixture $fixture 'x];click pwn;[z\diagram.md' "# Curation`n[Source](<../lib/space name.ts>)"
        Write-Fixture $fixture 'scripts\helper.ps1' 'function Get-Helper {}'
        Write-Fixture $fixture 'scripts\entry.ps1' ('. "$PSScriptRoot\helper.ps1"' + "`r`nFUNCTION Start-Session {}`rclass Agent {}")
        Write-Fixture $fixture 'pkg\helper.py' 'def helper(): pass'
        Write-Fixture $fixture 'pkg\main.py' 'from .helper import helper'
        $sentinel = (Join-Path $fixture 'executed.txt').Replace("'", "''")
        Write-Fixture $fixture 'never-execute.ps1' "[IO.File]::WriteAllText('$sentinel', 'bad')"
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query spaced
        $graph = Read-Graph $result
        Assert-True (@($graph.edges | Where-Object { $_.from -eq 'src/entry.ts' -and $_.to -eq 'lib/space name.ts' }).Count -eq 1) 'imports with spaces resolve to actual source files'
        Assert-True (@($graph.edges | Where-Object { $_.from -eq 'scripts/entry.ps1' -and $_.to -eq 'scripts/helper.ps1' }).Count -eq 1) 'literal PSScriptRoot references resolve without execution'
        $scriptNode = @($graph.nodes | Where-Object path -eq 'scripts/entry.ps1')[0]
        Assert-True (@($scriptNode.symbols | Where-Object { $_.Name -eq 'Start-Session' -and $_.Kind -ceq 'FUNCTION' -and $_.Line -eq 2 }).Count -eq 1 -and
            @($scriptNode.symbols | Where-Object { $_.Name -eq 'Agent' -and $_.Line -eq 3 }).Count -eq 1) 'extraction preserves case-insensitive declarations and CRLF/CR line pointers'
        Assert-True (@($graph.edges | Where-Object { $_.from -eq 'pkg/main.py' -and $_.to -eq 'pkg/helper.py' }).Count -eq 1) 'relative Python module reference is grounded in an existing file'
        Assert-True (-not [IO.File]::Exists((Join-Path $fixture 'executed.txt'))) 'repository scripts are never executed'
        $map = [IO.File]::ReadAllText($result.mapPath)
        $diagram = [regex]::Match($map, '(?s)```mermaid(.*?)```').Groups[1].Value
        Assert-True ($diagram -notmatch 'x\];click pwn;\[z' -and $diagram -match '#93;' -and $diagram -match '%5D%3B') 'Mermaid labels and links encode syntax-bearing filenames'
        Assert-True ($map -match 'space%20name.ts' -and $result.context -match 'space%20name.ts') 'generated source URLs encode spaces'
    }

    Invoke-Case 'Cache corruption is never repaired silently' {
        $fixture = New-Fixture 'corruption'
        Write-Fixture $fixture 'README.md' '# Cache'
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $valid = [IO.File]::ReadAllText($result.graphPath)
        foreach ($corrupt in @('{invalid', '{}', ($valid -replace '"schemaVersion": 1', '"schemaVersion": 999'), ($valid -replace '"path": "README.md"', '"path": "../escape.md"'))) {
            [IO.File]::WriteAllText($result.graphPath, $corrupt, $utf8)
            $before = Get-StateSnapshot $result
            Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Refresh } 'Invalid repository context cache' 'malformed or unsafe graph cache fails explicitly even on refresh'
            Assert-StableState $before (Get-StateSnapshot $result) 'Rejected corrupt-cache refresh'
        }
    }

    Invoke-Case 'Reparse points and unsafe cache destinations' {
        $fixture = New-Fixture 'links'
        $outside = New-Fixture 'outside'
        Write-Fixture $outside 'outside.md' '# Outside content must not be read'
        Write-Fixture $fixture 'README.md' '# Inside'
        $link = Join-Path $fixture 'linked'
        try {
            $kind = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
            $null = New-Item -ItemType $kind -Path $link -Target $outside -ErrorAction Stop
        } catch {
            Write-Skip "Link fixtures unavailable: $($_.Exception.Message)"
            return
        }
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -WarningAction SilentlyContinue
        Assert-True ($result.fileCount -eq 1 -and @((Read-Graph $result).omitted).Count -eq 1) 'filesystem fallback prunes linked source directories with explicit omission metadata'
        if ($null -ne $gitCommand) {
            Invoke-GitFixture $fixture @('init', '--quiet')
            Invoke-GitFixture $fixture @('add', '--', 'README.md')
            $gitLinked = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -WarningAction SilentlyContinue
            Assert-True ($gitLinked.fileCount -eq 1 -and (Read-Graph $gitLinked).discovery -eq 'git' -and
                @((Read-Graph $gitLinked).omitted).Count -eq 1) 'Git inventory also prunes untracked junctions without walking their targets'
        }
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $link } 'reparse|Unsafe' 'linked workspace root is rejected'
        [void][IO.Directory]::CreateDirectory((Join-Path $outside 'child'))
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot (Join-Path $link 'child') } 'reparse|Unsafe' 'linked workspace ancestor is rejected'
        $unsafe = New-Fixture 'unsafe-cache'
        $null = New-Item -ItemType $kind -Path (Join-Path $unsafe '.frontier') -Target $outside
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $unsafe } 'reparse|Unsafe' 'linked cache parent is rejected before writing'
        Assert-True (-not [IO.Directory]::Exists((Join-Path $outside 'state'))) 'cache protection creates no files in the link target'
        $cache = New-Fixture 'unsafe-cache-leaf'
        Write-Fixture $cache 'README.md' '# Leaf protection'
        $leaf = Get-FrontierRepositoryContext -WorkspaceRoot $cache
        [IO.File]::Delete($leaf.graphPath)
        [void][IO.Directory]::CreateDirectory($leaf.graphPath)
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $cache } 'Expected.*file' 'directory substituted for graph file fails explicitly'
    }

    Invoke-Case 'Bounded lock contention' {
        $fixture = New-Fixture 'locked'
        Write-Fixture $fixture 'README.md' '# Lock'
        $result = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
        $before = Get-StateSnapshot $result
        $lockPath = Join-Path $fixture '.frontier\state\repo-context\refresh.lock'
        $handle = [IO.File]::Open($lockPath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $elapsed = [Diagnostics.Stopwatch]::StartNew()
        try {
            Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -LockTimeoutSeconds 2 } 'Cannot acquire.*lock within 2 seconds' 'active cross-process lock has a bounded explicit failure'
        } finally { $handle.Dispose() }
        Assert-True ($elapsed.Elapsed.TotalSeconds -lt 20) 'lock contention does not wait indefinitely'
        Assert-StableState $before (Get-StateSnapshot $result) 'Timed-out refresh'
    }

    Invoke-Case 'Concurrent refresh serialization' {
        $fixture = New-Fixture 'parallel'
        Write-Fixture $fixture 'src\main.ts' "import '../lib/helper';"
        Write-Fixture $fixture 'lib\helper.ts' 'export function help() {}'
        $mapPath = Join-Path $fixture '.frontier\state\repo-context\map.md'
        Write-Fixture $fixture '.frontier\state\repo-context\map.md' "Human curation before concurrent starts.`r`n"
        $processes = [Collections.Generic.List[Diagnostics.Process]]::new()
        $outputs = [Collections.Generic.List[object]]::new()
        try {
            for ($i = 0; $i -lt 3; $i++) {
                $command = ". '$($modulePath.Replace("'", "''"))'; Get-FrontierRepositoryContext -WorkspaceRoot '$($fixture.Replace("'", "''"))' -Refresh | ConvertTo-Json -Compress"
                $start = [Diagnostics.ProcessStartInfo]::new()
                $start.FileName = (Get-Process -Id $PID).Path
                $start.UseShellExecute = $false
                $start.RedirectStandardOutput = $true
                $start.RedirectStandardError = $true
                foreach ($argument in @('-NoProfile', '-NonInteractive', '-EncodedCommand', [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command)))) {
                    $start.ArgumentList.Add($argument)
                }
                $process = [Diagnostics.Process]::Start($start)
                $processes.Add($process)
                $outputs.Add([pscustomobject]@{ Out = $process.StandardOutput.ReadToEndAsync(); Error = $process.StandardError.ReadToEndAsync() })
            }
            $results = [Collections.Generic.List[object]]::new()
            for ($i = 0; $i -lt $processes.Count; $i++) {
                if (-not $processes[$i].WaitForExit(60000)) { throw 'Concurrent fixture refresh timed out.' }
                $stderr = $outputs[$i].Error.GetAwaiter().GetResult()
                Assert-True ($processes[$i].ExitCode -eq 0) "concurrent process $i completes without cache corruption ($stderr)"
                if ($processes[$i].ExitCode -eq 0) { $results.Add(($outputs[$i].Out.GetAwaiter().GetResult() | ConvertFrom-Json)) }
            }
            Assert-True ($results.Count -eq 3 -and @($results | Select-Object -ExpandProperty fingerprint -Unique).Count -eq 1) 'simultaneous refreshes publish one coherent fingerprint'
            Assert-True (@($results | Where-Object status -eq 'created').Count -eq 1) 'only one concurrent start creates the graph'
            $map = [IO.File]::ReadAllText($mapPath)
            Assert-True ($map.StartsWith("Human curation before concurrent starts.`r`n", [StringComparison]::Ordinal) -and
                [regex]::Matches($map, [regex]::Escape($beginMarker)).Count -eq 1) 'concurrent starts preserve curation and exactly one managed region'
            $warm = Get-FrontierRepositoryContext -WorkspaceRoot $fixture
            Assert-True ($warm.sourceReads -eq 0 -and $warm.fileCount -eq 2 -and $warm.edgeCount -eq 1) 'concurrently published cache supports normal warm reuse'
            Assert-True (@([IO.Directory]::EnumerateFiles([IO.Path]::GetDirectoryName($mapPath), '*.tmp')).Count -eq 0) 'atomic publication leaves no temporary files'
        } finally {
            foreach ($process in $processes) {
                if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
                $process.Dispose()
            }
        }
    }

    Invoke-Case 'Cached reads, session primer and scheduling gates' {
        $fixture = New-Fixture 'cached'
        Write-Fixture $fixture 'src\main.ts' "import { help } from '../lib/helper';`nexport function start() { return help(); }"
        Write-Fixture $fixture 'lib\helper.ts' 'export function help() { return 42; }'
        $missing = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Cached
        Assert-True ($missing.status -eq 'missing' -and -not [IO.Directory]::Exists((Join-Path $fixture '.frontier'))) 'cached reads report a missing graph without creating state'
        $built = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query start
        $primer = [IO.File]::ReadAllText((Join-Path $fixture '.frontier\state\repo-context\primer.json')) | ConvertFrom-Json
        $graphHash = (Get-FileHash -LiteralPath $built.graphPath -Algorithm SHA256).Hash.ToLowerInvariant()
        Assert-True ($primer.fingerprint -eq $built.fingerprint -and $primer.context.Length -le 1200 -and $primer.graphHash -eq $graphHash) 'full pass publishes a bounded primer bound to the graph bytes'
        $before = Get-StateSnapshot $built
        $cached = Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Query start -Cached
        Assert-True ($cached.status -eq 'cached' -and $cached.sourceReads -eq 0 -and $cached.context -ceq $built.context -and $cached.fingerprint -ceq $built.fingerprint) 'cached query returns the same context as a full pass'
        Assert-StableState $before (Get-StateSnapshot $cached) 'Cached query'
        $graphText = [IO.File]::ReadAllText($built.graphPath)
        [IO.File]::WriteAllText($built.graphPath, $graphText.Replace('lib/helper.ts', 'lib/../../escape.ts'), $utf8)
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Cached } 'Invalid repository context cache' 'graph bytes that differ from the recorded hash are fully validated'
        $primerFile = Join-Path $fixture '.frontier\state\repo-context\primer.json'
        $primerText = [IO.File]::ReadAllText($primerFile)
        $forged = $primerText | ConvertFrom-Json -AsHashtable
        $forged['graphHash'] = (Get-FileHash -LiteralPath $built.graphPath -Algorithm SHA256).Hash.ToLowerInvariant()
        [IO.File]::WriteAllText($primerFile, ($forged | ConvertTo-Json -Depth 4), $utf8)
        Assert-Throws { Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Cached } 'Invalid node path' 'a forged matching hash still cannot publish unsafe paths'
        [IO.File]::WriteAllText($primerFile, $primerText, $utf8)
        [IO.File]::WriteAllText($built.graphPath, $graphText, $utf8)
        $lockPath = Join-Path $fixture '.frontier\state\repo-context\refresh.lock'
        $handle = [IO.File]::Open($lockPath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try {
            Assert-True ((Get-FrontierRepositoryContext -WorkspaceRoot $fixture -NoWait).status -eq 'busy') 'background refresh returns busy instead of waiting on an active refresh'
            Assert-True ((Get-FrontierRepositoryContext -WorkspaceRoot $fixture -Cached).status -eq 'cached') 'cached reads do not wait on the refresh lock'
        } finally { $handle.Dispose() }
        Assert-True (-not (Test-FrontierRepositoryWorkspace $fixture)) 'folders without Frontier config are not Frontier workspaces'
        Assert-True (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $fixture -Force)) 'background refresh never starts outside Frontier workspaces'
        Write-Fixture $fixture '.frontier\config.json' '{"mode":"local"}'
        $state = Get-FrontierRepositoryPrimer $fixture
        Assert-True ($null -ne $state.primer -and $state.primer['fingerprint'] -eq $built.fingerprint) 'primer loader returns the published primer'
        Assert-True (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $fixture -State $state)) 'fresh graphs are not refreshed again'
        $text = Format-FrontierRepositoryPrimer $state $false
        Assert-True ($text.StartsWith($primer.context) -and $text -match 'last checked') 'session primer carries graph age'
        Write-FrontierRepositoryRefreshStatus $state.directory @{ state = 'failed'; at = [DateTime]::UtcNow.ToString('o'); error = "disk`nfull" }
        $failed = Format-FrontierRepositoryPrimer (Get-FrontierRepositoryPrimer $fixture) $false
        Assert-True ($failed -match 'refresh failed' -and $failed -notmatch "disk`nfull") 'refresh failures are surfaced on one sanitized line'
        $primerPath = Join-Path $fixture '.frontier\state\repo-context\primer.json'
        $stale = [IO.File]::ReadAllText($primerPath) | ConvertFrom-Json -AsHashtable
        $stale['checkedAt'] = [DateTime]::UtcNow.AddMinutes(-10).ToString('o')
        [IO.File]::WriteAllText($primerPath, ($stale | ConvertTo-Json -Depth 4), $utf8)
        Write-FrontierRepositoryRefreshStatus $state.directory @{ state = 'scheduled'; at = [DateTime]::UtcNow.ToString('o') }
        $pending = Get-FrontierRepositoryPrimer $fixture
        Assert-True (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $fixture -State $pending)) 'a pending worker suppresses duplicate scheduling of a stale graph'
        $gate = [IO.File]::Open((Join-Path $state.directory 'schedule.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try {
            Assert-True (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $fixture -Force)) 'a concurrent scheduler holding the gate prevents a second worker'
        } finally { $gate.Dispose() }
        $missingState = @{ directory = $state.directory; primer = $null; status = $pending.status }
        Assert-True ((Format-FrontierRepositoryPrimer $missingState $false) -match 'background') 'missing graphs report background construction'
        $cold = New-Fixture 'cold-schedule'
        Write-Fixture $cold '.frontier\config.json' '{"mode":"local"}'
        $coldDirectory = New-FrontierRepositoryContextStateDirectory $cold
        Assert-True ([IO.Directory]::Exists($coldDirectory) -and (Get-FrontierRepositoryPrimer $cold).directory -eq $coldDirectory) 'cold workspaces get a state directory for scheduling markers and session claims'
        $coldGate = [IO.File]::Open((Join-Path $coldDirectory 'schedule.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try {
            Assert-True (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $cold)) 'concurrent cold scheduling starts only one worker'
            Assert-True (-not (Test-Path -LiteralPath (Join-Path $coldDirectory 'refresh-status.json'))) 'a caller that loses the gate writes no status'
        } finally { $coldGate.Dispose() }
        $refreshLock = [IO.File]::Open((Join-Path $state.directory 'refresh.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try { Invoke-FrontierRepositoryContextWorker $fixture } finally { $refreshLock.Dispose() }
        $afterBusy = Get-FrontierRepositoryPrimer $fixture
        Assert-True ($afterBusy.status['state'] -eq 'deferred') 'a worker that finds another refresh running releases the pending marker'
        $scan = New-Fixture 'scan-budget'
        foreach ($i in 1..5) { Write-Fixture $scan "file$i.txt" 'x' }
        $examined = 0
        $entries = [Frontier.RepositoryContext.SourceScannerV4]::EnumerateEntries($scan, [string[]]@($scan), 3, [ref]$examined)
        Assert-True ($examined -eq 3 -and $entries.Count -le 3) 'directory enumeration stops at its examined-entry budget'
    }
} finally {
    foreach ($fixture in $script:fixtures) {
        if ([IO.Directory]::Exists($fixture)) { Remove-Fixture $fixture }
    }
}

if ($script:failed -gt 0) {
    Write-Host "Repository context behavior: $script:failed failed, $script:passed passed, $script:skipped skipped."
    exit 1
}
Write-Host "Repository context behavior: $script:passed passed, $script:skipped skipped."
