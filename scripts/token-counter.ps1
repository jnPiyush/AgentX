#!/usr/bin/env pwsh
#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('count', 'check', 'report', 'context')]
    [string]$Action = 'report',
    [string]$Path = '',
    [string]$BaselineRef = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EstimatedTokens([string]$Text) {
    return [long][math]::Ceiling($Text.Replace("`r`n", "`n").Length / 4.0)
}

function Get-FrontmatterText([string]$Text) {
    $match = [regex]::Match($Text, '\A---\r?\n(.*?)\r?\n---', 'Singleline')
    if ($match.Success) { return $match.Groups[1].Value }
    return ''
}

function Get-FrontmatterValue([string]$Frontmatter, [string]$Key) {
    $lines = $Frontmatter -split '\r?\n'
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch "^$([regex]::Escape($Key)):\s*(.*)$") { continue }
        $value = $Matches[1].Trim()
        if ($value -in @('>', '>-', '|', '|-')) {
            $folded = @(for ($j = $i + 1; $j -lt $lines.Count -and $lines[$j] -match '^\s+\S'; $j++) { $lines[$j].Trim() })
            return ($folded -join ' ')
        }
        return $value.Trim("'").Trim('"')
    }
    return ''
}

function Test-PromptTypeFile([string]$FilePath) {
    $name = [IO.Path]::GetFileName($FilePath)
    return $name -in @('SKILL.md', 'AGENTS.md', 'copilot-instructions.md') -or
        $name -match '\.(instructions|prompt|agent)\.md$'
}

function Get-ReferenceTargets([string]$FilePath, [switch]$Imports) {
    $text = [IO.File]::ReadAllText($FilePath)
    # Code is not rendered as a reference by hosts, so ignore fenced blocks and inline spans.
    $text = [regex]::Replace($text, '(?s)```.*?```', '')
    $text = [regex]::Replace($text, '`[^`\n]*`', '')
    # Links: inline (optional <...> and title) and reference definitions ([id]: path).
    $pattern = if ($Imports) { '(?m)(?<![\w@./-])@(?<target>[A-Za-z0-9_~.][A-Za-z0-9_./~-]*\.[A-Za-z0-9]+)' }
    else { '\[[^\]]*\]\(\s*<?(?<target>[^)\s>]+)>?(?:\s+(?:"[^"]*"|''[^'']*''|\([^)]*\)))?\s*\)|(?m:^[ ]{0,3}\[[^\]]+\]:[ \t]*<?(?<target>[^\s>]+)>?)' }
    $directory = Split-Path -Parent $FilePath
    foreach ($match in [regex]::Matches($text, $pattern)) {
        $raw = ($match.Groups['target'].Value -split '[#?]')[0]
        if (-not $raw -or $raw -match '^[a-zA-Z][a-zA-Z0-9+.-]*:') { continue }
        $candidate = [IO.Path]::GetFullPath((Join-Path $directory ([uri]::UnescapeDataString($raw))))
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidate }
    }
}

function Get-AlwaysOnRoots([string]$Base) {
    $roots = [Collections.Generic.List[string]]::new()
    foreach ($relative in @('.github/copilot-instructions.md', 'copilot-instructions.md', 'AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md')) {
        $candidate = Join-Path $Base $relative
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $roots.Add([IO.Path]::GetFullPath($candidate)) }
    }
    foreach ($directory in @('.github/instructions', 'instructions')) {
        $instructionRoot = Join-Path $Base $directory
        if (-not (Test-Path -LiteralPath $instructionRoot -PathType Container)) { continue }
        foreach ($file in Get-ChildItem -LiteralPath $instructionRoot -Recurse -File -Filter '*.instructions.md' | Sort-Object FullName) {
            $applyTo = Get-FrontmatterValue (Get-FrontmatterText ([IO.File]::ReadAllText($file.FullName))) 'applyTo'
            if (@($applyTo -split ',' | ForEach-Object { $_.Trim().Trim("'").Trim('"') }) -contains '**') {
                $roots.Add($file.FullName)
            }
        }
    }
    return @($roots)
}

function Get-AlwaysOnClosure([string]$Base) {
    $visited = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $contentOwners = @{}
    $rows = [Collections.Generic.List[object]]::new()
    $queue = [Collections.Generic.Queue[object]]::new()
    foreach ($root in Get-AlwaysOnRoots $Base) { $queue.Enqueue([pscustomobject]@{ file = $root; via = $null; kind = 'root'; depth = 0 }) }
    while ($queue.Count -gt 0) {
        $node = $queue.Dequeue()
        if (-not $visited.Add($node.file)) { continue }
        $text = [IO.File]::ReadAllText($node.file).Replace("`r`n", "`n")
        $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text)))
        $relative = [IO.Path]::GetRelativePath($Base, $node.file).Replace('\', '/')
        # Hosts attach identical content once, so later copies cost nothing.
        $duplicateOf = if ($contentOwners.ContainsKey($hash)) { $contentOwners[$hash] } else { $contentOwners[$hash] = $relative; $null }
        $rows.Add([pscustomobject]@{
            path = $relative
            kind = $node.kind
            via = $node.via
            estimatedTokens = if ($duplicateOf) { 0 } else { Get-EstimatedTokens $text }
            duplicateOf = $duplicateOf
        })
        if ($duplicateOf -or $node.depth -ge 4) { continue }
        $isClaude = [IO.Path]::GetFileName($node.file) -eq 'CLAUDE.md' -or $node.kind -eq 'import'
        # Markdown links attach from instruction-type files; Claude files expand only @imports.
        $followsLinks = ($node.kind -eq 'root' -and -not $isClaude) -or ($node.kind -eq 'link' -and (Test-PromptTypeFile $node.file))
        if ($followsLinks) {
            foreach ($target in Get-ReferenceTargets $node.file) {
                $queue.Enqueue([pscustomobject]@{ file = $target; via = $relative; kind = 'link'; depth = $node.depth + 1 })
            }
        }
        if ($isClaude) {
            foreach ($target in Get-ReferenceTargets $node.file -Imports) {
                $queue.Enqueue([pscustomobject]@{ file = $target; via = $relative; kind = 'import'; depth = $node.depth + 1 })
            }
        }
    }
    return @($rows)
}

function Get-MetadataTier([string]$Base) {
    $kinds = [ordered]@{ skill = 'SKILL.md'; agent = '*.agent.md'; instruction = '*.instructions.md' }
    $totals = [ordered]@{}
    foreach ($kind in $kinds.Keys) {
        $count = 0
        $sum = [long]0
        foreach ($directory in @(".github/$($kind)s", "$($kind)s")) {
            $folder = Join-Path $Base $directory
            if (-not (Test-Path -LiteralPath $folder -PathType Container)) { continue }
            foreach ($file in Get-ChildItem -LiteralPath $folder -Recurse -File -Filter $kinds[$kind]) {
                $frontmatter = Get-FrontmatterText ([IO.File]::ReadAllText($file.FullName))
                $sum += Get-EstimatedTokens ((Get-FrontmatterValue $frontmatter 'name') + ' ' + (Get-FrontmatterValue $frontmatter 'description'))
                $count++
            }
        }
        $totals[$kind] = [pscustomobject]@{ files = $count; estimatedTokens = $sum }
    }
    $all = [long]0
    foreach ($entry in $totals.Values) { $all += $entry.estimatedTokens }
    return [pscustomobject]@{ estimatedTokens = $all; byKind = [pscustomobject]$totals }
}

function ConvertTo-GlobRegex([string]$Pattern) {
    $escaped = [regex]::Escape($Pattern.Replace('\', '/'))
    return '^' + $escaped.Replace('\*\*/', '(?:.*/)?').Replace('\*\*', '.*').
        Replace('\*', '[^/]*').Replace('\?', '[^/]') + '$'
}

function Get-BaselineTokenCount([string]$Root, [string]$Commit, [string]$Relative) {
    $entry = @(& git -C $Root ls-tree $Commit -- $Relative 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect baseline file '$Relative'." }
    if ($entry.Count -eq 0) { return 0 }
    $info = [Diagnostics.ProcessStartInfo]::new('git')
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    foreach ($argument in @('-C', $Root, 'show', "${Commit}:$Relative")) { $info.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::Start($info)
    try {
        $errorTask = $process.StandardError.ReadToEndAsync()
        $text = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw "Cannot read baseline file '$Relative': $($errorTask.Result)" }
        return [long][math]::Ceiling($text.Replace("`r`n", "`n").Length / 4.0)
    } finally { $process.Dispose() }
}

function Get-MarkdownFiles([string]$Target, [string]$Root) {
    $item = Get-Item -LiteralPath $Target -ErrorAction Stop
    if (-not $item.PSIsContainer) {
        if ($item.Extension -eq '.md') { $item }
        return
    }
    $excludedNames = @('.git', 'node_modules', 'vendor', 'out', 'dist', 'build', 'coverage', '.venv', '__pycache__')
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($item.FullName)
    while ($pending.Count) {
        $directory = $pending.Pop()
        foreach ($child in Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop) {
            if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            $relative = [IO.Path]::GetRelativePath($Root, $child.FullName).Replace('\', '/')
            if ($child.PSIsContainer) {
                if ($child.Name -in $excludedNames -or
                    $relative -match '^(vscode-extension/\.github|\.(agentx|hve|frontier)/(state|sessions|digests|issues|dreams))(/|$)') { continue }
                $pending.Push($child.FullName)
            } elseif ($child.Extension -eq '.md') {
                $child
            }
        }
    }
}

try {
    # Same order as the CLI; without an override, measure the tree this script ships in.
    $workspaceOverride = @($env:FRONTIER_WORKSPACE_ROOT, $env:HVE_WORKSPACE_ROOT, $env:AGENTX_WORKSPACE_ROOT) | Where-Object { $_ } | Select-Object -First 1
    $root = if ($workspaceOverride) {
        (Resolve-Path -LiteralPath $workspaceOverride -ErrorAction Stop).Path
    } else {
        (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }
    $target = if ($Path) {
        if ([IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $root $Path }
    } else { $root }
    $policyPath = Join-Path $root '.token-limits.json'
    $configured = Test-Path -LiteralPath $policyPath -PathType Leaf
    $rules = [Collections.Generic.List[object]]::new()
    if ($configured) {
        $policy = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json -Depth 10
        foreach ($group in @('defaults', 'overrides')) {
            if (-not $policy.PSObject.Properties[$group]) { continue }
            $values = $policy.$group
            if ($values -isnot [pscustomobject]) { throw "$group must be an object of path budgets." }
            foreach ($property in $values.PSObject.Properties) {
                if ($property.Value -isnot [long] -and $property.Value -isnot [int]) {
                    throw "Token limit '$($property.Name)' must be a positive integer."
                }
                if ($property.Value -le 0) { throw "Token limit '$($property.Name)' must be positive." }
                $pattern = $property.Name.Replace('\', '/')
                $rules.Add([pscustomobject]@{
                    pattern = $pattern
                    regex = ConvertTo-GlobRegex $pattern
                    limit = [long]$property.Value
                    exact = $group -eq 'overrides'
                })
            }
        }
    }
    if ($Action -eq 'context') {
        if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw 'context Path must be a directory.' }
        $base = (Resolve-Path -LiteralPath $target).Path
        $closure = @(Get-AlwaysOnClosure $base)
        $alwaysOnTokens = [long]0
        foreach ($row in $closure) { $alwaysOnTokens += $row.estimatedTokens }
        $metadata = Get-MetadataTier $base
        $budget = if ($configured -and $policy.PSObject.Properties['alwaysOn']) { $policy.alwaysOn } else { $null }
        $limits = [ordered]@{}
        foreach ($name in @('maxTokens', 'metadataMaxTokens')) {
            if (-not $budget -or -not $budget.PSObject.Properties[$name]) { $limits[$name] = $null; continue }
            $value = $budget.$name
            if (($value -isnot [long] -and $value -isnot [int]) -or $value -le 0) { throw "alwaysOn.$name must be a positive integer." }
            $limits[$name] = [long]$value
        }
        $over = @(
            if ($null -ne $limits.maxTokens -and $alwaysOnTokens -gt $limits.maxTokens) { "always-on closure $alwaysOnTokens > $($limits.maxTokens)" }
            if ($null -ne $limits.metadataMaxTokens -and $metadata.estimatedTokens -gt $limits.metadataMaxTokens) { "metadata tier $($metadata.estimatedTokens) > $($limits.metadataMaxTokens)" }
        )
        $contextResult = [ordered]@{
            status = if ($null -eq $limits.maxTokens) { 'unconfigured' } elseif ($over.Count) { 'exceeded' } else { 'within' }
            estimator = 'characters/4'
            model = 'Always-on roots plus files linked from instruction-type files and Claude @imports; identical content counted once.'
            base = $base
            alwaysOnTokens = $alwaysOnTokens
            linkedFiles = @($closure | Where-Object { $_.kind -ne 'root' -and -not $_.duplicateOf }).Count
            metadataTokens = $metadata.estimatedTokens
            metadata = $metadata.byKind
            limits = [pscustomobject]$limits
            violations = @($over)
            files = @($closure)
        }
        if ($Json) {
            Write-Output ($contextResult | ConvertTo-Json -Depth 8 -Compress)
        } else {
            Write-Host 'Always-on Context Budget (approximate: characters/4, not provider billing)'
            foreach ($row in $closure | Sort-Object estimatedTokens -Descending) {
                $source = if ($row.via) { "  <- $($row.via)" } else { '' }
                $note = if ($row.duplicateOf) { "  (duplicate of $($row.duplicateOf))" } else { '' }
                Write-Host ("  {0,7} {1,-6} {2}{3}{4}" -f $row.estimatedTokens, $row.kind, $row.path, $source, $note)
            }
            Write-Host "Always-on: $alwaysOnTokens estimated tokens (limit: $($limits.maxTokens)); metadata tier: $($metadata.estimatedTokens) (limit: $($limits.metadataMaxTokens))"
            if ($contextResult.status -eq 'unconfigured') { Write-Host '[WARN] No alwaysOn.maxTokens budget; this is not a verified budget pass.' }
            foreach ($violation in $over) { Write-Host "[FAIL] $violation" }
            if ($contextResult.status -eq 'within') { Write-Host '[PASS] Always-on context within budget.' }
        }
        exit $(if ($over.Count) { 1 } else { 0 })
    }
    $files = @(Get-MarkdownFiles $target $root | Sort-Object FullName)
    $baselineCommit = ''
    if ($BaselineRef) {
        $revision = @(& git -C $root rev-parse --verify --end-of-options "${BaselineRef}^{commit}" 2>$null)
        if ($LASTEXITCODE -ne 0 -or $revision.Count -ne 1) { throw 'BaselineRef must resolve to a Git commit.' }
        $baselineCommit = [string]$revision[0]
    }
    $rows = @(
        foreach ($file in $files) {
            $relative = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
            $match = $rules | Where-Object {
                if ($_.exact) { $_.pattern -ceq $relative } else { $relative -cmatch $_.regex }
            } | Sort-Object @{ Expression = 'exact'; Descending = $true },
                @{ Expression = { $_.pattern.Length }; Descending = $true }, pattern | Select-Object -First 1
            $content = [IO.File]::ReadAllText($file.FullName).Replace("`r`n", "`n")
            $tokens = [long][math]::Ceiling($content.Length / 4.0)
            $limit = if ($match) { $match.limit } else { $null }
            [pscustomobject]@{
                path = $relative
                estimatedTokens = $tokens
                limit = $limit
                over = if ($null -ne $limit) { [math]::Max(0, $tokens - $limit) } else { $null }
            }
        }
    )
    $covered = @($rows | Where-Object { $null -ne $_.limit })
    $violations = @($covered | Where-Object { $_.over -gt 0 })
    $uncovered = @($rows | Where-Object { $null -eq $_.limit } | ForEach-Object { $_.path })
    $regressions = @(
        foreach ($row in $violations) {
            if (-not $baselineCommit) { $row; continue }
            # Use the same policy and estimator for both revisions. Do not hide
            # inherited overages when a caller requests a no-regression gate.
            $oldTokens = Get-BaselineTokenCount $root $baselineCommit $row.path
            if ($row.estimatedTokens -gt $oldTokens) { $row }
        }
    )
    $sum = [long]0
    foreach ($row in $rows) { $sum += $row.estimatedTokens }
    $result = [ordered]@{
        status = if (-not $configured -or $rules.Count -eq 0) { 'unconfigured' }
            elseif ($violations.Count) { 'exceeded' } elseif ($covered.Count -eq 0) { 'uncovered' } else { 'within' }
        estimator = 'characters/4'
        newlineNormalization = 'LF'
        exact = $false
        scannedFiles = $rows.Count
        checkedFiles = $covered.Count
        totalEstimatedTokens = $sum
        violations = $violations
        regressions = $regressions
        baselineCommit = if ($baselineCommit) { $baselineCommit } else { $null }
        uncoveredFiles = $uncovered
        files = $rows
    }
    if ($Json) {
        Write-Output ($result | ConvertTo-Json -Depth 8 -Compress)
    } else {
        Write-Host 'Token Budget Report (approximate: characters/4, not provider billing)'
        if ($Action -eq 'count') {
            foreach ($row in $rows) { Write-Host ("  {0,7} estimated tokens  {1}" -f $row.estimatedTokens, $row.path) }
        }
        Write-Host "Scanned: $($rows.Count); budgeted: $($covered.Count); uncovered: $($uncovered.Count)"
        Write-Host "Total estimated tokens: $($result.totalEstimatedTokens); status: $($result.status)"
        if ($result.status -in @('unconfigured', 'uncovered')) {
            Write-Host '[WARN] No applicable limits; this is not a verified budget pass.'
        } elseif ($violations.Count -eq 0) {
            Write-Host "[PASS] All $($covered.Count) covered files within token limits."
        }
        foreach ($row in $violations) {
            Write-Host "[FAIL] $($row.path): $($row.estimatedTokens) estimated tokens (limit: $($row.limit), over: $($row.over))"
        }
        if ($baselineCommit) {
            Write-Host "No-regression gate: $($regressions.Count) increased/new overages; $($violations.Count) total overages remain."
        }
    }
    exit $(if ($Action -eq 'check' -and $regressions.Count) { 1 } else { 0 })
} catch {
    if ($Json) {
        Write-Output (@{ status = 'invalid'; message = $_.Exception.Message } | ConvertTo-Json -Compress)
    } else {
        [Console]::Error.WriteLine("[FAIL] Token budget: $($_.Exception.Message)")
    }
    exit 2
}
