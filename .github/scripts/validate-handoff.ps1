# AgentX Pre-Handoff Validation Script (PowerShell version)
# Validates that agent has completed required artifacts before handoff
# Usage: pwsh -File validate-handoff.ps1 <issue_number> <role>

param(
 [Parameter(Mandatory=$true, Position=0)]
 [string]$Issue,

 [Parameter(Mandatory=$true, Position=1)]
 [ValidateSet("pm", "ux", "architect", "engineer", "reviewer", "devops")]
 [string]$Role
)

$ErrorActionPreference = "Continue"

# Validation helpers
function Test-FileAndReport {
 param([string]$FilePath, [string]$Description)
 if (Test-Path $FilePath) {
 Write-Host "[PASS] $Description exists: $FilePath" -ForegroundColor Green
 return $true
 } else {
 Write-Host "[FAIL] $Description missing: $FilePath" -ForegroundColor Red
 return $false
 }
}

function Test-GlobAndReport {
 param([string]$Pattern, [string]$Description)
 $found = Get-ChildItem -Path $Pattern -ErrorAction SilentlyContinue
 if ($found) {
 Write-Host "[PASS] $Description found" -ForegroundColor Green
 return $true
 } else {
 Write-Host "[FAIL] $Description not found" -ForegroundColor Red
 return $false
 }
}

function Test-GitCommit {
 param([string]$IssueRef)
 try {
 $log = git log --oneline 2>$null
 if ($log -match "#$IssueRef") {
 Write-Host "[PASS] Code committed with issue reference #$IssueRef" -ForegroundColor Green
 return $true
 } else {
 Write-Host "[FAIL] No commits found with issue reference #$IssueRef" -ForegroundColor Red
 return $false
 }
 } catch {
 Write-Host "[WARN] Git not available, skipping commit check" -ForegroundColor Yellow
 return $true
 }
}

function Test-GitHubIssues {
 param([string]$ParentIssue)
 if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
 Write-Host "[WARN] GitHub CLI not available, skipping issue check" -ForegroundColor Yellow
 return $true
 }
 try {
 $result = gh issue list --search "parent:#$ParentIssue" --limit 1 --json number 2>$null
 if ($result -match "number") {
 Write-Host "[PASS] Child issues created for Epic #$ParentIssue" -ForegroundColor Green
 return $true
 } else {
 Write-Host "[FAIL] No child issues found for Epic #$ParentIssue" -ForegroundColor Red
 return $false
 }
 } catch {
 Write-Host "[WARN] Could not check child issues" -ForegroundColor Yellow
 return $true
 }
}

function Test-RequiredSections {
 param([string]$FilePath, [string[]]$Sections)
 $content = Get-Content $FilePath -Raw
 $missing = @()
 foreach ($section in $Sections) {
 if ($content -notmatch "## .*$section") {
 $missing += $section
 }
 }
 if ($missing.Count -gt 0) {
 Write-Host "[FAIL] Missing required sections: $($missing -join ', ')" -ForegroundColor Red
 return $false
 } else {
 Write-Host "[PASS] All required sections present" -ForegroundColor Green
 return $true
 }
}

# Header
Write-Host ""
Write-Host "=========================================" 
Write-Host " AgentX Pre-Handoff Validation"
Write-Host "========================================="
Write-Host "Issue: #$Issue"
Write-Host "Role: $Role"
Write-Host "========================================="
Write-Host ""

$ValidationPassed = $true

switch ($Role) {
 "pm" {
 Write-Host "Validating Product Manager deliverables..."
 Write-Host ""

 # Check PRD exists
 if (-not (Test-FileAndReport "docs/prd/PRD-$Issue.md" "PRD document")) {
 $ValidationPassed = $false
 }

 # Check child issues
 Write-Host ""
 if (-not (Test-GitHubIssues $Issue)) {
 $ValidationPassed = $false
 }

 # Check PRD required sections
 if (Test-Path "docs/prd/PRD-$Issue.md") {
 $sections = @("Problem Statement", "Target Users", "Goals", "Requirements", "User Stories")
 if (-not (Test-RequiredSections "docs/prd/PRD-$Issue.md" $sections)) {
 $ValidationPassed = $false
 }
 }
 }

 "ux" {
 Write-Host "Validating UX Designer deliverables..."
 Write-Host ""

 # Check UX doc
 if (-not (Test-FileAndReport "docs/ux/UX-$Issue.md" "UX design document")) {
 $ValidationPassed = $false
 }

 # Check wireframes and user flows
 if (Test-Path "docs/ux/UX-$Issue.md") {
 $content = Get-Content "docs/ux/UX-$Issue.md" -Raw
 if ($content -match "## .*Wireframe" -and $content -match "## .*User Flow") {
 Write-Host "[PASS] UX doc includes wireframes and user flows" -ForegroundColor Green
 } else {
 Write-Host "[FAIL] UX doc missing wireframes or user flows sections" -ForegroundColor Red
 $ValidationPassed = $false
 }
 }

 # Prototype (optional)
 if (Test-Path "docs/ux/PROTOTYPE-$Issue.md") {
 Write-Host "[PASS] Prototype document exists" -ForegroundColor Green
 } else {
 Write-Host "[WARN] Prototype document not found (optional)" -ForegroundColor Yellow
 }
 }

 "architect" {
 Write-Host "Validating Architect deliverables..."
 Write-Host ""

 # Check ADR
 if (-not (Test-FileAndReport "docs/adr/ADR-$Issue.md" "ADR document")) {
 $ValidationPassed = $false
 }

 # Check Tech Spec
 if (-not (Test-GlobAndReport "docs/specs/SPEC-*.md" "Tech Spec document(s)")) {
 $ValidationPassed = $false
 }

 # ADR required sections
 if (Test-Path "docs/adr/ADR-$Issue.md") {
 $sections = @("Context", "Decision", "Consequences")
 if (-not (Test-RequiredSections "docs/adr/ADR-$Issue.md" $sections)) {
 $ValidationPassed = $false
 }
 }

 # NO CODE EXAMPLES compliance
 $specFiles = Get-ChildItem "docs/specs/SPEC-*.md" -ErrorAction SilentlyContinue
 $hasCode = $false
 foreach ($f in $specFiles) {
 if ((Get-Content $f.FullName -Raw) -match '```') {
 $hasCode = $true
 }
 }
 if ($hasCode) {
 Write-Host "[WARN] Warning: Tech Spec contains code examples (should use diagrams instead)" -ForegroundColor Yellow
 } else {
 Write-Host "[PASS] Tech Spec follows NO CODE EXAMPLES policy" -ForegroundColor Green
 }

 # AI Intent Preservation check
 $ghAvailable = Get-Command gh -ErrorAction SilentlyContinue
 if ($ghAvailable) {
 $labels = gh issue view $Issue --json labels --jq ".labels[].name" 2>$null
 if ($labels -and ($labels -contains "needs:ai")) {
 if (Test-Path "docs/adr/ADR-$Issue.md") {
 $adrContent = Get-Content "docs/adr/ADR-$Issue.md" -Raw
 if ($adrContent -match "AI/ML Architecture") {
 Write-Host "[PASS] ADR includes AI/ML Architecture section (needs:ai label)" -ForegroundColor Green
 } else {
 Write-Host "[FAIL] ADR missing AI/ML Architecture section (issue has needs:ai label)" -ForegroundColor Red
 $ValidationPassed = $false
 }
 }
 # Check SPEC has AI section too
 $specFiles = Get-ChildItem "docs/specs/SPEC-*.md" -ErrorAction SilentlyContinue
 foreach ($f in $specFiles) {
 $specContent = Get-Content $f.FullName -Raw
 if ($specContent -match "AI/ML Specification") {
 Write-Host "[PASS] Tech Spec includes AI/ML Specification section" -ForegroundColor Green
 } else {
 Write-Host "[FAIL] Tech Spec missing AI/ML Specification section (issue has needs:ai label)" -ForegroundColor Red
 $ValidationPassed = $false
 }
 }
 }
 }
 }

 "engineer" {
 Write-Host "Validating Engineer deliverables..."
 Write-Host ""

 # Check code committed
 if (-not (Test-GitCommit $Issue)) {
 $ValidationPassed = $false
 }

 # Check tests exist
 $testsFound = $false
 if (Get-ChildItem -Recurse -Filter "*Test*.cs" -ErrorAction SilentlyContinue) {
 Write-Host "[PASS] Unit tests (.NET) found" -ForegroundColor Green
 $testsFound = $true
 }
 if (Get-ChildItem -Recurse -Filter "*test*.py" -ErrorAction SilentlyContinue) {
 Write-Host "[PASS] Unit tests (Python) found" -ForegroundColor Green
 $testsFound = $true
 }
 if (Get-ChildItem -Recurse -Filter "*.test.ts" -ErrorAction SilentlyContinue) {
 Write-Host "[PASS] Unit tests (TypeScript) found" -ForegroundColor Green
 $testsFound = $true
 }
 if (-not $testsFound) {
 Write-Host "[FAIL] No test files found" -ForegroundColor Red
 $ValidationPassed = $false
 }

 # Coverage reminder
 Write-Host ""
 Write-Host "[WARN] Test coverage check requires manual verification (80%)" -ForegroundColor Yellow
 Write-Host " Run: dotnet test /p:CollectCoverage=true"
 Write-Host " Or: pytest --cov=src --cov-report=term"

 # README update check
 try {
 $diff = git diff --name-only HEAD~1 2>$null
 if ($diff -match "README.md") {
 Write-Host "[PASS] README updated" -ForegroundColor Green
 } else {
 Write-Host "[WARN] README not updated (check if needed)" -ForegroundColor Yellow
 }
 } catch {
 Write-Host "[WARN] Could not check README changes" -ForegroundColor Yellow
 }
 }

 "reviewer" {
 Write-Host "Validating Reviewer deliverables..."
 Write-Host ""

 # Check review doc
 if (-not (Test-FileAndReport "docs/reviews/REVIEW-$Issue.md" "Code review document")) {
 $ValidationPassed = $false
 }

 # Review required sections
 if (Test-Path "docs/reviews/REVIEW-$Issue.md") {
 $sections = @("Executive Summary", "Code Quality", "Testing", "Security", "Decision")
 if (-not (Test-RequiredSections "docs/reviews/REVIEW-$Issue.md" $sections)) {
 $ValidationPassed = $false
 }

 # Approval decision
 $content = Get-Content "docs/reviews/REVIEW-$Issue.md" -Raw
 if ($content -match "APPROVED") {
 Write-Host "[PASS] Review decision: APPROVED" -ForegroundColor Green
 } elseif ($content -match "CHANGES REQUESTED") {
 Write-Host "[WARN] Review decision: CHANGES REQUESTED" -ForegroundColor Yellow
 } else {
 Write-Host "[FAIL] Review decision not found (must be APPROVED or CHANGES REQUESTED)" -ForegroundColor Red
 $ValidationPassed = $false
 }
 }
 }

 "devops" {
 Write-Host "Validating DevOps Engineer deliverables..."
 Write-Host ""

 # Workflow files
 if (-not (Test-GlobAndReport ".github/workflows/*.yml" "GitHub Actions workflows")) {
 Write-Host "[WARN] No new workflow files found (may be updating existing)" -ForegroundColor Yellow
 }

 # Deployment docs
 if (-not (Test-FileAndReport "docs/deployment/DEPLOY-$Issue.md" "Deployment documentation")) {
 if (-not (Test-GlobAndReport "docs/deployment/*.md" "Deployment documentation (any)")) {
 Write-Host "[WARN] No deployment docs found (optional for minor changes)" -ForegroundColor Yellow
 }
 }

 # Code committed
 if (-not (Test-GitCommit $Issue)) {
 $ValidationPassed = $false
 }

 # Secrets check in workflows
 $workflowFiles = Get-ChildItem ".github/workflows/*.yml" -ErrorAction SilentlyContinue
 $secretsInPlaintext = $false
 foreach ($f in $workflowFiles) {
 $content = Get-Content $f.FullName -Raw
 if ($content -match '(?i)(password|secret|api_key)\s*[:=]' -and $content -notmatch '\$\{\{ secrets\.') {
 $secretsInPlaintext = $true
 }
 }
 if ($secretsInPlaintext) {
 Write-Host "[FAIL] Warning: Potential secrets found in workflow files" -ForegroundColor Red
 Write-Host " Ensure all secrets use GitHub Secrets (`${{ secrets.NAME }})"
 $ValidationPassed = $false
 } else {
 Write-Host "[PASS] No hardcoded secrets detected in workflows" -ForegroundColor Green
 }

 # Proper secret usage
 foreach ($f in $workflowFiles) {
 if ((Get-Content $f.FullName -Raw) -match '\$\{\{ secrets\.') {
 Write-Host "[PASS] Workflows use GitHub Secrets properly" -ForegroundColor Green
 break
 }
 }
 }
}

# Result
Write-Host ""
Write-Host "========================================="

if ($ValidationPassed) {
 Write-Host "[PASS] Validation PASSED" -ForegroundColor Green
 Write-Host "Agent can proceed with handoff."
 Write-Host "========================================="
 exit 0
} else {
 Write-Host "[FAIL] Validation FAILED" -ForegroundColor Red
 Write-Host "Fix the issues above before handoff."
 Write-Host "========================================="
 exit 1
}
