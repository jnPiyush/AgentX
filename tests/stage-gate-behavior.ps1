#!/usr/bin/env pwsh
#Requires -Version 7.0
# Behavior tests for scripts/score-stage-gate.ps1 and its `frontier validate` wiring.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$evaluatorPath = Join-Path $repoRoot 'scripts/score-stage-gate.ps1'
$catalogPath = Join-Path $repoRoot 'evaluation/rubrics/stage-gates.json'
$cliPath = Join-Path $repoRoot '.agentx/agentx-cli.ps1'
$pwshPath = (Get-Process -Id $PID).Path
$script:passCount = 0
$script:failCount = 0
$runRoot = Join-Path ([IO.Path]::GetTempPath()) "frontier-stage-gate-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

function Assert-True([bool]$Condition, [string]$Name) {
    if ($Condition) { $script:passCount++; Write-Host "[PASS] $Name" }
    else { $script:failCount++; Write-Host "[FAIL] $Name" }
}

function Invoke-Process([string]$Script, [string[]]$Arguments, [string]$WorkingDirectory, [hashtable]$Environment = @{}) {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new($pwshPath)
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.Environment['NO_COLOR'] = '1'
    foreach ($key in $Environment.Keys) { $startInfo.Environment[$key] = $Environment[$key] }
    foreach ($argument in @('-NoProfile', '-File', $Script) + $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $stdout.Result + $stderr.Result }
}

function Invoke-Gate([string]$Workspace, [string[]]$Arguments) {
    $result = Invoke-Process $evaluatorPath (@($Arguments) + @('-WorkspaceRoot', $Workspace, '-Json')) $Workspace
    $json = $null
    try { $json = $result.Output.Trim() | ConvertFrom-Json -Depth 20 } catch { $json = $null }
    return [PSCustomObject]@{ ExitCode = $result.ExitCode; Json = $json; Output = $result.Output }
}

function Invoke-Cli([string]$Workspace, [string[]]$Arguments) {
    return Invoke-Process $cliPath $Arguments $Workspace @{ FRONTIER_WORKSPACE_ROOT = $Workspace }
}

function Write-Text([string]$Workspace, [string]$RelativePath, [string]$Content) {
    $target = Join-Path $Workspace $RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Set-Content -LiteralPath $target -Value $Content -Encoding utf8 -NoNewline
}

function Get-Sha([string]$Workspace, [string]$RelativePath) {
    # The gate hashes UTF-8 text with LF line endings (evaluation/rubrics/stage-gates.md).
    $text = [IO.File]::ReadAllText((Join-Path $Workspace $RelativePath)).Replace("`r`n", "`n")
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($text)))
}

function New-Report([string]$Workspace, [string]$Stage, [string[]]$Files, [int]$Score = 4, [scriptblock]$Mutate = $null) {
    $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
    $stageDef = $catalog.stages.PSObject.Properties[$Stage].Value
    $report = [PSCustomObject]@{
        rubricVersion = $catalog.version
        stage         = $Stage
        reviewer      = 'independent-reviewer'
        author        = 'author-agent'
        reviewedAt    = [datetimeoffset]::UtcNow.AddMinutes(-1).ToString('o')
        files         = @($Files | ForEach-Object { [PSCustomObject]@{ path = $_; sha256 = (Get-Sha $Workspace $_) } })
        dimensions    = @($stageDef.dimensions | ForEach-Object {
                [PSCustomObject]@{ id = $_.id; score = $Score; evidence = "Checked $($_.id) against the artifact text."; findings = @() }
            })
    }
    if ($Mutate) { & $Mutate $report }
    $path = Join-Path $Workspace 'report.json'
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding utf8
    return $path
}

$prd = @'
# PRD-7: Export Reports

## 1. Problem Statement
Analysts copy tables by hand.

## 2. Target Users
Finance analysts.

## 3. Goals & Success Metrics
Cut export time from 20 minutes to 2 minutes, measured by task timing.

## 4. Requirements
FR-1 Export to CSV.

**Acceptance Criteria**: Given a report, when the analyst exports, then a CSV downloads.

## 5. User Stories
As an analyst I export a report.

## 6. Out of Scope
PDF export.

```text
Example token {inside_code} is ignored inside fences.
```

Inline `{inline_token}` is ignored too.
'@

$adr = @'
# ADR-7

## Context
Need exports.

## Decision
Option 1.

## Options Considered
### Option 1: Server export
### Option 2: Client export
### Option 3: Scheduled export

## Rationale
Lowest risk.

## Consequences
More server load.

```mermaid
graph TD; A-->B
```
'@

$spec = @'
# SPEC-7

## 1. Overview
Export service.

## 2. Architecture Diagrams
Diagram below.

## 3. Security
Role-based access.

## 4. Testing Strategy
Contract tests.

## 5. Rollout Plan
Feature flag.

## 6. Risks & Mitigations
Load spikes.

## 7. Monitoring & Observability
Export latency metric.
'@

try {
    # --- Invalid input --------------------------------------------------------
    $ws = Join-Path $runRoot 'inputs'
    Write-Text $ws 'docs/artifacts/prd/PRD-7.md' $prd
    Write-Text $ws 'docs/notes.md' '# Notes'

    $r = Invoke-Gate $ws @('Plan', '-Stage', 'nonsense', '-Path', 'docs/artifacts/prd/PRD-7.md')
    Assert-True ($r.ExitCode -eq 2 -and $r.Json.status -eq 'invalid' -and $r.Json.message -match 'score-code-quality') 'Unknown stage is invalid and points implementation to the code-quality gate'
    $r = Invoke-Gate $ws @('Plan', '-Stage', 'requirements')
    Assert-True ($r.ExitCode -eq 2) 'Missing -Path is invalid'
    $r = Invoke-Gate $ws @('Plan', '-Stage', 'requirements', '-Path', 'docs/notes.md')
    Assert-True ($r.ExitCode -eq 2 -and $r.Json.message -match 'PRD-\*\.md') 'Artifact that does not match the stage glob is invalid'
    $outside = Join-Path $runRoot 'PRD-9.md'
    Set-Content -LiteralPath $outside -Value $prd -Encoding utf8
    $r = Invoke-Gate $ws @('Plan', '-Stage', 'requirements', '-Path', $outside)
    Assert-True ($r.ExitCode -eq 2 -and $r.Json.message -match 'inside the workspace') 'Artifact outside the workspace root is invalid'

    # --- Deterministic checks -------------------------------------------------
    $r = Invoke-Gate $ws @('Plan', '-Stage', 'requirements', '-Path', 'docs/artifacts/prd/PRD-7.md')
    Assert-True ($r.ExitCode -eq 0 -and $r.Json.status -eq 'ready') 'Complete PRD passes deterministic checks (tokens in code are ignored)'
    Assert-True ($r.Json.files[0].sha256 -eq (Get-Sha $ws 'docs/artifacts/prd/PRD-7.md')) 'Plan binds the artifact SHA-256'
    Assert-True (@($r.Json.reportTemplate.dimensions).Count -eq 7 -and $r.Json.suggestedReportPath -eq 'docs/artifacts/reviews/gates/GATE-requirements-7.json') 'Plan emits a report template and the conventional report path'
    $rootEnv = @{ FRONTIER_WORKSPACE_ROOT = ''; HVE_WORKSPACE_ROOT = $ws; AGENTX_WORKSPACE_ROOT = $runRoot }
    $r = Invoke-Process $evaluatorPath @('Plan', '-Stage', 'requirements', '-Path', 'docs/artifacts/prd/PRD-7.md', '-Json') $runRoot $rootEnv
    Assert-True ($r.ExitCode -eq 0) 'HVE_WORKSPACE_ROOT is used before AGENTX_WORKSPACE_ROOT when -WorkspaceRoot is omitted'

    Write-Text $ws 'docs/artifacts/prd/PRD-8.md' (($prd -replace '## 6. Out of Scope', '## 6. Later') + "`n`nOwner: {Name}`n")
    $r = Invoke-Gate $ws @('Plan', '-Stage', 'requirements', '-Path', 'docs/artifacts/prd/PRD-8.md')
    $failedIds = @($r.Json.checks | Where-Object { -not $_.passed } | ForEach-Object id)
    Assert-True ($r.ExitCode -eq 1 -and 'section:out of scope' -in $failedIds -and 'placeholders' -in $failedIds) 'Missing section and unfilled placeholder block the gate'

    $arch = Join-Path $runRoot 'architecture'
    Write-Text $arch 'docs/artifacts/adr/ADR-7.md' $adr
    Write-Text $arch 'docs/artifacts/specs/SPEC-7.md' $spec
    $r = Invoke-Gate $arch @('Plan', '-Stage', 'architecture', '-Path', 'docs/artifacts/adr/ADR-7.md,docs/artifacts/specs/SPEC-7.md')
    Assert-True ($r.ExitCode -eq 0 -and @($r.Json.files).Count -eq 2) 'ADR and SPEC pass together via a comma-separated -Path'
    $r = Invoke-Gate $arch @('Plan', '-Stage', 'architecture', '-Path', 'docs/artifacts/adr/ADR-7.md')
    Assert-True ($r.ExitCode -eq 1 -and 'artifact:spec' -in @($r.Json.checks | Where-Object { -not $_.passed } | ForEach-Object id)) 'Architecture gate requires the SPEC'
    Write-Text $arch 'docs/artifacts/adr/ADR-8.md' ($adr -replace '### Option 3: Scheduled export', '')
    Write-Text $arch 'docs/artifacts/specs/SPEC-8.md' ($spec + "`n``````python`nprint('x')`n```````n`n```````nuntagged`n```````n")
    $r = Invoke-Gate $arch @('Plan', '-Stage', 'architecture', '-Path', 'docs/artifacts/adr/ADR-8.md,docs/artifacts/specs/SPEC-8.md')
    $failed = @($r.Json.checks | Where-Object { -not $_.passed })
    $fenceCheck = $failed | Where-Object { $_.id -eq 'diagram-fences' } | Select-Object -First 1
    Assert-True ($r.ExitCode -eq 1 -and 'pattern:three-options' -in @($failed.id)) 'Fewer than three ADR options blocks the gate'
    Assert-True ($fenceCheck -and $fenceCheck.message -match 'python' -and $fenceCheck.message -match 'untagged') 'Non-diagram and untagged fences in a SPEC block the gate'

    $review = Join-Path $runRoot 'review'
    Write-Text $review 'docs/artifacts/reviews/REVIEW-7.md' "# Review`n`n## Decision`n**Status**: [PASS] APPROVED`n"
    Write-Text $review 'docs/artifacts/reviews/REVIEW-8.md' "# Review`n`n## 14. Decision`n`n**CHANGES REQUESTED**`n"
    Write-Text $review 'docs/artifacts/reviews/REVIEW-9.md' "# Review`n`n## Decision`n**Status**: NOT ASSESSED`n"
    Assert-True ((Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-7.md')).ExitCode -eq 0) 'Inline verdict line satisfies the review decision check'
    Assert-True ((Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-8.md')).ExitCode -eq 0) 'Verdict under a Decision heading satisfies the review decision check'
    $r = Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-9.md')
    $failedIds = @($r.Json.checks | Where-Object { -not $_.passed } | ForEach-Object id)
    Assert-True ($r.ExitCode -eq 1 -and 'decision' -in $failedIds -and 'placeholders' -in $failedIds) 'NOT ASSESSED verdict fails decision and placeholder checks'
    $decisionCases = @(
        @{ Text = "# Review`n`n## Decision`n- [ ] APPROVED`n- [x] CHANGES REQUESTED`n"; Pass = $true; Name = 'A checked box under a Decision heading is the verdict' },
        @{ Text = "# Review`n`n## Decision`n- [ ] APPROVED`n- [ ] BLOCKED`n"; Pass = $false; Name = 'Unchecked boxes are not a verdict' },
        @{ Text = "# Review`n`nDecision: APPROVED | CHANGES REQUESTED | BLOCKED`n"; Pass = $false; Name = 'An unfilled option list is not a verdict' },
        @{ Text = "# Review`n`nDecision: not yet decided; APPROVED only after rework`n"; Pass = $false; Name = 'A hedged decision line is not a verdict' },
        @{ Text = "# Review`n`nDecision: [TODO] APPROVED`n"; Pass = $false; Name = 'A [TODO] marker is not a verdict' },
        @{ Text = "# Review`n`n## Decision`n- [x] APPROVED`n- [x] BLOCKED`n"; Pass = $false; Name = 'Two checked verdicts under one heading are not a decision' },
        @{ Text = "# Review`n`nVerdict: approved? not sure yet`n"; Pass = $false; Name = 'A questioned verdict is not a decision' },
        @{ Text = "# Review`n`nDecision: APPROVED pending security sign-off`n"; Pass = $false; Name = 'A pending verdict is not a decision' },
        @{ Text = "# Review`n`n## Decision Log`nAPPROVED the parser change.`n"; Pass = $false; Name = 'A Decision Log heading is not a decision heading' },
        @{ Text = "# Review`n`nDecision: APPROVED - two LOW items pending in the backlog.`n"; Pass = $true; Name = 'Rationale after a dash may mention pending work' },
        @{ Text = "# Review`n`n## Decision`n**APPROVED**`nApproved because every check passed.`n"; Pass = $true; Name = 'Repeating the same verdict under a heading is one decision' },
        @{ Text = "# Review`n`nDecision: [FAIL] CHANGES REQUESTED`n"; Pass = $true; Name = 'A [FAIL] marker may precede the verdict' },
        @{ Text = "# Review`n`nDecision: [FAIL] APPROVED`n"; Pass = $false; Name = 'A [FAIL] marker contradicting the verdict is not a decision' },
        @{ Text = "# Review`n`n**Status**: [PASS] BLOCKED`n"; Pass = $false; Name = 'A [PASS] marker contradicting the verdict is not a decision' },
        @{ Text = "# Review`n`n### Verdict`n**Status**: [WARN] CHANGES REQUESTED`n"; Pass = $true; Name = 'A [WARN] marker may precede the verdict' },
        @{ Text = "# Review`n`nDecision: APPROVED if the smoke test passes`n"; Pass = $false; Name = 'A conditional approval is not a decision' },
        @{ Text = "# Review`n`nDecision: APPROVED subject to legal review`n"; Pass = $false; Name = 'An approval subject to a later check is not a decision' },
        @{ Text = "# Review`n`nDecision: BLOCKED awaiting security review`n"; Pass = $true; Name = 'A rejection may name what it awaits' },
        @{ Text = "# Review`n`n## 1. Executive Summary`n**Status**: APPROVED`n`n## 14. Decision`n**Status**: CHANGES REQUESTED`n"; Pass = $false; Name = 'Contradictory verdicts in one review are not a decision' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## 14. Decision`nDecision: APPROVED`n`nStatus: APPROVED`n"; Pass = $true; Name = 'Matching summary, decision and signature verdicts pass' },
        @{ Text = "# Review`n`n**Status**: CHANGES REQUESTED`n`nDecision: BLOCKED`n"; Pass = $true; Name = 'Two rejecting verdicts agree on approval' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`nDecision: APPROVED if the CI rerun passes`n"; Pass = $false; Name = 'A conditional decision line fails beside a clean verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`nDecision: NOT APPROVED`n"; Pass = $false; Name = 'A negated verdict fails beside a clean verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`n- [x] APPROVED`n- [x] CHANGES REQUESTED`n"; Pass = $false; Name = 'Two checked verdicts fail beside a clean verdict' },
        @{ Text = "# Review`n`nDecision: APPROVED conditionally`n"; Pass = $false; Name = 'A conditionally worded approval is not a decision' },
        @{ Text = "# Review`n`nDecision: APPROVED with conditions`n"; Pass = $false; Name = 'An approval with conditions is not a decision' },
        @{ Text = "# Review`n`nDecision: APPROVED for v2.0 if CI passes`n"; Pass = $false; Name = 'A version number does not end the verdict clause' },
        @{ Text = "# Review`n`nDecision: APPROVED (probably)`n"; Pass = $false; Name = 'A probable approval is not a decision' },
        @{ Text = "# Review`n`nDecision: APPROVED as provided in PR 12`n"; Pass = $true; Name = 'Provided as a verb is not a condition' },
        @{ Text = "# Review`n`nDecision: _CHANGES REQUESTED_`n"; Pass = $true; Name = 'An underscore-emphasized verdict is read' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`nDecision: **NOT** APPROVED`n"; Pass = $false; Name = 'An emphasized negation fails beside a clean verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`nDecision: NOT YET APPROVED`n"; Pass = $false; Name = 'NOT YET APPROVED fails beside a clean verdict' },
        @{ Text = "# Review`n`n## Decision`nAPPROVED`nBlocked items: none.`nApproved because every gate passed.`n"; Pass = $true; Name = 'One-word labels opening with a verdict word under a heading are prose' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`nAPPROVED if the CI rerun passes`n"; Pass = $false; Name = 'A conditional approval under a heading fails beside a clean verdict' },
        @{ Text = "# Review`n`nDecision: APPROVED provided the tests pass`n"; Pass = $false; Name = 'Provided as a condition voids an approval' },
        @{ Text = "# Review`n`nDecision: APPROVED on condition that the smoke test passes`n"; Pass = $false; Name = 'On condition that voids an approval' },
        @{ Text = "# Review`n`nDecision: APPROVED (see sec. 3) if CI passes`n"; Pass = $false; Name = 'An abbreviation does not end the verdict clause' },
        @{ Text = "# Review`n`nDecision: APPROVED because the tests pass when run on Linux`n"; Pass = $true; Name = 'Rationale after because may use condition words' },
        @{ Text = "# Review`n`nDecision: APPROVED - no BLOCKED or REJECTED findings remain`n"; Pass = $true; Name = 'Rationale may name other verdicts' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`nNOT APPROVED until F1 is fixed`n"; Pass = $false; Name = 'A negated verdict with rationale under a heading fails beside a clean verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`nCHANGES REQUESTED for F1 and F2`n"; Pass = $false; Name = 'A differing verdict with rationale under a heading is a conflict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`nApproved tentatively`n"; Pass = $false; Name = 'A hedged sentence-case verdict under a heading fails beside a clean verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`nDecision: NOT-APPROVED`n"; Pass = $false; Name = 'A hyphenated negation fails beside a clean verdict' },
        @{ Text = "# Review`n`n## Decision`n| APPROVED | 2026-09-23 |`n"; Pass = $true; Name = 'A verdict followed by a date in a table row is a verdict' },
        @{ Text = "# Review`n`n**Status**: APPROVED`n`n## Decision`nRejected: the design violates the API contract.`n"; Pass = $false; Name = 'A sentence-case verdict with a colon under a heading is a verdict' }
    )
    foreach ($case in $decisionCases) {
        Write-Text $review 'docs/artifacts/reviews/REVIEW-10.md' $case.Text
        $r = Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-10.md')
        Assert-True ((@($r.Json.checks | Where-Object { $_.id -eq 'decision' -and $_.passed }).Count -eq 1) -eq $case.Pass) $case.Name
    }
    Write-Text $review 'docs/artifacts/reviews/REVIEW-13.md' ("# Review`n`n## Decision`n" + ('*' * 20000) + "`n`nDecision: APPROVED" + (' ' * 20000) + "x`n")
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-13.md')
    $watch.Stop()
    Assert-True ($r.ExitCode -eq 0 -and $watch.Elapsed.TotalSeconds -lt 20) "20,000-character emphasis and space runs are checked in linear time ($([int]$watch.Elapsed.TotalSeconds) s)"
    Write-Text $review 'docs/artifacts/reviews/REVIEW-11.md' "# Review`n`n**Status**: APPROVED`n`nDecision: CHANGES REQUESTED`n"
    $r = Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-11.md')
    $conflictCheck = $r.Json.checks | Where-Object { $_.id -eq 'decision' } | Select-Object -First 1
    Assert-True ($conflictCheck -and $conflictCheck.message -match 'APPROVED \(line 3\) and CHANGES REQUESTED \(line 5\)') 'The conflict message names both verdict lines'
    Write-Text $review 'docs/artifacts/reviews/REVIEW-12.md' "# Review`n`nDecision: APPROVED if CI passes`n"
    $r = Invoke-Gate $review @('Plan', '-Stage', 'review', '-Path', 'docs/artifacts/reviews/REVIEW-12.md')
    $voidCheck = $r.Json.checks | Where-Object { $_.id -eq 'decision' } | Select-Object -First 1
    Assert-True ($voidCheck -and $voidCheck.message -match 'Line 3 .*conditional approval') 'A void verdict line is reported with its line and reason'

    $cert = Join-Path $runRoot 'cert'
    $certBase = "# CERT-7`n`n## Test Results`n12 passed.`n`n## Defects`nNone open.`n`n"
    $certCases = @(
        @{ Text = $certBase + "## Certification Decision`n`nPASS - all suites green.`n"; Pass = $true; Name = "The Tester's Certification Decision heading passes" },
        @{ Text = $certBase + "| Section | Content |`n|---|---|`n| Certification Decision | CONDITIONAL PASS |`n"; Pass = $true; Name = 'A Certification Decision table row passes' },
        @{ Text = $certBase + "**Decision**: NO-GO`n"; Pass = $true; Name = 'NO-GO is read as one verdict' },
        @{ Text = $certBase + "| Certification Decision | PASS / CONDITIONAL PASS / FAIL with rationale |`n"; Pass = $false; Name = 'The template option list is not a certification verdict' },
        @{ Text = $certBase + "**Decision**: PASS if the P2 defects are fixed`n"; Pass = $false; Name = 'A PASS with a condition is not a certification verdict' },
        @{ Text = $certBase + "**Decision**: CONDITIONAL PASS if the two P2 defects are fixed before release`n"; Pass = $true; Name = 'A CONDITIONAL PASS may state its condition' },
        @{ Text = $certBase + "**Certification Decision**: PASS`n`n## Go / No-Go Decision`nGO - release approved.`n"; Pass = $true; Name = 'PASS and GO agree on approval' },
        @{ Text = $certBase + "**Certification Decision**: PASS`n`n**Decision**: NO-GO`n"; Pass = $false; Name = 'PASS and NO-GO conflict' },
        @{ Text = $certBase + "**Certification Decision**: PASS`n`n**Decision**: NOT GO`n"; Pass = $false; Name = 'A negated GO fails beside a PASS' },
        @{ Text = $certBase + "**Decision**: PASS (conditional)`n"; Pass = $false; Name = 'A PASS marked conditional is not a certification verdict' },
        @{ Text = $certBase + "## Certification Decision`n`nPASS - all suites green.`nPass rate: 91%.`nFail Count: 0.`nGo-live is Monday.`n"; Pass = $true; Name = 'Certification sentences opening with a verdict word are prose' },
        @{ Text = $certBase + "## Certification Decision`n`nPASS`nGO - release approved.`n"; Pass = $true; Name = 'PASS and GO under one heading agree' },
        @{ Text = $certBase + "**Decision**: PASS - see the pass/fail breakdown`n"; Pass = $true; Name = 'An option-like rationale after a dash is free text' },
        @{ Text = $certBase + "**Decision**: PASS`n`n## Status`n`n- PASS: 120 tests`n- FAIL: 0 tests`n`n| PASS | 120 |`n| FAIL | 0 |`n"; Pass = $true; Name = 'Pass and fail tallies under a Status heading are prose' },
        @{ Text = $certBase + "## Certification Decision`n`n**Go / No-Go**: GO`n"; Pass = $true; Name = 'A labeled verdict under a decision heading is read once' }
    )
    foreach ($case in $certCases) {
        Write-Text $cert 'docs/testing/CERT-7.md' $case.Text
        $r = Invoke-Gate $cert @('Plan', '-Stage', 'certification', '-Path', 'docs/testing/CERT-7.md')
        Assert-True (($r.ExitCode -eq 0) -eq $case.Pass) $case.Name
    }

    # The canonical templates satisfy their own zero-code fence rule (placeholders still fail).
    $templateWs = Join-Path $runRoot 'templates'
    Write-Text $templateWs 'docs/artifacts/adr/ADR-1.md' (Get-Content -LiteralPath (Join-Path $repoRoot '.github/templates/ADR-TEMPLATE.md') -Raw)
    Write-Text $templateWs 'docs/artifacts/specs/SPEC-1.md' (Get-Content -LiteralPath (Join-Path $repoRoot '.github/templates/SPEC-TEMPLATE.md') -Raw)
    $r = Invoke-Gate $templateWs @('Plan', '-Stage', 'architecture', '-Path', 'docs/artifacts/adr/ADR-1.md,docs/artifacts/specs/SPEC-1.md')
    $fenceChecks = @($r.Json.checks | Where-Object { $_.id -eq 'diagram-fences' })
    Assert-True ($fenceChecks.Count -eq 2 -and @($fenceChecks | Where-Object { -not $_.passed }).Count -eq 0) 'ADR and SPEC templates use diagram-only fences'

    $ux = Join-Path $runRoot 'ux'
    $uxDoc = "# UX-7`n`n## User Flows`nExport flow.`n`n## Accessibility`nKeyboard path.`n`n## Responsive Design`nTwo breakpoints.`n`nPrototype: ``docs/ux/prototypes/export/index.html``.`n"
    Write-Text $ux 'docs/ux/UX-7.md' $uxDoc
    $r = Invoke-Gate $ux @('Plan', '-Stage', 'ux', '-Path', 'docs/ux/UX-7.md')
    Assert-True ($r.ExitCode -eq 1 -and 'linked:prototype' -in @($r.Json.checks | Where-Object { -not $_.passed } | ForEach-Object id)) 'UX gate blocks when the referenced prototype does not exist'
    Write-Text $ux 'docs/ux/prototypes/export/index.html' '<!doctype html><title>Export</title>'
    Assert-True ((Invoke-Gate $ux @('Plan', '-Stage', 'ux', '-Path', 'docs/ux/UX-7.md')).ExitCode -eq 0) 'UX gate passes once the prototype exists (inline-code path counts)'

    # --- Report validation ----------------------------------------------------
    $prdPath = 'docs/artifacts/prd/PRD-7.md'
    $gateArgs = @('Validate', '-Stage', 'requirements', '-Path', $prdPath)
    $report = New-Report $ws 'requirements' @($prdPath)
    $r = Invoke-Gate $ws ($gateArgs + @('-ReportPath', $report))
    Assert-True ($r.ExitCode -eq 0 -and $r.Json.status -eq 'passed' -and $r.Json.score -eq 100) 'Complete independent report passes at 100/100'

    # A CRLF checkout of the same content validates against a report bound to LF text.
    $lfText = [IO.File]::ReadAllText((Join-Path $ws $prdPath)).Replace("`r`n", "`n")
    [IO.File]::WriteAllText((Join-Path $ws $prdPath), $lfText.Replace("`n", "`r`n"))
    $r = Invoke-Gate $ws ($gateArgs + @('-ReportPath', $report))
    Assert-True ($r.ExitCode -eq 0 -and $r.Json.status -eq 'passed') 'Line endings do not change the artifact hash'
    [IO.File]::WriteAllText((Join-Path $ws $prdPath), $lfText)

    $r = Invoke-Gate $ws $gateArgs
    Assert-True ($r.ExitCode -eq 1 -and ($r.Json.failures -join ' ') -match 'reviewer report is required') 'Validate without a report is blocked'

    $cases = @(
        @{ Name = 'Placeholder evidence is rejected'; Pattern = 'placeholder'; Mutate = { param($x) $x.dimensions[0].evidence = 'TODO' } },
        @{ Name = 'Blocking dimension below its floor is rejected'; Pattern = 'blocking floor'; Mutate = { param($x) $x.dimensions[0].score = 2 } },
        @{ Name = 'Open MEDIUM finding blocks the gate'; Pattern = 'MEDIUM finding'; Mutate = { param($x) $x.dimensions[1].findings = @([PSCustomObject]@{ severity = 'medium'; file = 'PRD-7.md'; issue = 'Gap'; suggestedFix = 'Fill it' }) } },
        @{ Name = 'Reviewer equal to author is rejected'; Pattern = 'independent of the author'; Mutate = { param($x) $x.author = 'Independent-Reviewer' } },
        @{ Name = 'Missing dimension is rejected'; Pattern = 'Missing dimension'; Mutate = { param($x) $x.dimensions = @($x.dimensions | Select-Object -Skip 1) } },
        @{ Name = 'Unknown dimension is rejected'; Pattern = 'Unknown dimension'; Mutate = { param($x) $x.dimensions += [PSCustomObject]@{ id = 'vibes'; score = 4; evidence = 'n'; findings = @() } } },
        @{ Name = 'String score is rejected'; Pattern = 'integer from 0 to 4'; Mutate = { param($x) $x.dimensions[0].score = '4' } },
        @{ Name = 'Boolean score is rejected'; Pattern = 'integer from 0 to 4'; Mutate = { param($x) $x.dimensions[0].score = $true } },
        @{ Name = 'Future reviewedAt is rejected'; Pattern = 'future'; Mutate = { param($x) $x.reviewedAt = [datetimeoffset]::UtcNow.AddHours(2).ToString('o') } },
        @{ Name = 'Wrong rubric version is rejected'; Pattern = 'rubricVersion'; Mutate = { param($x) $x.rubricVersion = '0.0.1' } },
        @{ Name = 'Report listing a non-gated file is rejected'; Pattern = 'not a gated artifact'; Mutate = { param($x) $x.files += [PSCustomObject]@{ path = 'docs/notes.md'; sha256 = 'AB' } } }
    )
    foreach ($case in $cases) {
        $report = New-Report $ws 'requirements' @($prdPath) -Mutate $case.Mutate
        $r = Invoke-Gate $ws ($gateArgs + @('-ReportPath', $report))
        Assert-True ($r.ExitCode -eq 1 -and ($r.Json.failures -join ' ') -match $case.Pattern) $case.Name
    }

    $report = New-Report $ws 'requirements' @($prdPath) -Score 3
    $r = Invoke-Gate $ws ($gateArgs + @('-ReportPath', $report))
    Assert-True ($r.ExitCode -eq 1 -and $r.Json.score -eq 75 -and ($r.Json.failures -join ' ') -match 'below the minimum 80') 'All-3 report (75/100) is below the weighted minimum'

    $report = New-Report $ws 'requirements' @($prdPath)
    Add-Content -LiteralPath (Join-Path $ws $prdPath) -Value "`nLate edit after review." -Encoding utf8
    $r = Invoke-Gate $ws ($gateArgs + @('-ReportPath', $report))
    Assert-True ($r.ExitCode -eq 1 -and ($r.Json.failures -join ' ') -match 'SHA-256') 'Editing the artifact after review invalidates the report'

    Write-Text $ws 'docs/artifacts/prd/PRD-7.md' $prd
    $report = New-Report $ws 'requirements' @('docs/artifacts/prd/PRD-8.md')
    $r = Invoke-Gate $ws @('Validate', '-Stage', 'requirements', '-Path', 'docs/artifacts/prd/PRD-8.md', '-ReportPath', $report)
    Assert-True ($r.ExitCode -eq 1 -and ($r.Json.failures -join ' ') -match 'Check failed') 'A valid report cannot pass an artifact that fails deterministic checks'

    # --- frontier validate wiring ----------------------------------------------
    $cli = Join-Path $runRoot 'cli'
    Write-Text $cli 'docs/artifacts/prd/PRD-7.md' $prd
    Write-Text $cli 'docs/artifacts/prd/PRD-8.md' ($prd -replace '## 6. Out of Scope', '## 6. Later')
    New-Item -ItemType Directory -Path (Join-Path $cli 'tests') -Force | Out-Null
    Write-Text $cli 'docs/testing/CERT-7.md' "# CERT-7`n`n## Test Results`n12 passed.`n`n## Defects`nNone open.`n`n## Go / No-Go Decision`n**Decision**: PASS`n"

    $r = Invoke-Cli $cli @('validate', '8', 'pm')
    Assert-True ($r.ExitCode -eq 0 -and $r.Output -match '\[WARN\] Stage gate') 'Advisory mode warns on failing checks without blocking the handoff'
    $r = Invoke-Cli $cli @('validate', '7', 'tester')
    Assert-True ($r.ExitCode -eq 0 -and $r.Output -match 'CERT-7\.md' -and $r.Output -match "Stage gate 'certification' deterministic checks") 'Tester handoff accepts CERT-<issue>.md and runs the certification gate'

    Write-Text $cli '.frontier/config.json' '{ "provider": "local", "stageGates": "required" }'
    $r = Invoke-Cli $cli @('validate', '8', 'pm')
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match '\[FAIL\] Stage gate') 'Required mode blocks failing deterministic checks'
    $r = Invoke-Cli $cli @('validate', '7', 'pm')
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match 'review report exists') 'Required mode blocks a handoff without a review report'
    Write-Text $cli 'scripts/score-stage-gate.ps1' "[Console]::Out.WriteLine('{`"status`":`"passed`",`"checks`":[]}'); exit 0"
    Write-Text $cli 'docs/artifacts/reviews/gates/GATE-requirements-7.json' '{}'
    $r = Invoke-Cli $cli @('validate', '7', 'pm')
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match 'rubricVersion') 'A workspace copy of the evaluator cannot shadow the installed gate'
    Remove-Item -LiteralPath (Join-Path $cli 'scripts') -Recurse -Force
    $gateReport = New-Report $cli 'requirements' @($prdPath)
    Write-Text $cli 'docs/artifacts/reviews/gates/GATE-requirements-7.json' (Get-Content -LiteralPath $gateReport -Raw)
    $r = Invoke-Cli $cli @('validate', '7', 'pm')
    Assert-True ($r.ExitCode -eq 0 -and $r.Output -match 'review report 100/100') 'Required mode passes with a valid conventional report'

    Write-Text $cli '.frontier/config.json' '{ "provider": "local" }'
    Add-Content -LiteralPath (Join-Path $cli $prdPath) -Value "`nEdited." -Encoding utf8
    $r = Invoke-Cli $cli @('validate', '7', 'pm')
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match 'SHA-256') 'Advisory mode still fails a stale existing report'

    Write-Text $cli '.frontier/config.json' '{ "provider": "local", "stageGates": "off" }'
    $r = Invoke-Cli $cli @('validate', '7', 'pm')
    Assert-True ($r.ExitCode -eq 0 -and $r.Output -notmatch 'Stage gate') 'stageGates off skips the gate'

    Write-Text $cli '.frontier/config.json' '{ "provider": "local", "stageGates": "requried" }'
    $r = Invoke-Cli $cli @('validate', '8', 'pm')
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match 'Unknown stageGates' -and $r.Output -match '\[FAIL\] Stage gate') 'An unknown stageGates value fails closed as required'

    $r = Invoke-Cli $cli @('stage-gate', 'plan', '-Stage', 'requirements', '-Path', 'docs/artifacts/prd/PRD-8.md', '--json')
    $json = try { $r.Output.Trim() | ConvertFrom-Json } catch { $null }
    Assert-True ($r.ExitCode -eq 1 -and $json -and $json.status -eq 'blocked') 'frontier stage-gate maps --json and resolves paths from the workspace'

    # An installed runtime without the catalog degrades to a warning unless gates are required.
    $install = Join-Path $runRoot 'install'
    New-Item -ItemType Directory -Path (Join-Path $install '.agentx'), (Join-Path $install 'scripts') -Force | Out-Null
    Copy-Item -LiteralPath $cliPath -Destination (Join-Path $install '.agentx/agentx-cli.ps1')
    Copy-Item -LiteralPath $evaluatorPath -Destination (Join-Path $install 'scripts/score-stage-gate.ps1')
    $installedCli = Join-Path $install '.agentx/agentx-cli.ps1'
    Write-Text $cli '.frontier/config.json' '{ "provider": "local" }'
    $r = Invoke-Process $installedCli @('validate', '7', 'pm') $cli @{ FRONTIER_WORKSPACE_ROOT = $cli }
    Assert-True ($r.ExitCode -eq 0 -and $r.Output -match "\[WARN\] Stage gate 'requirements' unavailable") 'Advisory mode warns when the installed catalog is missing'
    Write-Text $cli '.frontier/config.json' '{ "provider": "local", "stageGates": "required" }'
    $r = Invoke-Process $installedCli @('validate', '7', 'pm') $cli @{ FRONTIER_WORKSPACE_ROOT = $cli }
    Assert-True ($r.ExitCode -eq 1 -and $r.Output -match 'catalog not found') 'Required mode fails when the installed catalog is missing'
} finally {
    Remove-Item -LiteralPath $runRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Results: $script:passCount passed, $script:failCount failed"
exit $(if ($script:failCount -eq 0) { 0 } else { 1 })
