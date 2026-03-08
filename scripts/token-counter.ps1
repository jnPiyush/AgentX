#!/usr/bin/env pwsh
# Token Counter - Count and validate tokens against .token-limits.json
# Usage:
#   .\scripts\token-counter.ps1 -Action count [-Path .github/skills/]
#   .\scripts\token-counter.ps1 -Action check
#   .\scripts\token-counter.ps1 -Action report
#Requires -Version 7.0
param(
    [ValidateSet('count','check','report')]
    [string]$Action = 'report',
    [string]$Path = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LIMITS_FILE = Join-Path $ROOT '.token-limits.json'

function Get-TokenCount([string]$filePath) {
    if (-not (Test-Path $filePath)) { return 0 }
    $chars = (Get-Content $filePath -Raw -Encoding utf8).Length
    return [math]::Ceiling($chars / 4)
}

function Get-TokenLimits {
    if (-not (Test-Path $LIMITS_FILE)) {
        Write-Warning "No .token-limits.json found at $LIMITS_FILE"
        return @{}
    }
    $cfg = Get-Content $LIMITS_FILE -Raw -Encoding utf8 | ConvertFrom-Json
    return $cfg
}

function Resolve-LimitForFile([string]$relPath, $limits) {
    $normalized = $relPath -replace '\\', '/'
    # Check overrides first (exact path match)
    if ($limits.overrides) {
        foreach ($prop in $limits.overrides.PSObject.Properties) {
            $overridePath = $prop.Name -replace '\\', '/'
            if ($normalized -eq $overridePath) {
                return [int]$prop.Value
            }
        }
    }
    # Fall back to glob defaults
    $defaults = $limits.defaults
    if (-not $defaults) { return 0 }
    $best = 0
    $bestLen = 0
    foreach ($prop in $defaults.PSObject.Properties) {
        $pattern = $prop.Name
        $limit = [int]$prop.Value
        $regex = '^' + (($pattern -replace '\*\*/', '(.*/)?') -replace '\*', '[^/]*') + '$'
        if ($normalized -match $regex -and $pattern.Length -gt $bestLen) {
            $best = $limit
            $bestLen = $pattern.Length
        }
    }
    return $best
}

function Invoke-Count {
    $target = if ($Path) { Resolve-Path $Path } else { $ROOT }
    $files = Get-ChildItem -Path $target -Filter '*.md' -Recurse -File
    $total = 0
    foreach ($f in $files) {
        $tokens = Get-TokenCount $f.FullName
        $total += $tokens
        Write-Host ("  {0,6} tokens  {1}" -f $tokens, $f.FullName.Replace($ROOT, '.'))
    }
    Write-Host "`n  Total: $total tokens across $($files.Count) files"
}

function Invoke-Check {
    $limits = Get-TokenLimits
    if (-not $limits.defaults) { Write-Host "No limits configured."; return }
    $violations = @()
    $checked = 0
    $mdFiles = Get-ChildItem -Path $ROOT -Filter '*.md' -Recurse -File |
        Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]|[\\/]\.git[\\/]' }

    foreach ($f in $mdFiles) {
        $rel = $f.FullName.Replace($ROOT, '').TrimStart('\', '/')
        $limit = Resolve-LimitForFile $rel $limits
        if ($limit -le 0) { continue }
        $checked++
        $tokens = Get-TokenCount $f.FullName
        if ($tokens -gt $limit) {
            $violations += [PSCustomObject]@{
                File = $rel
                Tokens = $tokens
                Limit = $limit
                Over = $tokens - $limit
            }
        }
    }
    if ($violations.Count -eq 0) {
        Write-Host "`n  [PASS] All $checked files within token limits.`n"
    } else {
        Write-Host "`n  [FAIL] $($violations.Count) file(s) exceed token limits:`n"
        foreach ($v in $violations) {
            Write-Host ("  {0}: {1} tokens (limit: {2}, over by {3})" -f $v.File, $v.Tokens, $v.Limit, $v.Over)
        }
        Write-Host ''
        exit 1
    }
}

function Invoke-Report {
    $limits = Get-TokenLimits
    Write-Host "`n  Token Budget Report"
    Write-Host "  ============================================="
    $categories = @(
        @{ Label = 'Skills (SKILL.md)'; Pattern = '.github/skills/**/SKILL.md'; Dir = '.github/skills' ; Filter = 'SKILL.md' },
        @{ Label = 'Instructions'; Pattern = '.github/instructions/*.md'; Dir = '.github/instructions' ; Filter = '*.md' },
        @{ Label = 'Agents (external)'; Pattern = '.github/agents/*.agent.md'; Dir = '.github/agents' ; Filter = '*.agent.md' },
        @{ Label = 'Templates'; Pattern = '.github/templates/*-TEMPLATE.md'; Dir = '.github/templates' ; Filter = '*-TEMPLATE.md' }
    )
    foreach ($cat in $categories) {
        $dir = Join-Path $ROOT $cat.Dir
        if (-not (Test-Path $dir)) { continue }
        $files = Get-ChildItem -Path $dir -Filter $cat.Filter -Recurse -File
        $totalTokens = 0; $overCount = 0
        foreach ($f in $files) {
            $tokens = Get-TokenCount $f.FullName
            $totalTokens += $tokens
            $rel = $f.FullName.Replace($ROOT, '').TrimStart('\', '/')
            $limit = Resolve-LimitForFile $rel $limits
            if ($limit -gt 0 -and $tokens -gt $limit) { $overCount++ }
        }
        $status = if ($overCount -gt 0) { "[WARN] $overCount over" } else { '[PASS]' }
        Write-Host ("  {0,-25} {1,5} files  {2,7} tokens  {3}" -f $cat.Label, $files.Count, $totalTokens, $status)
    }
    Write-Host "  =============================================`n"
}

switch ($Action) {
    'count'  { Invoke-Count }
    'check'  { Invoke-Check }
    'report' { Invoke-Report }
}
