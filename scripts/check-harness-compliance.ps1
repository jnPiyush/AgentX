param(
    [string]$BaseRef = "",
    [switch]$ReportOnly
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = if ($env:AGENTX_WORKSPACE_ROOT -and (Test-Path -LiteralPath $env:AGENTX_WORKSPACE_ROOT -PathType Container)) {
    (Resolve-Path $env:AGENTX_WORKSPACE_ROOT).Path
}
else {
    Split-Path $PSScriptRoot -Parent
}

function Get-ChangedFiles {
    param([string]$Base)

    $isGitWorkspace = @(git -C $workspaceRoot rev-parse --is-inside-work-tree 2>$null)
    if ($isGitWorkspace.Count -eq 0 -or [string]$isGitWorkspace[0] -ne 'true') { return @() }

    $gitTopLevel = @(git -C $workspaceRoot rev-parse --show-toplevel 2>$null)
    if ($gitTopLevel.Count -eq 0) { return @() }
    $resolvedWorkspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot).TrimEnd('\', '/')
    $resolvedGitTopLevel = [System.IO.Path]::GetFullPath([string]$gitTopLevel[0]).TrimEnd('\', '/')
    if (-not $resolvedWorkspaceRoot.Equals($resolvedGitTopLevel, [System.StringComparison]::OrdinalIgnoreCase)) { return @() }

    function Add-UntrackedFiles {
        param([string[]]$Files)

        $untracked = @(git -C $workspaceRoot status --short 2>$null |
            Where-Object { $_.StartsWith('?? ') } |
            ForEach-Object { $_.Substring(3).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

        return @($Files + $untracked | Select-Object -Unique)
    }

    $normalizedBase = $Base
    if (-not [string]::IsNullOrWhiteSpace($normalizedBase)) {
        $normalizedBase = $normalizedBase -replace '^refs/heads/', ''
        $normalizedBase = $normalizedBase -replace '^origin/', ''
    }

    if (-not [string]::IsNullOrWhiteSpace($normalizedBase)) {
        $range = "origin/$normalizedBase..HEAD"
        $files = @(git -C $workspaceRoot diff --name-only $range 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        return Add-UntrackedFiles -Files $files
    }

    $headRange = @(git -C $workspaceRoot diff --name-only HEAD~1..HEAD 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($headRange.Count -gt 0) { return Add-UntrackedFiles -Files $headRange }

    $files = @(git -C $workspaceRoot diff --name-only 2>$null) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    return Add-UntrackedFiles -Files $files
}

function Get-Domain {
    param([string]$File)

    if ($File -like 'docs/*') { return 'docs' }
    if ($File -like '.github/workflows/*') { return 'workflows' }
    if ($File -like 'vscode-extension/src/*') { return 'extension' }
    if ($File -like 'scripts/*') { return 'scripts' }
    if ($File -like '.github/templates/*') { return 'templates' }
    if ($File -like '.github/agents/*') { return 'agents' }
    if ($File -like 'tests/*' -or $File -like 'vscode-extension/src/test/*') { return 'tests' }
    return 'root'
}

function Test-RequiredSection {
    param(
        [string]$Content,
        [string]$Section
    )

    return $Content -match [regex]::Escape($Section)
}

function Test-EvidenceSignal {
    param([string]$Content)

    if ($Content -match 'Evidence:\s+\S+') { return $true }
    if ($Content -match '\[PASS\]|\[FAIL\]') { return $true }
    if ($Content -match 'Validation command:\s+\S+') { return $true }
    return $false
}

$changedFiles = @(Get-ChangedFiles -Base $BaseRef)
$changedCount = $changedFiles.Count
$codeLikePattern = '\.(ts|tsx|js|jsx|cs|py|go|rs|ps1|sh|yml|yaml|json)$'
$codeFileCount = @($changedFiles | Where-Object { $_ -match $codeLikePattern }).Count
$domainCount = @($changedFiles | ForEach-Object { Get-Domain $_ } | Select-Object -Unique).Count

$requiresPlan = $changedCount -ge 8 -or $codeFileCount -ge 4 -or $domainCount -ge 3
# docs/execution/plans/ is the canonical location; docs/plans/ is the legacy fallback
$planFiles = @($changedFiles | Where-Object { $_ -match '^docs/execution/plans/.+\.md$' -or $_ -match '^docs/plans/.+\.md$' -or $_ -match '(^|/)EXEC-PLAN.+\.md$' })

Write-Host "[INFO] Changed files: $changedCount"
Write-Host "[INFO] Code-like files: $codeFileCount"
Write-Host "[INFO] Domains touched: $domainCount"
Write-Host "[INFO] Requires execution plan: $requiresPlan"

$failures = @()

if ($requiresPlan -and $planFiles.Count -eq 0) {
    $failures += 'Complex work detected but no execution plan file was updated in this change set.'
}

$requiredSections = @(
    '## Purpose / Big Picture',
    '## Progress',
    '## Decision Log',
    '## Plan of Work',
    '## Validation and Acceptance',
    '## Artifacts and Notes'
)

foreach ($planFile in $planFiles) {
    if (-not (Test-Path $planFile)) {
        $failures += "Execution plan file '$planFile' was referenced by the diff but does not exist on disk."
        continue
    }

    $content = Get-Content -Path $planFile -Raw
    foreach ($section in $requiredSections) {
        if (-not (Test-RequiredSection -Content $content -Section $section)) {
            $failures += "Execution plan '$planFile' is missing required section '$section'."
        }
    }

    if (-not (Test-EvidenceSignal -Content $content)) {
        $failures += "Execution plan '$planFile' does not include any evidence signal in Validation or Artifacts sections."
    }
}

# ---------------------------------------------------------------------------
# CI parity gates
#
# These mirror gates that .github/hooks/pre-commit enforces locally. The hook
# only protects developers who installed it and is bypassed by
# `git commit --no-verify`, so the same rules are re-checked server-side.
#
# ADDED-ONLY SEMANTICS. The Council and Capture gates key on files ADDED in
# this change set, not files modified. Keying on "changed" would mean a
# one-character typo fix in an existing ADR hard-fails CI because that ADR
# predates the gate -- an unescapable trap, since the Council gate has no
# skip token. The rule is "a NEW ADR needs a council file", not "every ADR
# ever written must be retrofitted".
#
# NOT checkable in CI: the quality-loop iteration gate.
# `.agentx/state/loop-state.json` is untracked by design (per-developer
# working state), so CI has nothing to inspect. That gate remains hook-only.
# ---------------------------------------------------------------------------

function Get-AddedFiles {
    param([string]$Base)

    $normalized = $Base
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
        $normalized = $normalized -replace '^refs/heads/', ''
        $normalized = $normalized -replace '^origin/', ''
    }

    $added = @()
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
        $added = @(git -C $workspaceRoot diff --name-only --diff-filter=A "origin/$normalized..HEAD" 2>$null)
    }
    if ($added.Count -eq 0) {
        $added = @(git -C $workspaceRoot diff --name-only --diff-filter=A HEAD~1..HEAD 2>$null)
    }
    # Untracked files are additions by definition.
    $untracked = @(git -C $workspaceRoot status --short 2>$null |
        Where-Object { $_.StartsWith('?? ') } |
        ForEach-Object { $_.Substring(3).Trim() })

    return @(@($added + $untracked) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
}

$addedFiles = @(Get-AddedFiles -Base $BaseRef)

# Commit messages: fall back to the tip commit when no base ref is available.
# `git log ..HEAD` (empty base) returns nothing, which silently disabled the
# [skip-capture] bypass on push builds -- exactly the runs that need it.
$commitMessages = ''
try {
    if (-not [string]::IsNullOrWhiteSpace($BaseRef)) {
        $commitMessages = (git -C $workspaceRoot log "$BaseRef..HEAD" --format=%B 2>$null) -join "`n"
    }
    if ([string]::IsNullOrWhiteSpace($commitMessages)) {
        $commitMessages = (git -C $workspaceRoot log -1 --format=%B 2>$null) -join "`n"
    }
} catch { $commitMessages = '' }

# --- Model Council: a NEW ADR requires a matching COUNCIL file (no skip token)
$adrFiles = @($addedFiles | Where-Object { $_ -match '^docs/artifacts/adr/ADR-.+\.md$' })
foreach ($adr in $adrFiles) {
    if (-not (Test-Path -LiteralPath $adr)) { continue }
    $slug = [System.IO.Path]::GetFileNameWithoutExtension($adr) -replace '^ADR-', ''
    $councilPath = "docs/artifacts/adr/COUNCIL-$slug.md"
    if (-not (Test-Path -LiteralPath $councilPath)) {
        $failures += "Model Council gate: new ADR '$adr' has no matching '$councilPath'. This gate has no skip token."
        continue
    }
    $councilContent = Get-Content -LiteralPath $councilPath -Raw
    if (-not (Test-RequiredSection -Content $councilContent -Section '## Synthesis')) {
        $failures += "Model Council file '$councilPath' is missing the required '## Synthesis' section."
    }
}

# --- Compound Capture: a NEW approved review requires a matching LEARNING file
#
# The decision must be an explicit verdict line. A bare `-match 'APPROVED'`
# also fired on "NOT APPROVED", on "APPROVED: false", and on the rubric line
# that every review inherits from REVIEW-TEMPLATE.md
# ("APPROVED | CHANGES REQUESTED | REJECTED"), which matched 8 of 9 existing
# reviews.
$approvedPattern = '(?im)^\s*(?:[*_`\[\]\s]*)(?:\*\*)?(?:Decision|Status|Verdict|Outcome)(?:\*\*)?\s*[:=]\s*(?:\[PASS\]\s*)?(?:\*\*)?APPROVED(?:\*\*)?\s*$'
$reviewFiles = @($addedFiles | Where-Object { $_ -match '^docs/artifacts/reviews/REVIEW-.+\.md$' })
foreach ($review in $reviewFiles) {
    if (-not (Test-Path -LiteralPath $review)) { continue }
    $reviewContent = Get-Content -LiteralPath $review -Raw
    if ($reviewContent -notmatch $approvedPattern) { continue }
    if ($commitMessages -match '\[skip-capture\]') {
        Write-Host "[WARN] Compound Capture bypassed via [skip-capture] for '$review'."
        continue
    }
    $issue = ([System.IO.Path]::GetFileNameWithoutExtension($review)) -replace '^REVIEW-', ''
    $learningPath = "docs/artifacts/learnings/LEARNING-$issue.md"
    if (-not (Test-Path -LiteralPath $learningPath)) {
        $failures += "Compound Capture gate: approved review '$review' has no matching '$learningPath' (bypass: [skip-capture] in the commit message)."
    }
}

# --- Deslop scrub: HIGH-severity findings in changed files block the build
$scrubTargets = @($changedFiles | Where-Object { $_ -match '\.(ts|tsx|js|jsx|ps1|psm1|md)$' -and (Test-Path -LiteralPath $_) })
if ($scrubTargets.Count -gt 0 -and (Test-Path -LiteralPath 'scripts/scrub.ps1')) {
    $highFindings = @()
    $scrubErrors = @()
    foreach ($target in $scrubTargets) {
        $output = & pwsh -NoProfile -File 'scripts/scrub.ps1' -Path $target 2>&1
        $scrubExit = $LASTEXITCODE
        $high = @($output | Where-Object { $_ -match '\[HIGH/' })
        $highFindings += $high
        # Fail closed: a crash (missing module, parse error, bad path) must not
        # be indistinguishable from "no findings".
        if ($scrubExit -ne 0 -and $high.Count -eq 0) {
            $scrubErrors += "  $target -> scrub exited $scrubExit without reporting findings"
        }
    }
    if ($highFindings.Count -gt 0) {
        $failures += "Deslop scrub gate: $($highFindings.Count) HIGH-severity finding(s) in changed files. This gate has no skip token."
        foreach ($h in ($highFindings | Select-Object -First 10)) { Write-Host "  $h" }
    }
    if ($scrubErrors.Count -gt 0) {
        $failures += "Deslop scrub gate: $($scrubErrors.Count) file(s) could not be scanned. Treating as failure rather than success."
        foreach ($e in ($scrubErrors | Select-Object -First 10)) { Write-Host $e }
    }
    if ($highFindings.Count -eq 0 -and $scrubErrors.Count -eq 0) {
        Write-Host "[PASS] Scrub gate: no HIGH findings across $($scrubTargets.Count) changed file(s)."
    }
}

if ($env:GITHUB_OUTPUT) {
    Add-Content -Path $env:GITHUB_OUTPUT -Value "changed_files=$changedCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "code_files=$codeFileCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "domains=$domainCount"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "requires_plan=$($requiresPlan.ToString().ToLowerInvariant())"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "plan_files=$($planFiles.Count)"
    Add-Content -Path $env:GITHUB_OUTPUT -Value "failure_count=$($failures.Count)"
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure"
    }

    if (-not $ReportOnly) {
        exit 1
    }
}

if ($requiresPlan -and $planFiles.Count -gt 0 -and $failures.Count -eq 0) {
    Write-Host "[PASS] Harness compliance checks passed for complex work."
} elseif (-not $requiresPlan) {
    Write-Host '[PASS] Harness plan gate not required for this change set.'
} elseif ($ReportOnly) {
    Write-Host '[WARN] Harness compliance issues reported in advisory mode.'
}