#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Inspect and verify Frontier session provenance across declared harness components.

.DESCRIPTION
  Adopts Frontier-HVE session provenance verification natively for Frontier.
  Inspects loop state, hook signal logs, repository context primer/receipts,
  skill loadout receipts, configured deliverable templates, and stage-gate
  reports. Classifies each component as 'verified', 'not-exercised', or
  'failed', writes <state>/state/provenance/<session>.provenance.json, and
  exits 1 when a component failed or a required component (--Require) was
  not exercised.

.PARAMETER Agent
  Optional agent role or path to .agent.md file (e.g., engineer, product-manager).

.PARAMETER Session
  Session ID to inspect, or 'latest' (default).

.PARAMETER Require
  Comma-separated or array of required component IDs (loop, hooks, context, skills, templates, stage-gates).

.PARAMETER WorkspaceRoot
  Optional workspace root override.

.PARAMETER Json
  Emit compact JSON output.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Agent = '',
    [Parameter(Position = 1)]
    [string]$Session = 'latest',
    [string[]]$Require = @(),
    [string]$WorkspaceRoot = '',
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..' '.frontier' 'runtime' 'workspace-state.ps1')

$root = if ($WorkspaceRoot) {
    (Resolve-Path -LiteralPath $WorkspaceRoot -ErrorAction Stop).Path
} elseif ($env:FRONTIER_WORKSPACE_ROOT -and (Test-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -PathType Container)) {
    (Resolve-Path -LiteralPath $env:FRONTIER_WORKSPACE_ROOT -ErrorAction Stop).Path
} else {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

$stateRoot = Get-FrontierStateRoot $root
$supportedComponents = @('loop', 'hooks', 'context', 'skills', 'templates', 'stage-gates')

$requiredList = [System.Collections.Generic.List[string]]::new()
foreach ($item in $Require) {
    if ([string]::IsNullOrWhiteSpace($item)) { continue }
    foreach ($part in ($item -split ',')) {
        $trimmed = $part.Trim().ToLowerInvariant()
        if (-not $trimmed) { continue }
        if ($trimmed -notin $supportedComponents) {
            throw "Unsupported provenance component '$trimmed'. Supported: $($supportedComponents -join ', ')."
        }
        if (-not $requiredList.Contains($trimmed)) {
            [void]$requiredList.Add($trimmed)
        }
    }
}

# 1. Inspect signals (.frontier/signals/sessions.jsonl or stateRoot/signals/sessions.jsonl)
$signalCandidates = @(
    (Join-Path $stateRoot 'signals' 'sessions.jsonl'),
    (Join-Path $root '.frontier' 'signals' 'sessions.jsonl')
) | Select-Object -Unique

$signalEntries = [System.Collections.Generic.List[object]]::new()
$signalFileUsed = ''
foreach ($candidate in $signalCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $signalFileUsed = $candidate
        foreach ($line in (Get-Content -LiteralPath $candidate -Encoding utf8 -ErrorAction SilentlyContinue)) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            try {
                $parsed = $line | ConvertFrom-Json -ErrorAction Stop
                $signalEntries.Add($parsed)
            } catch { continue }
        }
        break
    }
}

$resolvedSessionId = $Session
if ([string]::IsNullOrWhiteSpace($resolvedSessionId) -or $resolvedSessionId -eq 'latest') {
    $withSession = @($signalEntries | Where-Object {
        $_.PSObject.Properties['sessionId'] -and -not [string]::IsNullOrWhiteSpace([string]$_.sessionId)
    })
    if ($withSession.Count -gt 0) {
        $resolvedSessionId = [string]$withSession[-1].sessionId
    } else {
        $resolvedSessionId = 'workspace-latest'
    }
}

$sessionSignals = @(if ($resolvedSessionId -ne 'workspace-latest') {
    $signalEntries | Where-Object {
        $_.PSObject.Properties['sessionId'] -and [string]$_.sessionId -eq $resolvedSessionId
    }
} else {
    $signalEntries
})

# 2. Component: loop
$loopStatePath = Join-Path $stateRoot 'state' 'loop-state.json'
$loopStatus = 'not-exercised'
$loopEvidence = 'No loop-state.json found.'
if (Test-Path -LiteralPath $loopStatePath -PathType Leaf) {
    try {
        $loopData = Get-Content -LiteralPath $loopStatePath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
        $statusText = if ($loopData.PSObject.Properties['status']) { [string]$loopData.status } else { 'unknown' }
        $iterCount = if ($loopData.PSObject.Properties['iteration']) { [int]$loopData.iteration } else { 0 }
        if ($statusText -eq 'complete' -and $iterCount -ge 1) {
            $loopStatus = 'verified'
            $loopEvidence = "Loop complete ($iterCount iteration(s)) in $loopStatePath."
        } elseif ($statusText -eq 'active' -and $iterCount -ge 1) {
            $loopStatus = 'verified'
            $loopEvidence = "Active loop with $iterCount recorded iteration(s)."
        } elseif ($statusText -in @('failed', 'stopped')) {
            $loopStatus = 'failed'
            $loopEvidence = "Loop in '$statusText' state at iteration $iterCount."
        } else {
            $loopStatus = 'not-exercised'
            $loopEvidence = "Loop state is '$statusText' (iteration $iterCount)."
        }
    } catch {
        $loopStatus = 'failed'
        $loopEvidence = "Loop state unreadable: $($_.Exception.Message)"
    }
}

# 3. Component: hooks
$hooksStatus = 'not-exercised'
$hooksEvidence = 'No hook signal events recorded.'
if ($sessionSignals.Count -gt 0) {
    $events = @($sessionSignals | ForEach-Object {
        if ($_.PSObject.Properties['event']) { [string]$_.event } else { 'unknown' }
    } | Select-Object -Unique)
    $hooksStatus = 'verified'
    $hooksEvidence = "$($sessionSignals.Count) signal event(s) recorded ($($events -join ', ')) in $signalFileUsed."
}

# 4. Component: context
$contextStatus = 'not-exercised'
$contextEvidence = 'No repository context primer or receipt found.'
$primerCandidates = @(
    (Join-Path $stateRoot 'state' 'repository-context' 'primer.json'),
    (Join-Path $stateRoot 'repository-context' 'primer.json'),
    (Join-Path $root '.frontier' 'state' 'repository-context' 'primer.json')
)
foreach ($primerPath in $primerCandidates) {
    if (Test-Path -LiteralPath $primerPath -PathType Leaf) {
        $contextStatus = 'verified'
        $contextEvidence = "Repository context primer present at $primerPath."
        break
    }
}

# 5. Component: skills
$skillsStatus = 'not-exercised'
$skillsEvidence = 'No skill loadout receipt recorded.'
$skillLoadoutCandidates = @(
    (Join-Path $stateRoot 'state' 'skills-loadout.json'),
    (Join-Path $stateRoot 'state' "skills-$resolvedSessionId.json")
)
foreach ($loadoutPath in $skillLoadoutCandidates) {
    if (Test-Path -LiteralPath $loadoutPath -PathType Leaf) {
        try {
            $loadout = Get-Content -LiteralPath $loadoutPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
            $loadedCount = @($loadout.loaded).Count
            $skillsStatus = 'verified'
            $skillsEvidence = "Skill loadout recorded ($loadedCount skill(s), $($loadout.totalTokens) tokens) at $loadoutPath."
            break
        } catch {
            $skillsStatus = 'failed'
            $skillsEvidence = "Skill loadout unreadable at ${loadoutPath}: $($_.Exception.Message)"
            break
        }
    }
}

# 6. Component: templates
$templatesStatus = 'not-exercised'
$templatesEvidence = 'No deliverable template registry entries recorded.'
$templateRegistryPath = Join-Path $stateRoot 'state' 'templates-registry.json'
if (Test-Path -LiteralPath $templateRegistryPath -PathType Leaf) {
    try {
        $reg = Get-Content -LiteralPath $templateRegistryPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
        $docs = @($reg.documents)
        if ($docs.Count -gt 0) {
            $invalidDocs = @($docs | Where-Object { $_.PSObject.Properties['valid'] -and -not [bool]$_.valid })
            if ($invalidDocs.Count -gt 0) {
                $templatesStatus = 'failed'
                $templatesEvidence = "$($invalidDocs.Count) of $($docs.Count) registered deliverable document(s) failed validation."
            } else {
                $templatesStatus = 'verified'
                $templatesEvidence = "$($docs.Count) deliverable document(s) verified in $templateRegistryPath."
            }
        }
    } catch {
        $templatesStatus = 'failed'
        $templatesEvidence = "Template registry unreadable: $($_.Exception.Message)"
    }
}

# 7. Component: stage-gates
$stageGateStatus = 'not-exercised'
$stageGateEvidence = 'No stage-gate reports found.'
$gateDirs = @(
    (Join-Path $root 'docs' 'artifacts' 'reviews' 'gates'),
    (Join-Path $stateRoot 'state' 'stage-gates')
)
foreach ($gateDir in $gateDirs) {
    if (Test-Path -LiteralPath $gateDir -PathType Container) {
        $gateFiles = @(Get-ChildItem -LiteralPath $gateDir -Filter '*.json' -File -ErrorAction SilentlyContinue)
        if ($gateFiles.Count -gt 0) {
            $stageGateStatus = 'verified'
            $stageGateEvidence = "$($gateFiles.Count) stage-gate report(s) present under $gateDir."
            break
        }
    }
}

$components = @(
    [PSCustomObject]@{ id = 'loop';        status = $loopStatus;      required = $requiredList.Contains('loop');        evidence = $loopEvidence },
    [PSCustomObject]@{ id = 'hooks';       status = $hooksStatus;     required = $requiredList.Contains('hooks');       evidence = $hooksEvidence },
    [PSCustomObject]@{ id = 'context';     status = $contextStatus;   required = $requiredList.Contains('context');     evidence = $contextEvidence },
    [PSCustomObject]@{ id = 'skills';      status = $skillsStatus;    required = $requiredList.Contains('skills');      evidence = $skillsEvidence },
    [PSCustomObject]@{ id = 'templates';   status = $templatesStatus; required = $requiredList.Contains('templates');   evidence = $templatesEvidence },
    [PSCustomObject]@{ id = 'stage-gates'; status = $stageGateStatus; required = $requiredList.Contains('stage-gates'); evidence = $stageGateEvidence }
)

$failures = [System.Collections.Generic.List[string]]::new()
foreach ($comp in $components) {
    if ($comp.status -eq 'failed') {
        $failures.Add("Component '$($comp.id)' failed: $($comp.evidence)")
    } elseif ($comp.required -and $comp.status -ne 'verified') {
        $failures.Add("Required component '$($comp.id)' was not exercised ($($comp.status)).")
    }
}

$passed = $failures.Count -eq 0
$safeSessionName = ($resolvedSessionId -replace '[^a-zA-Z0-9._-]', '_')
if ([string]::IsNullOrWhiteSpace($safeSessionName)) { $safeSessionName = 'workspace-latest' }
$provenanceDir = Join-Path $stateRoot 'state' 'provenance'
if (-not (Test-Path -LiteralPath $provenanceDir)) {
    New-Item -ItemType Directory -Path $provenanceDir -Force | Out-Null
}
$provenanceFile = Join-Path $provenanceDir "$safeSessionName.provenance.json"

$report = [ordered]@{
    version       = 1
    checkedAt     = [DateTimeOffset]::UtcNow.ToString('o')
    workspaceRoot = $root
    stateRoot     = $stateRoot
    agent         = $Agent
    sessionId     = $resolvedSessionId
    passed        = $passed
    required      = @($requiredList)
    components    = $components
    failures      = @($failures)
    reportPath    = $provenanceFile
}

$jsonText = $report | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($provenanceFile, "$jsonText`n", [Text.UTF8Encoding]::new($false))

if ($Json) {
    [Console]::Out.WriteLine(($report | ConvertTo-Json -Depth 8 -Compress))
} else {
    $marker = if ($passed) { '[PASS]' } else { '[FAIL]' }
    Write-Host "`n  $marker Frontier Session Provenance ($resolvedSessionId)"
    if ($Agent) { Write-Host "  Agent:   $Agent" }
    Write-Host "  Saved:   $provenanceFile`n"
    foreach ($comp in $components) {
        $reqTag = if ($comp.required) { ' (required)' } else { '' }
        Write-Host ("    {0,-14} {1,-15} {2}{3}" -f $comp.id, $comp.status, $comp.evidence, $reqTag)
    }
    if ($failures.Count -gt 0) {
        Write-Host "`n  Failures:"
        foreach ($f in $failures) { Write-Host "    - $f" }
    }
    Write-Host ""
}

exit $(if ($passed) { 0 } else { 1 })
