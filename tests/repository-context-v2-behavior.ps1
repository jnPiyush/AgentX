#Requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path $PSScriptRoot -Parent
. (Join-Path $repo '.frontier' 'runtime' 'repository-context.ps1')
$passed = 0
function Assert-Graph([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "[FAIL] $Message" }
    $script:passed++
    Write-Host "[PASS] $Message"
}
function Assert-GraphError([scriptblock]$Action, [string]$Pattern, [string]$Message) {
    $errorText = ''
    try { & $Action | Out-Null } catch { $errorText = $_.Exception.Message }
    Assert-Graph ($errorText -match $Pattern) "$Message ($errorText)"
}
function Write-Source([string]$Relative, [string]$Text) {
    $file = Join-Path $root $Relative
    [void][IO.Directory]::CreateDirectory((Split-Path $file -Parent))
    [IO.File]::WriteAllText($file, $Text, [Text.UTF8Encoding]::new($false))
}

$root = Join-Path ([IO.Path]::GetTempPath()) "frontier-context-v2-$([guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($root)
try {
    $functions = @(
        for ($index = 0; $index -lt 90; $index++) {
            "function Read-Record$index { param([string]`$Name) return `$Name }"
        }
        'function Invoke-Record { Read-Record89 -Name "fixture" }'
    ) -join "`n"
    Write-Source 'src/records.ps1' $functions
    Write-Source 'README.md' "# Fixture application`n[Records](src/records.ps1)"
    Write-Source 'src/service.ts' "export class Service { execute(value: string): string { return value; } }"
    Write-Source '.frontier/config.json' '{"mode":"local"}'
    Write-Source '.frontier/state/repo-context/map.md' "# Human map`nKeep the records API stable."
    $built = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -TokenBudget 1000
    $graph = Get-Content -LiteralPath $built.graphPath -Raw | ConvertFrom-Json -Depth 32
    $recordNode = @($graph.nodes | Where-Object path -eq 'src/records.ps1')[0]
    Assert-Graph ($graph.schemaVersion -eq 2 -and $built.schemaVersion -eq 1 -and $built.contextVersion -eq 2) 'storage version changes without breaking legacy response version'
    Assert-Graph ($recordNode.symbols.Count -eq 91) 'all PowerShell definitions survive beyond the former64limit'
    Assert-Graph ($recordNode.parser -like 'powershell-ast*') 'native syntax provenance is recorded'
    Assert-Graph ($built.items[0].name -eq 'Read-Record89') 'an exact late symbol ranks first'
    Assert-Graph (@($built.items | Where-Object name -eq 'Invoke-Record').Count -eq 1) 'same-file caller appears through a typed relation'
    Assert-Graph (@($graph.relations | Where-Object { $_.kind -eq 'calls' -and $_.confidence -eq 'heuristic' }).Count -gt 0) 'syntax-inferred calls are never labeled compiler-resolved'
    Assert-Graph (@($graph.hierarchy | Where-Object id -eq 'src').Count -eq 1) 'subsystem cards are stored with the graph'
    Assert-GraphError {
        Invoke-RepositoryParserProcess -Executable (Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })) `
            -Arguments @('-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 30') -TimeoutSeconds 1
    } 'timed out|limit' 'parser lifetime has a hard deadline'
    Assert-GraphError {
        Invoke-RepositoryParserProcess -Executable (Join-Path $PSHOME $(if ($IsWindows) { 'pwsh.exe' } else { 'pwsh' })) `
            -Arguments @('-NoProfile', '-NonInteractive', '-Command', '[Console]::Out.Write(("x" * 17000000))') -TimeoutSeconds 10
    } 'limit|exceeded|parser failed' 'oversized parser output cannot be accumulated indefinitely'
    $mapBytes = [IO.File]::ReadAllBytes($built.mapPath)
    $warm = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -TokenBudget 1000
    Assert-Graph ($warm.sourceReads -eq 0 -and $warm.changedFiles -eq 0 -and $warm.fingerprint -ceq $built.fingerprint) 'warm updates reuse extraction and derived relationships'
    Assert-Graph ([Convert]::ToBase64String($mapBytes) -ceq [Convert]::ToBase64String([IO.File]::ReadAllBytes($built.mapPath))) 'unchanged refresh preserves map bytes and curation'
    $primer = Get-Content -LiteralPath (Join-Path $root '.frontier/state/repo-context/primer.json') -Raw | ConvertFrom-Json
    Assert-Graph ($primer.context.Contains('Keep the records API stable.') -and $primer.context.Length -le 1200) 'curated orientation receives reserved primer space'

    $small = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'NoMatchingSymbolHere' -MaxChars 512 -Cached
    Assert-Graph ($small.context.Length -le 512 -and $small.coverage.exactMatches -eq 0) 'no-answer context remains within the smallest character budget'
    $clamped = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -TokenBudget 8000 -Cached
    Assert-Graph ($clamped.budget.effectiveChars -eq 16000 -and $clamped.budget.limitedBy -eq 'maxChars') 'large token budgets report the character ceiling'
    $scoped = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -Subsystem src -GraphHops 0 -Cached
    Assert-Graph (@($scoped.items | Where-Object { -not $_.path.StartsWith('src/') }).Count -eq 0) 'subsystem filtering applies before retrieval'
    $missingScope = Get-FrontierRepositoryContext -WorkspaceRoot $root -Subsystem 'not-present' -Cached
    Assert-Graph ($missingScope.items.Count -eq 0 -and $missingScope.context -match 'Unknown subsystem') 'unknown subsystems fail visibly without unrelated evidence'
    Assert-GraphError { Get-FrontierRepositoryContext -WorkspaceRoot $root -Query ('x' * 4097) -Cached } '4096|validation' 'engine rejects oversized queries'
    Assert-GraphError { Get-FrontierRepositoryContext -WorkspaceRoot $root -Subsystem '../outside' -Cached } 'relative' 'subsystem traversal is rejected'

    $evidence = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -Detail evidence -GraphHops 0 -TokenBudget 1000 -Cached
    Assert-Graph ($evidence.items[0].freshness -eq 'live' -and $evidence.context.Contains('return $Name')) 'evidence is emitted from hash-verified current source'
    $again = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -Detail evidence -GraphHops 0 -TokenBudget 1000 -SeenItems $evidence.items -Cached
    Assert-Graph ($again.items[0].deduped -and $again.context -match 'retained history') 'acknowledged retained evidence becomes a back-reference'
    $withoutReceipts = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -Detail evidence -GraphHops 0 -Cached
    Assert-Graph (-not $withoutReceipts.items[0].deduped) 'unknown or cleared history reloads evidence'
    Write-Source 'src/records.ps1' ($functions + "`nfunction Added-Record { return 1 }")
    $stale = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -Detail evidence -GraphHops 0 -Cached
    Assert-Graph ($stale.items[0].freshness -eq 'stale' -and -not $stale.context.Contains('return $Name')) 'changed files are not emitted as live evidence from a stale graph'
    $updated = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Added-Record'
    Assert-Graph ($updated.sourceReads -eq 1 -and $updated.changedFiles -eq 1 -and $updated.items[0].name -eq 'Added-Record') 'one-file updates refresh only changed extraction'
    Remove-Item -LiteralPath (Join-Path $root 'src/service.ts')
    $deleted = Get-FrontierRepositoryContext -WorkspaceRoot $root
    Assert-Graph ($deleted.deletedFiles -eq 1 -and $deleted.sourceReads -eq 0) 'deletions invalidate graph and hierarchy without rereading unchanged sources'

    Write-Source 'src/config.ps1' "function Get-Configuration { `$password = 'fixture-private-literal'; return `$password }"
    $null = Get-FrontierRepositoryContext -WorkspaceRoot $root
    $blocked = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Get-Configuration' -Detail evidence -GraphHops 0 -Cached
    Assert-Graph ($blocked.items[0].freshness -eq 'blocked' -and -not $blocked.context.Contains('fixture-private-literal')) 'secret-looking source content is not exposed'
    $contents = [IO.File]::ReadAllText($built.graphPath)
    Assert-Graph (-not $contents.Contains('fixture-private-literal')) 'signatures do not persist default/body literals'

    $hostCount = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query 'Read-Record89' -TokenBudget 256 `
        -CountTokens { param($text) [int][Math]::Ceiling($text.Length / 2) } -Cached
    Assert-Graph ($hostCount.budget.method -eq 'host-count' -and $hostCount.budget.tokenCount -le 256) 'trusted host counting covers the final fingerprinted text'
    $map = [IO.File]::ReadAllText($built.mapPath)
    [IO.File]::WriteAllText($built.mapPath, "New curated note.`n$map")
    $mixed = Get-FrontierRepositoryContext -WorkspaceRoot $root -Cached
    Assert-Graph ($mixed.status -eq 'stale' -and $mixed.items.Count -eq 0) 'mixed curation and graph generations do not return evidence'
    $refreshed = Get-FrontierRepositoryContext -WorkspaceRoot $root
    Assert-Graph ($refreshed.sourceReads -eq 0 -and $refreshed.context.Contains('New curated note.')) 'curation refresh changes the fingerprint without source extraction'

    Write-Source 'docs/blank-headings.md' "#  `n##   `n# Retained heading"
    Write-Source 'src/unsafe-name.ps1' ("function " + [char]0x202E + " {}`nfunction Read-SafeRecord { return 1 }")
    $normalized = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query Read-SafeRecord
    $normalizedGraph = Get-Content -LiteralPath $normalized.graphPath -Raw | ConvertFrom-Json -Depth 32
    $blankNode = @($normalizedGraph.nodes | Where-Object path -eq 'docs/blank-headings.md')[0]
    $unsafeNode = @($normalizedGraph.nodes | Where-Object path -eq 'src/unsafe-name.ps1')[0]
    Assert-Graph ($blankNode.symbols.Count -eq 1 -and $blankNode.symbols[0].Name -eq 'Retained heading') 'blank headings are dropped without aborting discovery'
    Assert-Graph ($unsafeNode.symbols.Count -eq 1 -and $unsafeNode.symbols[0].Name -eq 'Read-SafeRecord') 'an unsafe normalized name cannot stop valid symbols from being indexed'
    Assert-Graph (($blankNode.diagnostics -join ' ') -match 'Dropped.*blank-headings.md' -and
        ($unsafeNode.diagnostics -join ' ') -match 'Dropped.*unsafe-name.ps1') 'dropped symbols have file-bound diagnostics'

    Write-Source 'src/marker.ts' "export function marker() { return 'items:0000000000000000'; }"
    $null = Get-FrontierRepositoryContext -WorkspaceRoot $root
    $literal = Get-FrontierRepositoryContext -WorkspaceRoot $root -Query marker -Detail evidence -GraphHops 0 -Cached
    Assert-Graph ($literal.items[0].freshness -eq 'live' -and
        $literal.context.Contains("return 'items:0000000000000000'")) 'header identity substitution does not rewrite live source text'
    $literalBlock = [regex]::Match($literal.context, '(?ms)^- src/marker\.ts:.*\z').Value + "`n"
    Assert-Graph ((Get-RepositoryTextHash $literalBlock) -ceq $literal.items[0].contentHash) 'delivered source block matches its content hash'

    $legacyRoot = Join-Path $root '.frontier/state/legacy-consumer'
    $legacyCache = Join-Path $legacyRoot '.frontier/state/repo-context'
    [void][IO.Directory]::CreateDirectory((Join-Path $legacyRoot 'src'))
    [void][IO.Directory]::CreateDirectory($legacyCache)
    $legacySource = 'export function LegacyEntry() { return 42; }'
    [IO.File]::WriteAllText((Join-Path $legacyRoot 'src/legacy.ts'), $legacySource)
    $legacyNode = [ordered]@{
        path = 'src/legacy.ts'; group = 'src'; size = [Text.Encoding]::UTF8.GetByteCount($legacySource)
        stamp = 'legacy-stamp'; index = ''; analysis = 'text'; contentHash = Get-RepositoryTextHash $legacySource
        symbols = @([ordered]@{ Name = 'LegacyEntry'; Kind = 'function'; Line = 1 })
        references = @(); metadataTruncated = $false
    }
    $legacyPayload = [ordered]@{
        schemaVersion = 1; analysisVersion = 1; root = $legacyRoot; discovery = 'filesystem'
        nodes = @($legacyNode); edges = @(); omitted = @(); limits = @('Legacy fixture navigation only.')
    }
    $legacyHash = Get-RepositoryTextHash ($legacyPayload | ConvertTo-Json -Depth 16 -Compress)
    $legacyPayload['fingerprint'] = $legacyHash
    $legacyPath = Join-Path $legacyCache 'graph.json'
    $legacyBytes = $legacyPayload | ConvertTo-Json -Depth 16
    [IO.File]::WriteAllText($legacyPath, $legacyBytes)
    $legacyPrefix = "Human-owned v1 architecture note.`n"
    $legacySuffix = "`nHuman-owned v1 footer."
    $legacyMap = $legacyPrefix + "<!-- frontier:repo-context:begin -->`nLegacy generated content`n<!-- frontier:repo-context:end -->" + $legacySuffix
    [IO.File]::WriteAllText((Join-Path $legacyCache 'map.md'), $legacyMap)
    $cachedLegacy = Get-FrontierRepositoryContext -WorkspaceRoot $legacyRoot -Query LegacyEntry -Detail evidence -MaxChars 1200 -Cached
    Assert-Graph ($cachedLegacy.status -eq 'cached' -and $cachedLegacy.freshness.navigation -eq 'legacy' -and
        $cachedLegacy.context.Length -le 1200 -and $cachedLegacy.items[0].freshness -eq 'live') 'a real fingerprinted schema1 cache remains usable before migration'
    $legacyPayload['fingerprint'] = '0' * 64
    [IO.File]::WriteAllText($legacyPath, ($legacyPayload | ConvertTo-Json -Depth 16))
    Assert-GraphError { Get-FrontierRepositoryContext -WorkspaceRoot $legacyRoot -Cached } 'fingerprint' 'untrusted v1 cache fingerprint is validated'
    [IO.File]::WriteAllText($legacyPath, $legacyBytes)
    $migrated = Get-FrontierRepositoryContext -WorkspaceRoot $legacyRoot -Query LegacyEntry
    $migratedGraph = Get-Content -LiteralPath $legacyPath -Raw | ConvertFrom-Json -Depth 32
    $migratedMap = [IO.File]::ReadAllText((Join-Path $legacyCache 'map.md'))
    Assert-Graph ($migratedGraph.schemaVersion -eq 2 -and $migratedGraph.parserIdentity -match '^[a-f0-9]{64}$' -and
        $migrated.sourceReads -eq 1 -and $migrated.changedFiles -eq 1) 'v1 migration re-extracts existing nodes under the v2 parser identity'
    Assert-Graph ($migratedMap.StartsWith($legacyPrefix) -and $migratedMap.EndsWith($legacySuffix)) 'v1 migration preserves both curated regions exactly'

    if ($IsWindows) {
        $outside = Join-Path ([IO.Path]::GetTempPath()) "frontier-context-link-target-$([guid]::NewGuid().ToString('N'))"
        $insideLink = Join-Path $root 'linked-source'
        [void][IO.Directory]::CreateDirectory($outside)
        try {
            New-Item -ItemType Junction -Path $insideLink -Target $outside | Out-Null
            $linked = Get-FrontierRepositoryContext -WorkspaceRoot $root
            $linkedGraph = Get-Content -LiteralPath $linked.graphPath -Raw | ConvertFrom-Json -Depth 32
            Assert-Graph (@($linkedGraph.omitted | Where-Object { $_ -match 'Reparse/link source omitted: linked-source' }).Count -ge 1) 'reparse points below the workspace root are omitted'
        } finally {
            if (Test-Path -LiteralPath $insideLink) { Remove-Item -LiteralPath $insideLink -Force }
            if (Test-Path -LiteralPath $outside) { Remove-Item -LiteralPath $outside -Recurse -Force }
        }
        $alias = Join-Path ([IO.Path]::GetTempPath()) "frontier-context-alias-$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Junction -Path $alias -Target $root | Out-Null
        try {
            $aliased = Get-FrontierRepositoryContext -WorkspaceRoot $alias
            Assert-Graph ($aliased.graphPath -and (Test-Path -LiteralPath $aliased.graphPath)) 'a workspace opened through a junction ancestor builds its graph at the resolved root'
        } finally {
            if (Test-Path -LiteralPath $alias) { Remove-Item -LiteralPath $alias -Force }
        }
    }

    $cacheDirectory = Split-Path $built.graphPath -Parent
    Write-FrontierRepositoryRefreshStatus $cacheDirectory @{
        state = 'failed'; at = [DateTime]::UtcNow.ToString('o'); error = 'parser failure fixture'
    }
    $parkedGraph = Join-Path $cacheDirectory 'graph.fixture-backup.json'
    Move-Item -LiteralPath $built.graphPath -Destination $parkedGraph
    try {
        $missing = Get-FrontierRepositoryContext -WorkspaceRoot $root -MaxChars 512 -Cached
        Assert-Graph ($missing.status -eq 'missing' -and $missing.refreshStatus.state -eq 'failed' -and
            $missing.context.Contains('parser failure fixture') -and $missing.context.Length -le 512) 'missing-graph output preserves bounded background failure diagnostics'
        Assert-Graph (-not (Start-FrontierRepositoryContextRefresh -WorkspaceRoot $root -Stale)) 'automatic stale refresh respects the recent-failure retry window'
    } finally { Move-Item -LiteralPath $parkedGraph -Destination $built.graphPath }

    $future = Get-Content -LiteralPath $built.graphPath -Raw | ConvertFrom-Json -AsHashtable -Depth 32
    $future.schemaVersion = 999
    [IO.File]::WriteAllText($built.graphPath, ($future | ConvertTo-Json -Depth 32))
    $beforeFuture = [IO.File]::ReadAllText($built.graphPath)
    $incompatible = Get-FrontierRepositoryContext -WorkspaceRoot $root -Cached
    Assert-Graph ($incompatible.status -eq 'incompatible' -and
        [IO.File]::ReadAllText($built.graphPath) -ceq $beforeFuture) 'future schema remains untouched and explicitly incompatible'
    Write-Host "Repository context v2: $passed passed."
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force
}
