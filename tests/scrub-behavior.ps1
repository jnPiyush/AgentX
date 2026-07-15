#!/usr/bin/env pwsh
# AgentX scrub behavior tests

$ErrorActionPreference = 'Stop'
$script:root = Split-Path $PSScriptRoot -Parent
$script:pass = 0
$script:fail = 0

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Invoke-ScrubJson {
    param([string]$Path, [switch]$Production, [switch]$Fix)

    $args = @('-NoProfile', '-File', (Join-Path $script:root 'scripts/scrub.ps1'), '-Path', $Path, '-Json')
    if ($Production) { $args += '-Production' }
    if ($Fix) { $args += @('-Fix', '-Quiet') }
    $output = & pwsh @args 2>&1
    $exitCode = $LASTEXITCODE
    $json = ($output | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json }
}

function Invoke-AgentXScrubJson {
    param([string]$Command, [string]$Path, [switch]$Production)

    $args = @('-NoProfile', '-File', (Join-Path $script:root '.agentx/agentx.ps1'), $Command, '-Path', $Path, '-Json')
    if ($Production) { $args += '-Production' }
    $output = & pwsh @args 2>&1
    $exitCode = $LASTEXITCODE
    $json = ($output | Out-String).Trim()
    $findings = if ([string]::IsNullOrWhiteSpace($json)) { @() } else { @($json | ConvertFrom-Json) }
    return [pscustomobject]@{ exitCode = $exitCode; findings = $findings; raw = $json }
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agentx-scrub-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    Write-Host ""
    Write-Host " AgentX Scrub Behavior Tests" -ForegroundColor Cyan
    Write-Host " ================================================" -ForegroundColor DarkGray
    Write-Host ""

    $deadCodeFile = Join-Path $tempRoot 'dead-code.ts'
    @'
export function activeValue(enabled: boolean): number {
    // if (enabled) {
    //   const value = 42;
    //   return value;
    // }
    return enabled ? 1 : 0;
}
'@ | Set-Content -LiteralPath $deadCodeFile -Encoding utf8

    $deadCodeResult = Invoke-ScrubJson -Path $deadCodeFile
    $deadCodeFindings = @($deadCodeResult.findings | Where-Object { $_.category -eq 'dead-code' })
    Assert-True ($deadCodeResult.exitCode -eq 1) 'Dead-code findings fail the scrub gate as HIGH severity'
    Assert-True ($deadCodeFindings.Count -eq 4) 'Commented-out code block reports each removable line'
    Assert-True (($deadCodeFindings | Where-Object { $_.severity -ne 'HIGH' -or -not $_.safeFix }).Count -eq 0) 'Dead-code findings are HIGH safe-fix findings'

    $fixFile = Join-Path $tempRoot 'dead-code-fix.ts'
    Copy-Item -LiteralPath $deadCodeFile -Destination $fixFile
    & pwsh -NoProfile -File (Join-Path $script:root 'scripts/scrub.ps1') -Path $fixFile -Fix -Quiet *> $null
    Assert-True ($LASTEXITCODE -eq 0) 'Dead-code safe-fix mode exits successfully'
    $fixedContent = Get-Content -LiteralPath $fixFile -Raw
    Assert-True (-not ($fixedContent -match '// if \(enabled\)')) 'Dead-code safe-fix removes commented-out code lines'

    $blockDeadCodeFile = Join-Path $tempRoot 'block-dead-code.ts'
    @'
export function activeValue(enabled: boolean): number {
    /*
    if (enabled) {
      const value = 42;
      return value;
    }
    */
    return enabled ? 1 : 0;
}
'@ | Set-Content -LiteralPath $blockDeadCodeFile -Encoding utf8

    $blockDeadCodeResult = Invoke-ScrubJson -Path $blockDeadCodeFile
    $blockDeadCodeFindings = @($blockDeadCodeResult.findings | Where-Object { $_.category -eq 'dead-code' })
    Assert-True ($blockDeadCodeResult.exitCode -eq 1) 'Block-comment dead-code findings fail the scrub gate as HIGH severity'
    Assert-True ($blockDeadCodeFindings.Count -eq 6) 'Block-comment dead code reports the full removable block'

    $duplicateFile = Join-Path $tempRoot 'duplicate.ts'
    @'
export function firstTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}

export function secondTotal(subtotal: number): number {
    const tax = subtotal * 0.1;
    const shipping = subtotal > 50 ? 0 : 5;
    const discount = subtotal > 100 ? 10 : 0;
    const total = subtotal + tax + shipping - discount;
    return Math.round(total);
}
'@ | Set-Content -LiteralPath $duplicateFile -Encoding utf8

    $duplicateResult = Invoke-ScrubJson -Path $duplicateFile
    $duplicateFindings = @($duplicateResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($duplicateResult.exitCode -eq 0) 'Duplicate-logic findings are advisory and do not fail the scrub gate'
    Assert-True ($duplicateFindings.Count -ge 1) 'Repeated normalized code block reports duplicate logic'
    Assert-True (($duplicateFindings | Where-Object { $_.severity -ne 'MEDIUM' -or $_.safeFix }).Count -eq 0) 'Duplicate-logic findings are MEDIUM flag-only findings'

    $duplicateProductionResult = Invoke-ScrubJson -Path $duplicateFile -Production
    $duplicateProductionFindings = @($duplicateProductionResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($duplicateProductionResult.exitCode -eq 1) 'Duplicate-logic findings fail the production scrub gate'
    Assert-True (($duplicateProductionFindings | Where-Object { -not $_.productionBlocker }).Count -eq 0) 'Duplicate-logic findings are marked as production blockers'

    $duplicateProductionFixResult = Invoke-ScrubJson -Path $duplicateFile -Production -Fix
    Assert-True ($duplicateProductionFixResult.exitCode -eq 1) 'Production scrub with safe fixes still fails when flag-only blockers remain'

    $deslopAliasResult = Invoke-AgentXScrubJson -Command 'deslop' -Path $duplicateFile -Production
    $antislopAliasResult = Invoke-AgentXScrubJson -Command 'antislop' -Path $duplicateFile -Production
    Assert-True ($deslopAliasResult.exitCode -eq 1) 'AgentX deslop alias routes to the production scrub gate'
    Assert-True ($antislopAliasResult.exitCode -eq 1) 'AgentX antislop alias routes to the production scrub gate'

    $emptyCatchFile = Join-Path $tempRoot 'empty-catch.ts'
    @'
export function parseValue(raw: string): number {
    try {
        return Number.parseInt(raw, 10);
    } catch (error) { }
    return 0;
}
'@ | Set-Content -LiteralPath $emptyCatchFile -Encoding utf8

    $emptyCatchResult = Invoke-ScrubJson -Path $emptyCatchFile
    $emptyCatchFindings = @($emptyCatchResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($emptyCatchResult.exitCode -eq 0) 'Empty-catch findings are advisory in normal scrub mode'
    Assert-True ($emptyCatchFindings.Count -eq 1) 'Empty-catch scanner reports swallowed exception blocks'

    $emptyCatchProductionResult = Invoke-ScrubJson -Path $emptyCatchFile -Production
    $emptyCatchProductionFindings = @($emptyCatchProductionResult.findings | Where-Object { $_.category -eq 'empty-catch' })
    Assert-True ($emptyCatchProductionResult.exitCode -eq 1) 'Empty-catch findings fail the production scrub gate'
    Assert-True (($emptyCatchProductionFindings | Where-Object { -not $_.productionBlocker }).Count -eq 0) 'Empty-catch findings are marked as production blockers'

    $declarativeFile = Join-Path $tempRoot 'declarative.ps1'
    @'
$Names = @(
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon'
)
'@ | Set-Content -LiteralPath $declarativeFile -Encoding utf8

    $declarativeResult = Invoke-ScrubJson -Path $declarativeFile
    $declarativeDuplicateFindings = @($declarativeResult.findings | Where-Object { $_.category -eq 'duplicate-logic' })
    Assert-True ($declarativeDuplicateFindings.Count -eq 0) 'Duplicate-logic ignores repeated string-list data'
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host " Results: $script:pass passed, $script:fail failed" -ForegroundColor Cyan

if ($script:fail -gt 0) { exit 1 }
exit 0