# Commit-msg hook: Issue-First Workflow Validation (PowerShell version)
# Single source of truth for all workflow enforcement
# Usage: pwsh -File .github/hooks/commit-msg.ps1 <commit-msg-file>

param(
 [Parameter(Mandatory=$true, Position=0)]
 [string]$CommitMsgFile
)

$CommitMsg = Get-Content $CommitMsgFile -Raw

Write-Host ""
Write-Host "-------------------------------------------------------" -ForegroundColor Blue
Write-Host "AgentX Workflow Validation" -ForegroundColor Blue
Write-Host "-------------------------------------------------------" -ForegroundColor Blue
Write-Host ""

# Skip for merge commits, reverts, and initial commits
if ($CommitMsg -match '^(Merge|Revert|Initial commit)') {
 Write-Host "[PASS] Merge/Revert commit - skipping validation" -ForegroundColor Green
 exit 0
}

# Skip if [skip-issue] in commit message (emergency only)
if ($CommitMsg -match '\[skip-issue\]') {
 Write-Host "[WARN] WARNING: Skipping issue validation (emergency mode)" -ForegroundColor Yellow
 exit 0
}

# ===================================================================
# STEP 1: Check for issue reference
# ===================================================================
Write-Host -NoNewline "Checking for issue reference... "
if ($CommitMsg -notmatch '#\d+|((closes|fixes|resolves|refs?)\s+#\d+)') {
 Write-Host "[FAIL] FAILED" -ForegroundColor Red
 Write-Host ""
 Write-Host "Your commit message must reference a GitHub Issue."
 Write-Host ""
 Write-Host " Format: type: description (#123)" -ForegroundColor Green
 Write-Host " Example: feat: add user login (#42)" -ForegroundColor Green
 Write-Host ""
 Write-Host "To create an issue: gh issue create --web"
 Write-Host ""
 Write-Host "Emergency bypass: Add [skip-issue] to commit message"
 Write-Host ""
 exit 1
}

$IssueNumber = ([regex]::Match($CommitMsg, '#(\d+)')).Groups[1].Value
Write-Host "[PASS] Found #${IssueNumber}" -ForegroundColor Green

# ===================================================================
# STEP 2: Validate commit message format (warning only)
# ===================================================================
if ($CommitMsg -notmatch '^(feat|fix|docs|test|refactor|perf|chore|style|build|ci):') {
 Write-Host "[WARN] Commit format should be: type: description (#issue)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[PASS] Workflow validation passed" -ForegroundColor Green
exit 0
