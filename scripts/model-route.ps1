#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Recommend a model tier (fast / balanced / reasoning) for a task description.

.DESCRIPTION
  Heuristic task classifier. Reads a free-form task description from a
  parameter, file, or stdin, scores it against keyword classes, and
  recommends one of three tiers along with a short rationale.

  Tiers:
    fast       -> simple edits, single-file changes, formatting, small lookups
    balanced   -> typical feature work, code review, multi-file edits
    reasoning  -> design, planning, multi-step debugging, architecture, eval

  No model names are hardcoded. The active LLM adapter is responsible for
  mapping tier -> deployed model.

.PARAMETER Task
  Free-form task description.

.PARAMETER File
  Path to a file containing the task description.

.PARAMETER Json
  Emit JSON instead of human-readable output.

.EXAMPLE
  pwsh scripts/model-route.ps1 -Task "Rename a variable in one file"
  pwsh scripts/model-route.ps1 -Task "Design a multi-tenant auth system" -Json
#>

#Requires -Version 7.0

[CmdletBinding()]
param(
  [string]$Task = '',
  [string]$File = '',
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($File -and (Test-Path $File)) {
  $Task = (Get-Content -Path $File -Raw).Trim()
}
if (-not $Task) {
  $piped = $input | Out-String
  if ($piped) { $Task = $piped.Trim() }
}
if (-not $Task) {
  Write-Error "Provide -Task '<description>' or -File <path> or pipe input."
  exit 1
}

$taskLower = $Task.ToLowerInvariant()

# Keyword classes
$reasoningHints = @(
  'design','architect','architecture','plan','strategy','trade-off','tradeoffs','tradeoff',
  'evaluate','evaluation','reason','reasoning','derive','prove','optimi[sz]e',
  'multi-step','multi step','root cause','rca','postmortem','post-mortem',
  'spec','specification','adr','prd','threat model','security review',
  'algorithm','complexity','migration plan','migration strategy'
)
$balancedHints = @(
  'implement','feature','refactor','test','tests','unit test','integration test',
  'review','code review','pull request','pr','add support','add a','build a',
  'fix bug','fix issue','debug','endpoint','api','database','sql','schema','module'
)
$fastHints = @(
  'rename','format','reformat','indent','one-liner','typo','lint','prettier',
  'comment','docstring','readme tweak','single file','rename variable','rename function'
)

function Count-Hits([string]$text, [string[]]$patterns) {
  $n = 0
  foreach ($p in $patterns) {
    if ($text -match $p) { $n++ }
  }
  return $n
}

$reasoningHits = Count-Hits -text $taskLower -patterns $reasoningHints
$balancedHits  = Count-Hits -text $taskLower -patterns $balancedHints
$fastHits      = Count-Hits -text $taskLower -patterns $fastHints

# Length signal: very short tasks bias toward fast, long multi-clause tasks bias toward reasoning.
$wordCount = ($Task -split '\s+').Count
$lengthSignal = if ($wordCount -lt 6) { 'short' } elseif ($wordCount -gt 60) { 'long' } else { 'medium' }

# Decision
$tier = 'balanced'
$rationaleParts = New-Object System.Collections.Generic.List[string]

if ($reasoningHits -gt 0 -and $reasoningHits -ge $balancedHits) {
  $tier = 'reasoning'
  $rationaleParts.Add("matched $reasoningHits reasoning hint(s)") | Out-Null
} elseif ($fastHits -gt 0 -and $fastHits -ge $balancedHits -and $reasoningHits -eq 0) {
  $tier = 'fast'
  $rationaleParts.Add("matched $fastHits fast-path hint(s) and no reasoning hints") | Out-Null
} elseif ($balancedHits -gt 0) {
  $tier = 'balanced'
  $rationaleParts.Add("matched $balancedHits balanced hint(s)") | Out-Null
} else {
  # No clear hits: fall back on length
  if ($lengthSignal -eq 'short') { $tier = 'fast'; $rationaleParts.Add('short task, no specialized keywords') | Out-Null }
  elseif ($lengthSignal -eq 'long') { $tier = 'reasoning'; $rationaleParts.Add('long task description, no keyword match') | Out-Null }
  else { $tier = 'balanced'; $rationaleParts.Add('no keyword signal, medium length') | Out-Null }
}

# Overrides: explicit signals always win
if ($taskLower -match 'urgent|hotfix|quick') {
  if ($tier -ne 'reasoning') { $tier = 'fast' }
  $rationaleParts.Add('urgency keyword detected') | Out-Null
}
if ($taskLower -match 'do not rush|take your time|carefully|think step by step') {
  $tier = 'reasoning'
  $rationaleParts.Add('caller asked for deliberate reasoning') | Out-Null
}

$result = [pscustomobject]@{
  task           = $Task
  tier           = $tier
  word_count     = $wordCount
  length_signal  = $lengthSignal
  hits = [pscustomobject]@{
    reasoning = $reasoningHits
    balanced  = $balancedHits
    fast      = $fastHits
  }
  rationale = ($rationaleParts -join '; ')
}

if ($Json) {
  Write-Output ($result | ConvertTo-Json -Depth 4)
}
else {
  $color = switch ($tier) {
    'fast'      { 'Green' }
    'balanced'  { 'Cyan' }
    'reasoning' { 'Yellow' }
    default     { 'Gray' }
  }
  Write-Host ""
  Write-Host "AgentX model route" -ForegroundColor Cyan
  Write-Host ("Tier: {0}" -f $tier) -ForegroundColor $color
  Write-Host ("Words: {0} ({1})" -f $wordCount, $lengthSignal)
  Write-Host ("Hits: reasoning={0} balanced={1} fast={2}" -f $reasoningHits, $balancedHits, $fastHits)
  Write-Host ("Rationale: {0}" -f $result.rationale)
  Write-Host ""
  Write-Host "Hint: your active LLM adapter maps tiers to deployed models."
  Write-Host ""
}

exit 0

