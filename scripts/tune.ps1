#requires -Version 7.0
<#
.SYNOPSIS
  Metric-driven experimentation runner. Capture a baseline, evaluate each
  attempt against a metric command, and keep or revert based on the result.

.DESCRIPTION
  This script implements an attempt-based loop. The agent (or human) makes
  changes between calls. Each attempt runs the metric command, compares
  against the baseline, and either keeps the change (commits) or reverts.

  All attempts are logged to a per-tag results.tsv with timestamp, attempt
  number, files changed, baseline value, attempt value, decision, and note.

.PARAMETER Action
  start | attempt | end | status

.PARAMETER Goal
  Free-text description of what the loop is optimizing.

.PARAMETER Metric
  Shell command that exits 0 and prints a single numeric value to stdout.

.PARAMETER Direction
  lower | higher. Whether smaller or larger metric values are better.

.PARAMETER Tag
  Short slug used to name the experimentation branch and the results file.

.PARAMETER Note
  Free-text note recorded with each attempt.

.PARAMETER Tolerance
  Floating-point tolerance for "no change" classification. Default 0.0.

.EXAMPLE
  pwsh scripts/tune.ps1 -Action start -Goal "shrink build time" -Metric "npm run build:time" -Direction lower -Tag build-time

.EXAMPLE
  pwsh scripts/tune.ps1 -Action attempt -Note "drop unused webpack plugin"

.EXAMPLE
  pwsh scripts/tune.ps1 -Action end
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateSet('start','attempt','end','status')] [string]$Action,
    [string]$Goal,
    [string]$Metric,
    [ValidateSet('lower','higher')] [string]$Direction = 'lower',
    [string]$Tag,
    [string]$Note = '',
    [double]$Tolerance = 0.0
)

$ErrorActionPreference = 'Stop'

$RootDir   = (Resolve-Path .).Path
$StateDir  = Join-Path $RootDir '.agentx/state/tune'
$StateFile = Join-Path $StateDir 'session.json'

function Get-Timestamp { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

function Test-CleanWorkingTree {
    $st = git status --porcelain 2>$null
    return [string]::IsNullOrWhiteSpace($st)
}

function Get-CurrentBranch { (git rev-parse --abbrev-ref HEAD 2>$null).Trim() }

function Get-ChangedFiles {
    $modified = (git diff --name-only HEAD 2>$null) -split "`n" | Where-Object { $_ }
    $added    = (git ls-files --others --exclude-standard 2>$null) -split "`n" | Where-Object { $_ }
    return @{ modified = @($modified); added = @($added) }
}

function Invoke-Metric {
    param([string]$Cmd)
    $out = & pwsh -NoProfile -Command $Cmd 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Metric command failed (exit $LASTEXITCODE): $($out -join "`n")" }
    $tail = ($out | Where-Object { $_ -match '\S' } | Select-Object -Last 5) -join "`n"
    $numMatch = [regex]::Match($tail, '-?\d+(\.\d+)?')
    if (-not $numMatch.Success) { throw "Metric command produced no numeric value. Output tail: $tail" }
    return [double]$numMatch.Value
}

function Save-State { param($State) New-Item -ItemType Directory -Path $StateDir -Force | Out-Null; $State | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $StateFile }
function Get-State  { if (-not (Test-Path $StateFile)) { return $null }; return (Get-Content $StateFile -Raw -Encoding utf8 | ConvertFrom-Json) }
function Get-ResultsFile { param($Tag) Join-Path $StateDir ("results-$Tag.tsv") }

function Write-ResultsHeader { param($File) if (-not (Test-Path $File)) { "timestamp`tattempt`tdecision`tbaseline`tvalue`tdelta`tfiles_changed`tnote" | Set-Content -Encoding utf8 $File } }

switch ($Action) {
    'start' {
        if (-not $Goal -or -not $Metric -or -not $Tag) { throw '-Goal, -Metric, and -Tag are required for start.' }
        if (-not (Test-CleanWorkingTree)) { throw 'Working tree must be clean before starting an experiment.' }
        $existing = Get-State
        if ($existing -and $existing.active) { throw "An experiment is already active (tag '$($existing.tag)'). Run -Action end first." }

        $branch = "tune/$Tag"
        $startedFrom = Get-CurrentBranch
        & git checkout -B $branch | Out-Null
        Write-Host "[tune] Capturing baseline..." -ForegroundColor Cyan
        $baseline = Invoke-Metric -Cmd $Metric

        $state = [pscustomobject]@{
            active      = $true
            tag         = $Tag
            goal        = $Goal
            metric      = $Metric
            direction   = $Direction
            tolerance   = $Tolerance
            startedFrom = $startedFrom
            branch      = $branch
            baseline    = $baseline
            startedAt   = Get-Timestamp
            attempts    = 0
            kept        = 0
            reverted    = 0
            currentBest = $baseline
        }
        Save-State $state

        $results = Get-ResultsFile $Tag
        Write-ResultsHeader -File $results
        ("{0}`t0`tbaseline`t{1}`t{1}`t0`t`tinitial baseline" -f (Get-Timestamp), $baseline) | Add-Content -Encoding utf8 $results

        Write-Host ("[tune] Started '$Tag' on branch $branch") -ForegroundColor Green
        Write-Host ("  Baseline: $baseline ($Direction is better)")
        Write-Host ("  Results:  $results")
    }

    'attempt' {
        $state = Get-State
        if (-not $state -or -not $state.active) { throw "No active experiment. Run -Action start first." }
        $branch = $state.branch
        $current = Get-CurrentBranch
        if ($current -ne $branch) { throw "Current branch '$current' does not match experiment branch '$branch'." }

        $changed = Get-ChangedFiles
        $allChanged = @($changed.modified + $changed.added)
        if ($allChanged.Count -eq 0) { throw 'No changes to evaluate. Make changes before running attempt.' }

        $state.attempts = [int]$state.attempts + 1
        $attemptNum = $state.attempts

        Write-Host "[tune] Attempt $attemptNum running metric..." -ForegroundColor Cyan
        $value = Invoke-Metric -Cmd $state.metric
        $baseline = [double]$state.currentBest
        $delta = $value - $baseline

        $isImprovement = if ($state.direction -eq 'lower') { ($baseline - $value) -gt $state.tolerance } else { ($value - $baseline) -gt $state.tolerance }

        $decision = if ($isImprovement) { 'keep' } else { 'revert' }

        if ($isImprovement) {
            & git add -A | Out-Null
            $msg = "tune($($state.tag)): attempt $attemptNum kept ($baseline -> $value)"
            if ($Note) { $msg += " - $Note" }
            & git commit -m $msg | Out-Null
            $state.kept = [int]$state.kept + 1
            $state.currentBest = $value
            Write-Host ("[tune] KEEP. {0} -> {1} (delta {2:N4})" -f $baseline, $value, $delta) -ForegroundColor Green
        } else {
            & git checkout -- . 2>&1 | Out-Null
            & git clean -fd 2>&1 | Out-Null
            $state.reverted = [int]$state.reverted + 1
            Write-Host ("[tune] REVERT. {0} did not beat {1} (delta {2:N4})" -f $value, $baseline, $delta) -ForegroundColor Yellow
        }

        Save-State $state
        $results = Get-ResultsFile $state.tag
        Write-ResultsHeader -File $results
        $filesField = ($allChanged -join '|')
        ("{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}" -f (Get-Timestamp), $attemptNum, $decision, $baseline, $value, $delta, $filesField, ($Note -replace "`t",' ')) | Add-Content -Encoding utf8 $results
    }

    'status' {
        $state = Get-State
        if (-not $state -or -not $state.active) { Write-Host "[tune] No active experiment."; return }
        Write-Host "[tune] Active experiment" -ForegroundColor Cyan
        Write-Host "  Tag:        $($state.tag)"
        Write-Host "  Goal:       $($state.goal)"
        Write-Host "  Branch:     $($state.branch)"
        Write-Host "  Direction:  $($state.direction)"
        Write-Host "  Baseline:   $($state.baseline)"
        Write-Host "  Best:       $($state.currentBest)"
        Write-Host "  Attempts:   $($state.attempts) (kept $($state.kept), reverted $($state.reverted))"
        Write-Host "  Results:    $(Get-ResultsFile $state.tag)"
    }

    'end' {
        $state = Get-State
        if (-not $state -or -not $state.active) { Write-Host "[tune] No active experiment."; return }
        $state.active = $false
        $state.endedAt = Get-Timestamp
        Save-State $state
        Write-Host "[tune] Closed experiment '$($state.tag)'." -ForegroundColor Green
        Write-Host "  Baseline -> Best: $($state.baseline) -> $($state.currentBest)"
        Write-Host "  Attempts: $($state.attempts) (kept $($state.kept), reverted $($state.reverted))"
        Write-Host "  Branch '$($state.branch)' is left in place. Merge or discard manually."
    }
}
