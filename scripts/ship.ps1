#requires -Version 7.0
<#
.SYNOPSIS
  One-command pipeline orchestrator. Run plan -> work -> review -> scrub ->
  test -> compound on a single issue, gating each step on durable evidence
  from the previous step. Retries each step once on failure.

.DESCRIPTION
  Ship is a thin orchestrator over existing CLI subcommands. Each step:
   1. Records the active workflow phase via 'agentx state'
   2. Performs its work or invokes the appropriate validator
   3. Verifies the gate condition before advancing
   4. On failure, retries once; if still failing, stops and reports

.PARAMETER Issue
  Issue number to ship.

.PARAMETER From
  Starting step. Defaults to 'plan'. One of: plan, work, review, scrub,
  test, compound.

.PARAMETER To
  Ending step (inclusive). Defaults to 'compound'.

.PARAMETER SkipScrub
  DEPRECATED and IGNORED. Scrub is mandatory on every run. This switch is kept
  only for backward compatibility with existing callers; passing it logs a
  warning and scrub still runs.

.PARAMETER DryRun
  Print the plan without executing.

.EXAMPLE
  pwsh scripts/ship.ps1 -Issue 42

.EXAMPLE
  pwsh scripts/ship.ps1 -Issue 42 -From review -To compound
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [int]$Issue,
    [ValidateSet('plan','work','review','scrub','test','compound')] [string]$From = 'plan',
    [ValidateSet('plan','work','review','scrub','test','compound')] [string]$To = 'compound',
    [switch]$SkipScrub,
    [switch]$DryRun,
    [switch]$Parallel
)

$ErrorActionPreference = 'Continue'

$Order = @('plan','work','review','scrub','test','compound')
$fromIdx = [array]::IndexOf($Order, $From)
$toIdx   = [array]::IndexOf($Order, $To)
if ($fromIdx -lt 0 -or $toIdx -lt 0 -or $toIdx -lt $fromIdx) { throw "Invalid step range: $From -> $To" }

$AgentXCli = Join-Path (Resolve-Path .).Path '.agentx/agentx.ps1'
if (-not (Test-Path $AgentXCli)) { throw "agentx CLI not found at $AgentXCli" }

function Invoke-AgentX {
    param([string[]]$Args)
    & pwsh -NoProfile -File $AgentXCli @Args
    return $LASTEXITCODE
}

function Set-Phase {
    param([string]$Agent)
    Invoke-AgentX -Args @('state','-a',$Agent,'-s','working','-i',[string]$Issue) | Out-Null
}

function Test-PlanArtifact {
    $cands = @(
        Get-ChildItem -Path 'docs/execution/plans' -Filter "*$Issue*" -ErrorAction SilentlyContinue
    )
    return ($cands.Count -gt 0)
}

function Test-ReviewArtifact {
    $cands = @(
        Get-ChildItem -Path 'docs/artifacts/reviews' -Filter "*REVIEW*$Issue*" -ErrorAction SilentlyContinue
    ) + @(
        Get-ChildItem -Path 'docs/artifacts/reviews' -Filter "REVIEW-$Issue*" -ErrorAction SilentlyContinue
    )
    return (($cands | Sort-Object FullName -Unique).Count -gt 0)
}

function Test-LearningArtifact {
    return (Get-ChildItem -Path 'docs/artifacts/learnings' -Filter "*$Issue*" -ErrorAction SilentlyContinue).Count -gt 0
}

$steps = @(
    @{
        name = 'plan'; agent = 'pm';
        run  = { Write-Host "[ship] Plan: ensure execution plan exists for issue #$Issue" -ForegroundColor Cyan
                  if (-not (Test-PlanArtifact)) { Write-Host "  No plan found under docs/execution/plans/. Create one before continuing." -ForegroundColor Yellow; return 1 }
                  return 0 }
        gate = { Test-PlanArtifact }
    },
    @{
        name = 'work'; agent = 'engineer';
        run  = { Write-Host "[ship] Work: implementation phase. Quality loop must be active." -ForegroundColor Cyan
                  $code = Invoke-AgentX -Args @('loop','status')
                  return ($code -eq 0 ? 0 : 1) }
        gate = { $true }
    },
    @{
        name = 'review'; agent = 'reviewer';
        run  = { Write-Host "[ship] Review: looking for review artifact for issue #$Issue" -ForegroundColor Cyan
                  if (-not (Test-ReviewArtifact)) { Write-Host "  No review artifact under docs/artifacts/reviews/." -ForegroundColor Yellow; return 1 }
                  return 0 }
        gate = { Test-ReviewArtifact }
    },
    @{
        name = 'scrub'; agent = 'engineer';
        run  = { if ($SkipScrub) { Write-Host "[ship] Scrub: -SkipScrub is deprecated and ignored; scrub is mandatory on every run" -ForegroundColor DarkYellow }
                  Write-Host "[ship] Scrub: scanning workspace (mandatory deslop pass)" -ForegroundColor Cyan
                  $scrubScript = Join-Path (Resolve-Path .).Path 'scripts/scrub.ps1'
                  & pwsh -NoProfile -File $scrubScript -Path . -Quiet
                  return 0 }
        gate = { $true }
    },
    @{
        name = 'test'; agent = 'tester';
        run  = { Write-Host "[ship] Test: invoking tester agent gate (agent-browser is the default surface for UI-bearing changes; see browser-automation skill)" -ForegroundColor Cyan
                  $code = Invoke-AgentX -Args @('validate',[string]$Issue,'tester')
                  return ($code -eq 0 ? 0 : 1) }
        gate = { $true }
    },
    @{
        name = 'compound'; agent = 'agent-x';
        run  = { Write-Host "[ship] Compound: confirming learning capture or skip rationale" -ForegroundColor Cyan
                  if (Test-LearningArtifact) { return 0 }
                  Write-Host "  No learning capture found under docs/artifacts/learnings/. Either create one or document a skip rationale on the issue." -ForegroundColor Yellow
                  return 1 }
        gate = { Test-LearningArtifact }
    }
)

if ($DryRun) {
    Write-Host "[ship] Dry run plan for issue #$Issue ($From -> $To):" -ForegroundColor Cyan
    for ($i = $fromIdx; $i -le $toIdx; $i++) { Write-Host ("  - {0} ({1})" -f $steps[$i].name, $steps[$i].agent) }
    return
}

$failures = New-Object 'System.Collections.Generic.List[string]'

if ($Parallel) {
    Write-Host "[ship] -Parallel: running review/scrub/test concurrently after sequential plan/work" -ForegroundColor Magenta
    # Sequential phases that must precede parallel pool
    $sequentialBefore = @('plan','work')
    $parallelGroup    = @('review','scrub','test')
    $sequentialAfter  = @('compound')

    foreach ($name in $sequentialBefore) {
        $idx = [array]::IndexOf($Order, $name)
        if ($idx -lt $fromIdx -or $idx -gt $toIdx) { continue }
        $step = $steps[$idx]
        Set-Phase -Agent $step.agent
        Write-Host ""; Write-Host ("==== [ship] sequential: {0} ====" -f $name) -ForegroundColor Magenta
        $code = & $step.run
        if ($code -ne 0 -or -not (& $step.gate)) { $failures.Add($name); break }
        Write-Host ("[ship] {0} passed." -f $name) -ForegroundColor Green
    }

    if ($failures.Count -eq 0) {
        $activeParallel = $parallelGroup | Where-Object {
            $idx = [array]::IndexOf($Order, $_)
            $idx -ge $fromIdx -and $idx -le $toIdx
        }
        if ($activeParallel.Count -gt 0) {
            Write-Host ""; Write-Host ("==== [ship] parallel: {0} ====" -f ($activeParallel -join ', ')) -ForegroundColor Magenta
            $jobs = @()
            foreach ($name in $activeParallel) {
                $idx = [array]::IndexOf($Order, $name)
                $step = $steps[$idx]
                $jobs += Start-ThreadJob -Name "ship-$name" -ScriptBlock {
                    param($stepName, $issue, $skipScrub, $agentXCliPath, $cwd)
                    Set-Location $cwd

                    function Invoke-ShipAgentX {
                        param([string[]]$Args)
                        & pwsh -NoProfile -File $agentXCliPath @Args
                        return $LASTEXITCODE
                    }

                    function Test-ShipReviewArtifact {
                        param([int]$IssueNumber)
                        $cands = @(
                            Get-ChildItem -Path 'docs/artifacts/reviews' -Filter "*REVIEW*$IssueNumber*" -ErrorAction SilentlyContinue
                        ) + @(
                            Get-ChildItem -Path 'docs/artifacts/reviews' -Filter "REVIEW-$IssueNumber*" -ErrorAction SilentlyContinue
                        )
                        return (($cands | Sort-Object FullName -Unique).Count -gt 0)
                    }

                    switch ($stepName) {
                        'review' {
                            Write-Host "[ship] Review: looking for review artifact for issue #$issue" -ForegroundColor Cyan
                            $gateOk = Test-ShipReviewArtifact -IssueNumber $issue
                            $code = if ($gateOk) { 0 } else { Write-Host '  No review artifact under docs/artifacts/reviews/.' -ForegroundColor Yellow; 1 }
                        }
                        'scrub' {
                            if ($skipScrub) { Write-Host '[ship] Scrub: -SkipScrub is deprecated and ignored; scrub is mandatory on every run' -ForegroundColor DarkYellow }
                            Write-Host '[ship] Scrub: scanning workspace (mandatory deslop pass)' -ForegroundColor Cyan
                            $scrubScript = Join-Path $cwd 'scripts/scrub.ps1'
                            & pwsh -NoProfile -File $scrubScript -Path . -Quiet
                            $code = $LASTEXITCODE
                            $gateOk = ($code -eq 0)
                        }
                        'test' {
                            Write-Host '[ship] Test: invoking tester agent gate (agent-browser is the default surface for UI-bearing changes; see browser-automation skill)' -ForegroundColor Cyan
                            $code = Invoke-ShipAgentX -Args @('validate', [string]$issue, 'tester')
                            $gateOk = ($code -eq 0)
                        }
                        default {
                            $code = 1
                            $gateOk = $false
                        }
                    }
                    [PSCustomObject]@{ name = $stepName; code = $code; gateOk = $gateOk }
                } -ArgumentList $name, $Issue, [bool]$SkipScrub, $AgentXCli, (Resolve-Path .).Path
            }
            $results = $jobs | Wait-Job | Receive-Job
            $jobs | Remove-Job -Force
            foreach ($r in $results) {
                if ($r.code -ne 0 -or -not $r.gateOk) {
                    $failures.Add($r.name)
                    Write-Host ("[ship] {0} did not pass." -f $r.name) -ForegroundColor Red
                } else {
                    Write-Host ("[ship] {0} passed." -f $r.name) -ForegroundColor Green
                }
            }
        }
    }

    if ($failures.Count -eq 0) {
        foreach ($name in $sequentialAfter) {
            $idx = [array]::IndexOf($Order, $name)
            if ($idx -lt $fromIdx -or $idx -gt $toIdx) { continue }
            $step = $steps[$idx]
            Set-Phase -Agent $step.agent
            Write-Host ""; Write-Host ("==== [ship] sequential: {0} ====" -f $name) -ForegroundColor Magenta
            $code = & $step.run
            if ($code -ne 0 -or -not (& $step.gate)) { $failures.Add($name); break }
            Write-Host ("[ship] {0} passed." -f $name) -ForegroundColor Green
        }
    }
} else {
    for ($i = $fromIdx; $i -le $toIdx; $i++) {
        $step = $steps[$i]
        # Scrub is mandatory on every run; -SkipScrub no longer skips it.

        Set-Phase -Agent $step.agent
        Write-Host ""; Write-Host ("==== [ship] step: {0} ====" -f $step.name) -ForegroundColor Magenta

        $code = & $step.run
        if ($code -ne 0) {
            Write-Host ("[ship] {0} failed; retrying once..." -f $step.name) -ForegroundColor Yellow
            $code = & $step.run
        }
        $passed = ($code -eq 0) -and (& $step.gate)
        if (-not $passed) {
            $failures.Add($step.name)
            Write-Host ("[ship] {0} did not pass its gate. Stopping." -f $step.name) -ForegroundColor Red
            break
        }
        Write-Host ("[ship] {0} passed gate." -f $step.name) -ForegroundColor Green
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""; Write-Host "[ship] Pipeline halted. Resolve and re-run from the failed step:" -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "  pwsh scripts/ship.ps1 -Issue $Issue -From $f" }
    exit 1
}

Write-Host ""; Write-Host "[ship] Pipeline complete for issue #$Issue ($From -> $To)." -ForegroundColor Green
