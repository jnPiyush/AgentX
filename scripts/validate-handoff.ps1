#!/usr/bin/env pwsh
# validate-handoff.ps1 - Validate agent handoff messages against schema
# Also generates handoff JSON from agent deliverables.
#
# Usage:
#   .\scripts\validate-handoff.ps1 -IssueNumber 42 -FromAgent pm -ToAgent architect
#   .\scripts\validate-handoff.ps1 -Validate handoff.json
#Requires -Version 7.0
param(
    [int]$IssueNumber = 0,
    [string]$FromAgent = '',
    [string]$ToAgent = '',
    [string]$Summary = '',
    [string]$Validate = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$VALID_AGENTS = @('agent-x','pm','ux','architect','data-scientist','engineer','reviewer','reviewer-auto','devops','tester','powerbi','consulting-research','agile-coach','github-ops','ado-ops')
$VALID_STATUSES = @('Backlog','Ready','In Progress','In Review','Validating','Done')
$ARTIFACT_TYPES = @('prd','adr','spec','ux','code','test','review','pipeline','certification','report','other')

# Agent -> expected deliverable paths
$AGENT_DELIVERABLES = @{
    'pm'        = @{ pattern = 'docs/prd/PRD-{0}.md'; type = 'prd' }
    'architect' = @{ pattern = 'docs/adr/ADR-{0}.md'; type = 'adr' }
    'ux'        = @{ pattern = 'docs/ux/UX-{0}.md'; type = 'ux' }
    'engineer'  = @{ pattern = 'src/**'; type = 'code' }
    'reviewer'  = @{ pattern = 'docs/reviews/REVIEW-{0}.md'; type = 'review' }
    'devops'    = @{ pattern = '.github/workflows/**'; type = 'pipeline' }
    'tester'    = @{ pattern = 'docs/testing/**'; type = 'certification' }
}

# Agent -> status after handoff
$HANDOFF_STATUS = @{
    'pm'        = 'Ready'
    'ux'        = 'Ready'
    'architect' = 'Ready'
    'engineer'  = 'In Review'
    'reviewer'  = 'Validating'
    'devops'    = 'In Review'
    'tester'    = 'In Review'
}

function Test-HandoffMessage([hashtable]$msg) {
    $errors = @()

    # Required fields
    if (-not $msg.version) { $errors += 'Missing: version' }
    if (-not $msg.handoff) { $errors += 'Missing: handoff object'; return $errors }

    $h = $msg.handoff
    if (-not $h.fromAgent) { $errors += 'Missing: handoff.fromAgent' }
    elseif ($h.fromAgent -notin $VALID_AGENTS) { $errors += "Invalid fromAgent: $($h.fromAgent)" }

    if (-not $h.toAgent) { $errors += 'Missing: handoff.toAgent' }
    elseif ($h.toAgent -notin $VALID_AGENTS) { $errors += "Invalid toAgent: $($h.toAgent)" }

    if (-not $h.issueNumber -or $h.issueNumber -lt 1) { $errors += 'Missing or invalid: handoff.issueNumber' }

    if (-not $h.timestamp) { $errors += 'Missing: handoff.timestamp' }

    if (-not $h.context) { $errors += 'Missing: handoff.context' }
    elseif (-not $h.context.summary -or $h.context.summary.Length -lt 10) {
        $errors += 'handoff.context.summary must be at least 10 characters'
    }

    if ($h.fromAgent -eq $h.toAgent) { $errors += 'fromAgent and toAgent must be different' }

    # Validate artifacts if present
    if ($h.context -and $h.context.artifacts) {
        foreach ($a in $h.context.artifacts) {
            if (-not $a.path) { $errors += 'Artifact missing path' }
            if ($a.type -and $a.type -notin $ARTIFACT_TYPES) { $errors += "Invalid artifact type: $($a.type)" }
        }
    }

    if ($h.status -and $h.status -notin $VALID_STATUSES) { $errors += "Invalid status: $($h.status)" }

    return $errors
}

function New-HandoffMessage {
    $artifacts = @()
    if ($AGENT_DELIVERABLES.ContainsKey($FromAgent)) {
        $info = $AGENT_DELIVERABLES[$FromAgent]
        $expectedPath = $info.pattern -f $IssueNumber
        # Check if file exists (for non-glob paths)
        if ($expectedPath -notmatch '\*') {
            $fullPath = Join-Path $ROOT $expectedPath
            if (Test-Path $fullPath) {
                $artifacts += @{ path = $expectedPath; type = $info.type; description = "Deliverable from $FromAgent" }
            }
        }
    }

    $status = if ($HANDOFF_STATUS.ContainsKey($FromAgent)) { $HANDOFF_STATUS[$FromAgent] } else { 'Ready' }

    # Check loop state
    $loopCompleted = $false
    $loopFile = Join-Path $ROOT ".agentx/state/loop-$IssueNumber.json"
    if (Test-Path $loopFile) {
        $loopState = Get-Content $loopFile -Raw | ConvertFrom-Json
        $loopCompleted = ($loopState.status -eq 'complete')
    }

    $handoff = @{
        version = '1.0'
        handoff = @{
            fromAgent   = $FromAgent
            toAgent     = $ToAgent
            issueNumber = $IssueNumber
            timestamp   = (Get-Date -Format 'o')
            status      = $status
            context     = @{
                summary       = if ($Summary) { $Summary } else { "Handoff from $FromAgent to $ToAgent for issue #$IssueNumber" }
                artifacts     = $artifacts
                decisions     = @()
                openQuestions = @()
                blockers      = @()
                labels        = @()
            }
            validation = @{
                handoffChecked       = $true
                contextCaptured      = $true
                deliverablesCommitted = ($artifacts.Count -gt 0)
                loopCompleted        = $loopCompleted
            }
        }
    }

    return $handoff
}

# Main logic
if ($Validate) {
    # Validate existing handoff JSON
    if (-not (Test-Path $Validate)) { Write-Host "[FAIL] File not found: $Validate"; exit 1 }
    $raw = Get-Content $Validate -Raw | ConvertFrom-Json -AsHashtable
    $errors = @(Test-HandoffMessage $raw)
    if ($errors.Count -gt 0) {
        Write-Host "`n  [FAIL] Handoff validation failed:"
        foreach ($e in $errors) { Write-Host "    - $e" }
        Write-Host ''
        exit 1
    }
    Write-Host "`n  [PASS] Handoff message is valid"
    Write-Host "    From: $($raw.handoff.fromAgent) -> To: $($raw.handoff.toAgent)"
    Write-Host "    Issue: #$($raw.handoff.issueNumber)"
    Write-Host "    Status: $($raw.handoff.status)"
    Write-Host ''
    exit 0
}

if ($IssueNumber -gt 0 -and $FromAgent -and $ToAgent) {
    # Generate + validate handoff message
    if ($FromAgent -notin $VALID_AGENTS) { Write-Host "[FAIL] Invalid fromAgent: $FromAgent"; exit 1 }
    if ($ToAgent -notin $VALID_AGENTS) { Write-Host "[FAIL] Invalid toAgent: $ToAgent"; exit 1 }

    $msg = New-HandoffMessage
    $errors = @(Test-HandoffMessage $msg)

    if ($errors.Count -gt 0) {
        Write-Host "`n  [FAIL] Generated handoff has validation errors:"
        foreach ($e in $errors) { Write-Host "    - $e" }
        exit 1
    }

    # Write handoff file
    $outDir = Join-Path $ROOT ".agentx/handoffs"
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    $outFile = Join-Path $outDir "handoff-$IssueNumber-$FromAgent-to-$ToAgent.json"
    $msg | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding utf8

    if ($Json) {
        $msg | ConvertTo-Json -Depth 10
    } else {
        Write-Host "`n  [PASS] Handoff message generated and validated"
        Write-Host "    From: $FromAgent -> To: $ToAgent"
        Write-Host "    Issue: #$IssueNumber"
        Write-Host "    Status: $($msg.handoff.status)"
        Write-Host "    File: $outFile"
        Write-Host ''
    }
    exit 0
}

Write-Host @"

  Usage:
    validate-handoff.ps1 -IssueNumber <n> -FromAgent <role> -ToAgent <role> [-Summary "..."]
    validate-handoff.ps1 -Validate <handoff.json>

  Agents: $($VALID_AGENTS -join ', ')
"@
