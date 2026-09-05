#!/usr/bin/env pwsh
#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('count', 'check', 'report')]
    [string]$Action = 'report',
    [string]$Path = '',
    [string]$BaselineRef = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
                    $relative -match '^(vscode-extension/\.github|\.agentx/(state|sessions|digests|issues))(/|$)') { continue }
                $pending.Push($child.FullName)
            } elseif ($child.Extension -eq '.md') {
                $child
            }
        }
    }
}

try {
    $root = if ($env:AGENTX_WORKSPACE_ROOT) {
        (Resolve-Path -LiteralPath $env:AGENTX_WORKSPACE_ROOT -ErrorAction Stop).Path
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
