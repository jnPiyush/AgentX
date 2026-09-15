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

$cliPath = Join-Path $script:repoRoot '.agentx/agentx-cli.ps1'
$parseTokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($cliPath, [ref]$parseTokens, [ref]$parseErrors)
foreach ($definition in $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -in @('Get-LoopTaskClass', 'Get-LoopIterationGuidance')
}, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}

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

foreach ($role in @('frontier', 'frontier-auto', 'Frontier Orchestration FDE')) {
    Assert-Equal (Get-LoopTaskClass ([PSCustomObject]@{ role=$role; prompt='Fix a typo' })) `
        'agent-x' "$role preserves the orchestrator classification"
}

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

foreach ($entry in @{ standard=1; 'auto-fix-review'=2; 'complex-delivery'=3; 'agent-x'=3; 'high-risk'=5 }.GetEnumerator()) {
    $guidance = @(Get-LoopIterationGuidance $entry.Key)
    Assert-Equal $guidance.Count $entry.Value "$($entry.Key) guidance matches its risk minimum"
    Assert-Equal $guidance[0].n 1 "$($entry.Key) starts at iteration one"
    Assert-Match $guidance[-1].focus 'Review|Decision' "$($entry.Key) ends with independent review"
}

# ---------------------------------------------------------------------------
# 5. loop rollback - happy path via CLI (requires a live active loop state)
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 5. loop rollback -- happy path' -ForegroundColor White

$workspaceRoot = Join-Path ([IO.Path]::GetTempPath()) "frontier-rollback-$([guid]::NewGuid())"
[IO.Directory]::CreateDirectory($workspaceRoot) | Out-Null
$loopStateFile = Join-Path $workspaceRoot '.frontier/state/loop-state.json'

function Invoke-TestCli([string[]]$CliArguments) {
    $startInfo = [Diagnostics.ProcessStartInfo]::new((Get-Command pwsh).Source)
    $startInfo.WorkingDirectory = $workspaceRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Environment['FRONTIER_WORKSPACE_ROOT'] = $workspaceRoot
    foreach ($argument in @('-NoProfile', '-File', $cliPath) + $CliArguments) {
        $startInfo.ArgumentList.Add($argument)
    }
    $process = [Diagnostics.Process]::Start($startInfo)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        return [PSCustomObject]@{ ExitCode=$process.ExitCode; Output=$stdout.Result + $stderr.Result }
    } finally { $process.Dispose() }
}

try {

Assert-Equal (Invoke-TestCli @('loop','start','-p','Fix a typo','-r','frontier')).ExitCode 0 'isolated loop starts'
$startedState = Get-Content $loopStateFile -Raw | ConvertFrom-Json
Assert-Equal $startedState.minIterations 3 'Frontier CLI start enforces three iterations'
foreach ($iteration in 1..5) {
    $evidencePath = Join-Path $workspaceRoot "evidence-$iteration.txt"
    Set-Content $evidencePath "Fresh fixture evidence $iteration"
    $result = Invoke-TestCli @('loop','iterate','-s',"Pass $iteration",'-e',$evidencePath)
    Assert-Equal $result.ExitCode 0 "isolated iteration $iteration succeeds"
}
$testState = Get-Content $loopStateFile -Raw

# Run rollback
$rollback = Invoke-TestCli @('loop','rollback','-n','3','-r','regression-test')
Assert-Equal $rollback.ExitCode 0 'rollback exits successfully'
$rollbackOut = $rollback.Output
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

$statusOut = (Invoke-TestCli @('loop','status')).Output
Assert-Match $statusOut 'Current focus \(iteration 3\)' 'loop status shows iteration 3 focus (not 2) after rollback to 3'
Assert-Match $statusOut 'Independent Review' 'loop status resumes the orchestrator review focus'

# ---------------------------------------------------------------------------
# 7. loop rollback - guard-rails
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ' 7. loop rollback -- guard-rails' -ForegroundColor White

# Out-of-range: target > current (current is now iter 2 on the counter,
# but the loop is active and last entry is iter 3 rollback).
# Reset to iter 5 first so we have room to test guard-rails.
$testState | Set-Content $loopStateFile -Encoding utf8

$outHigh = Invoke-TestCli @('loop','rollback','-n','99')
Assert-Equal $outHigh.ExitCode 1 'out-of-range rollback fails'
Assert-Match $outHigh.Output '\[FAIL\]' 'rollback -n 99 fails with [FAIL] message'

$outSame = Invoke-TestCli @('loop','rollback','-n','5')
Assert-Match $outSame.Output '\[WARN\]' 'rollback to same iteration produces [WARN]'

$outNoN = Invoke-TestCli @('loop','rollback')
Assert-Equal $outNoN.ExitCode 1 'rollback without a target fails'
Assert-Match $outNoN.Output '\[FAIL\]' 'rollback with no -n flag produces [FAIL] usage error'

} finally {
    Remove-Item -LiteralPath $workspaceRoot -Recurse -Force
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
