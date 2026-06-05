#!/usr/bin/env pwsh
# Loop Rollback Behavior Tests
# Covers: Get-LoopTaskClass (role + keyword), Get-LoopIterationGuidance,
#         loop rollback happy-path + guard-rails, post-rollback loop status focus.
# Usage: pwsh tests/loop-rollback-behavior.ps1

$ErrorActionPreference = 'Stop'
$script:pass = 0
$script:fail = 0
$script:repoRoot = Split-Path $PSScriptRoot -Parent

function Assert-True($condition, $message) {
    if ($condition) {
        Write-Host " [PASS] $message" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host " [FAIL] $message" -ForegroundColor Red
        $script:fail++
    }
}

function Assert-Equal($actual, $expected, $message) {
    Assert-True ($actual -eq $expected) "$message (expected: '$expected', actual: '$actual')"
}

function Assert-Match($text, $pattern, $message) {
    Assert-True ($text -match $pattern) "$message (pattern: '$pattern' not found in output)"
}

. (Join-Path $script:repoRoot '.agentx\agentx-cli.ps1')

Write-Host ''
Write-Host ' Loop Rollback Behavior Tests' -ForegroundColor Cyan
Write-Host ' ================================================' -ForegroundColor DarkGray
Write-Host ''

# ---------------------------------------------------------------------------
# 1. Get-LoopTaskClass - role-based resolution
# ---------------------------------------------------------------------------
Write-Host ' 1. Get-LoopTaskClass -- role-based' -ForegroundColor White

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='auto-fix-reviewer'; prompt=''; taskClass='' })) `
    'auto-fix-review' 'role=auto-fix-reviewer resolves to auto-fix-review'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='reviewer-auto'; prompt=''; taskClass='' })) `
    'auto-fix-review' 'role=reviewer-auto resolves to auto-fix-review'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='agent-x'; prompt=''; taskClass='' })) `
    'agent-x' 'role=agent-x resolves to agent-x'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='agentx'; prompt=''; taskClass='' })) `
    'agent-x' 'role=agentx resolves to agent-x'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='engineer'; prompt=''; taskClass='' })) `
    'complex-delivery' 'role=engineer resolves to complex-delivery'

# ---------------------------------------------------------------------------
# 2. Get-LoopTaskClass - explicit taskClass takes precedence over role
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 2. Get-LoopTaskClass -- taskClass field takes precedence' -ForegroundColor White

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role='engineer'; taskClass='standard'; prompt='' })) `
    'standard' 'explicit taskClass=standard overrides role=engineer'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=''; taskClass='auto-fix-review'; prompt='' })) `
    'auto-fix-review' 'explicit taskClass=auto-fix-review returned as-is'

# ---------------------------------------------------------------------------
# 3. Get-LoopTaskClass - keyword detection in prompt
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 3. Get-LoopTaskClass -- keyword detection' -ForegroundColor White

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=''; taskClass=''; prompt='Review code and apply safe fixes for issue #5' })) `
    'auto-fix-review' 'prompt with "apply safe fixes" detects auto-fix-review'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=''; taskClass=''; prompt='autonomous orchestration of specialist agents' })) `
    'agent-x' 'prompt with "autonomous" detects agent-x'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=''; taskClass=''; prompt='Implement the health endpoint feature' })) `
    'complex-delivery' 'prompt with "implement" detects complex-delivery'

Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=''; taskClass=''; prompt='Fix bug in login timeout' })) `
    'standard' 'prompt with "bug" detects standard'

# ---------------------------------------------------------------------------
# 4. Get-LoopIterationGuidance - table shape
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 4. Get-LoopIterationGuidance -- table shape' -ForegroundColor White

$g = Get-LoopIterationGuidance 'complex-delivery'
Assert-Equal $g.Count 5 'complex-delivery guidance has 5 entries'
Assert-Equal $g[0].n 1 'complex-delivery iter 1 has n=1'
Assert-Equal $g[4].n 5 'complex-delivery iter 5 has n=5'
Assert-Match $g[4].gate 'rollback' 'complex-delivery iter 5 gate references rollback'

$ga = Get-LoopIterationGuidance 'auto-fix-review'
Assert-Equal $ga.Count 5 'auto-fix-review guidance has 5 entries'
Assert-Match $ga[4].gate 'rollback' 'auto-fix-review iter 5 gate references rollback'

$gx = Get-LoopIterationGuidance 'agent-x'
Assert-Equal $gx.Count 5 'agent-x guidance has 5 entries'
Assert-Match $gx[4].gate 'rollback' 'agent-x iter 5 gate references rollback'

$gs = @(Get-LoopIterationGuidance 'standard')
Assert-Equal $gs.Count 5 'standard guidance has 5 entries'
Assert-Match $gs[4].focus 'Subagent Review' 'standard iter 5 focus references subagent review'

# ---------------------------------------------------------------------------
# 5. loop rollback - happy path via CLI (requires a live active loop state)
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 5. loop rollback -- happy path' -ForegroundColor White

$loopStateFile = Join-Path $script:repoRoot '.agentx\state\loop-state.json'
$backup = Get-Content $loopStateFile -Raw -ErrorAction SilentlyContinue

try {

$testState = [PSCustomObject]@{
    active=$true; status='active'
    prompt='Regression test loop'; role='engineer'; taskClass='complex-delivery'
    iteration=5; minIterations=5; maxIterations=20
    completionCriteria='ALL_TESTS_PASSING'
    issueNumber=$null; budgetMinutes=$null
    startedAt='2026-01-01T00:00:00Z'; lastIterationAt='2026-01-01T00:01:00Z'
    history=@(
        [PSCustomObject]@{iteration=1;timestamp='2026-01-01T00:00:00Z';summary='i1';status='in-progress';outcome='partial'}
        [PSCustomObject]@{iteration=2;timestamp='2026-01-01T00:00:10Z';summary='i2';status='in-progress';outcome='partial';passingTests=10}
        [PSCustomObject]@{iteration=3;timestamp='2026-01-01T00:00:20Z';summary='i3';status='in-progress';outcome='partial';passingTests=10}
        [PSCustomObject]@{iteration=4;timestamp='2026-01-01T00:00:30Z';summary='i4';status='in-progress';outcome='partial';passingTests=10}
        [PSCustomObject]@{iteration=5;timestamp='2026-01-01T00:00:40Z';summary='i5';status='in-progress';outcome='partial';passingTests=10}
    )
}
$testState | ConvertTo-Json -Depth 10 | Set-Content $loopStateFile -Encoding utf8

# Run rollback
$rollbackOut = & (Join-Path $script:repoRoot '.agentx\agentx.ps1') loop rollback -n 3 -r 'regression-test' *>&1 | Out-String
Assert-Match $rollbackOut 'Loop rolled back' 'rollback output confirms roll-back occurred'
Assert-Match $rollbackOut 'iteration 5 -> 3' 'rollback output shows correct from/to transition'
Assert-Match $rollbackOut 'Resume focus \(iteration 3\)' 'rollback output shows target iteration focus'

# Verify state file was updated
$afterRollback = Get-Content $loopStateFile -Raw | ConvertFrom-Json
Assert-Equal ([int]$afterRollback.iteration) 2 'state.iteration is target-1 (=2) after rollback to 3'
$lastHistory = @($afterRollback.history)[-1]
Assert-Equal $lastHistory.status 'rollback' 'last history entry status is rollback'
Assert-Equal ([int]$lastHistory.iteration) 3 'last history entry records target iteration 3'

# ---------------------------------------------------------------------------
# 6. loop status after rollback shows CORRECT focus (the regression case)
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 6. loop status after rollback -- shows target iteration focus (regression)' -ForegroundColor White

$statusOut = & (Join-Path $script:repoRoot '.agentx\agentx.ps1') loop status *>&1 | Out-String
Assert-Match $statusOut 'Current focus \(iteration 3\)' 'loop status shows iteration 3 focus (not 2) after rollback to 3'
Assert-Match $statusOut 'Make it Secure' 'loop status focus text is Make it Secure for complex-delivery iter 3'

# ---------------------------------------------------------------------------
# 7. loop rollback - guard-rails
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 7. loop rollback -- guard-rails' -ForegroundColor White

# Out-of-range: target > current (current is now iter 2 on the counter,
# but the loop is active and last entry is iter 3 rollback).
# Reset to iter 5 first so we have room to test guard-rails.
$testState | ConvertTo-Json -Depth 10 | Set-Content $loopStateFile -Encoding utf8

$outHigh = & (Join-Path $script:repoRoot '.agentx\agentx.ps1') loop rollback -n 99 *>&1 | Out-String
Assert-Match $outHigh '\[FAIL\]' 'rollback -n 99 fails with [FAIL] message'

$outSame = & (Join-Path $script:repoRoot '.agentx\agentx.ps1') loop rollback -n 5 *>&1 | Out-String
Assert-Match $outSame '\[WARN\]' 'rollback to same iteration produces [WARN]'

$outNoN = & (Join-Path $script:repoRoot '.agentx\agentx.ps1') loop rollback *>&1 | Out-String
Assert-Match $outNoN '\[FAIL\]' 'rollback with no -n flag produces [FAIL] usage error'

} finally {
    # ---------------------------------------------------------------------------
    # Restore production loop state (always runs, even if a test assertion throws)
    # ---------------------------------------------------------------------------
    if ($backup) {
        $backup | Set-Content $loopStateFile -Encoding utf8
    } else {
        Remove-Item $loopStateFile -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host " ------------------------------------------------" -ForegroundColor DarkGray
$total = $script:pass + $script:fail
Write-Host " Results: $($script:pass)/$total passed" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
Write-Host ''
if ($script:fail -gt 0) { exit 1 }
