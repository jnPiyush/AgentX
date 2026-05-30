#requires -Version 7.0
<#
.SYNOPSIS
  agentx takeoff - Session-start briefing.
.DESCRIPTION
  Prints a compact briefing of the current workspace state so a new session can
  pick up the highest-value next move without re-discovery.

  Surfaces:
    * Open PRs touching this repo (gh CLI if available)
    * Current branch and uncommitted changes
    * Recent failed CI runs (last 5)
    * AgentX ready queue (top 5 items)
    * Active quality loop status
    * Recent signal activity (.agentx/signals/sessions.jsonl mtime)
    * Suggested next action

  Read-only. Never mutates state.

.PARAMETER Json
  Emit a single JSON document instead of human-readable text.
.EXAMPLE
  pwsh scripts/takeoff.ps1
.EXAMPLE
  pwsh scripts/takeoff.ps1 -Json
#>
[CmdletBinding()]
param([switch]$Json)

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path .).Path
$report = [ordered]@{
    timestamp = (Get-Date -Format 'o')
    repo      = Split-Path $root -Leaf
    branch    = $null
    uncommitted = 0
    openPrs   = @()
    failedCi  = @()
    readyQueue = @()
    loop      = $null
    signalAgeHours = $null
    nextAction = $null
}

# Branch + uncommitted
try {
    $report.branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    $status = git status --porcelain 2>$null
    if ($status) { $report.uncommitted = ($status -split "`n").Count }
} catch {}

# gh PRs and CI
$ghPath = (Get-Command gh -ErrorAction SilentlyContinue)
if ($ghPath) {
    try {
        $prJson = gh pr list --limit 5 --json number,title,headRefName,author 2>$null
        if ($prJson) { $report.openPrs = ($prJson | ConvertFrom-Json) }
    } catch {}
    try {
        $ciJson = gh run list --status failure --limit 5 --json databaseId,name,headBranch,createdAt 2>$null
        if ($ciJson) { $report.failedCi = ($ciJson | ConvertFrom-Json) }
    } catch {}
}

# Ready queue (best-effort: scan .agentx/issues/*.json)
$issuesDir = Join-Path $root '.agentx/issues'
if (Test-Path $issuesDir) {
    $open = Get-ChildItem -Path $issuesDir -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
        try { Get-Content $_.FullName -Raw | ConvertFrom-Json } catch { $null }
    } | Where-Object { $_ -and $_.state -eq 'open' }
    $report.readyQueue = $open | Sort-Object { $_.number } -Descending | Select-Object -First 5 number,title,status,labels
}

# Loop state
$loopFile = Join-Path $root '.agentx/state/loop-state.json'
if (Test-Path $loopFile) {
    try {
        $loop = Get-Content $loopFile -Raw | ConvertFrom-Json
        $report.loop = [ordered]@{
            status    = $loop.status
            iteration = $loop.iteration
            maxIterations = $loop.maxIterations
            prompt    = $loop.prompt
            consumed  = $loop.loopConsumed
        }
    } catch {}
}

# Signal activity
$signalFile = Join-Path $root '.agentx/signals/sessions.jsonl'
if (Test-Path $signalFile) {
    $age = (Get-Date) - (Get-Item $signalFile).LastWriteTime
    $report.signalAgeHours = [math]::Round($age.TotalHours, 1)
}

# Suggest next action
$suggest = @()
if ($report.loop -and $report.loop.status -eq 'started' -and -not $report.loop.consumed) {
    $suggest += "Active loop (iter $($report.loop.iteration)/$($report.loop.maxIterations)): $($report.loop.prompt)"
}
if ($report.uncommitted -gt 0) { $suggest += "$($report.uncommitted) uncommitted file(s) on '$($report.branch)' -- consider 'agentx land' when ready" }
if ($report.failedCi.Count -gt 0) { $suggest += "Investigate failing CI: $($report.failedCi[0].name) on $($report.failedCi[0].headBranch)" }
if ($report.openPrs.Count -gt 0) { $suggest += "$($report.openPrs.Count) open PR(s) awaiting review" }
if (-not $suggest) { $suggest += 'Workspace is clean. Pick a ready-queue item or start new work with an issue.' }
$report.nextAction = $suggest -join '; '

if ($Json) {
    $report | ConvertTo-Json -Depth 6
    return
}

Write-Host ""
Write-Host "=== agentx takeoff ===" -ForegroundColor Cyan
Write-Host "Branch        : $($report.branch)  ($($report.uncommitted) uncommitted)"
Write-Host "Open PRs      : $($report.openPrs.Count)"
foreach ($pr in $report.openPrs | Select-Object -First 3) {
    Write-Host "  #$($pr.number) $($pr.title) [$($pr.headRefName)]"
}
Write-Host "Failed CI     : $($report.failedCi.Count) recent"
foreach ($ci in $report.failedCi | Select-Object -First 3) {
    Write-Host "  $($ci.name) on $($ci.headBranch)"
}
Write-Host "Ready queue   : $($report.readyQueue.Count) item(s)"
foreach ($r in $report.readyQueue | Select-Object -First 3) {
    Write-Host "  #$($r.number) [$($r.status)] $($r.title)"
}
if ($report.loop) {
    Write-Host "Quality loop  : $($report.loop.status) iter=$($report.loop.iteration)/$($report.loop.maxIterations) consumed=$($report.loop.consumed)"
}
if ($null -ne $report.signalAgeHours) {
    Write-Host "Signals       : last write $($report.signalAgeHours)h ago"
}
Write-Host ""
Write-Host "Next action  -> $($report.nextAction)" -ForegroundColor Yellow
Write-Host ""
