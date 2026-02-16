#!/bin/bash
# AgentX Pre-Handoff Validation Script
# Validates that agent has completed required artifacts before handoff
# Usage: ./validate-handoff.sh <issue_number> <role>

set -e

ISSUE=$1
ROLE=$2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
check_file_exists() {
 local file=$1
 local description=$2

 if [ -f "$file" ]; then
 echo -e "${GREEN}[PASS]${NC} $description exists: $file"
 return 0
 else
 echo -e "${RED}[FAIL]${NC} $description missing: $file"
 return 1
 fi
}

check_dir_has_files() {
 local pattern=$1
 local description=$2

 if find . -path "$pattern" | grep -q .; then
 echo -e "${GREEN}[PASS]${NC} $description found"
 return 0
 else
 echo -e "${RED}[FAIL]${NC} $description not found"
 return 1
 fi
}

check_git_commit() {
 local issue_ref=$1

 if git log --oneline | grep -q "#${issue_ref}"; then
 echo -e "${GREEN}[PASS]${NC} Code committed with issue reference #${issue_ref}"
 return 0
 else
 echo -e "${RED}[FAIL]${NC} No commits found with issue reference #${issue_ref}"
 return 1
 fi
}

check_github_issues() {
 local parent_issue=$1

 # Check if gh CLI is available
 if ! command -v gh &> /dev/null; then
 echo -e "${YELLOW}[WARN]${NC} GitHub CLI not available, skipping issue check"
 return 0
 fi

 if gh issue list --search "parent:#${parent_issue}" --limit 1 --json number | grep -q "number"; then
 echo -e "${GREEN}[PASS]${NC} Child issues created for Epic #${parent_issue}"
 return 0
 else
 echo -e "${RED}[FAIL]${NC} No child issues found for Epic #${parent_issue}"
 return 1
 fi
}

# Main validation logic
echo "========================================="
echo " AgentX Pre-Handoff Validation"
echo "========================================="
echo "Issue: #${ISSUE}"
echo "Role: ${ROLE}"
echo "========================================="
echo ""

VALIDATION_PASSED=true

case $ROLE in
 pm)
 echo "Validating Product Manager deliverables..."
 echo ""

 # Check PRD exists
 if ! check_file_exists "docs/prd/PRD-${ISSUE}.md" "PRD document"; then
 VALIDATION_PASSED=false
 fi

 # Check Feature/Story issues created
 echo ""
 if ! check_github_issues "${ISSUE}"; then
 VALIDATION_PASSED=false
 fi

 # Check PRD has required sections (basic validation)
 if [ -f "docs/prd/PRD-${ISSUE}.md" ]; then
 required_sections=("Problem Statement" "Target Users" "Goals" "Requirements" "User Stories")
 missing_sections=()

 for section in "${required_sections[@]}"; do
 if ! grep -q "## .*${section}" "docs/prd/PRD-${ISSUE}.md"; then
 missing_sections+=("$section")
 fi
 done

 if [ ${#missing_sections[@]} -gt 0 ]; then
 echo -e "${RED}[FAIL]${NC} PRD missing required sections: ${missing_sections[*]}"
 VALIDATION_PASSED=false
 else
 echo -e "${GREEN}[PASS]${NC} PRD has all required sections"
 fi
 fi
 ;;

 ux)
 echo "Validating UX Designer deliverables..."
 echo ""

 # Check UX doc exists
 if ! check_file_exists "docs/ux/UX-${ISSUE}.md" "UX design document"; then
 VALIDATION_PASSED=false
 fi

 # Check for wireframes/user flows in UX doc
 if [ -f "docs/ux/UX-${ISSUE}.md" ]; then
 if grep -q "## .*Wireframe" "docs/ux/UX-${ISSUE}.md" && grep -q "## .*User Flow" "docs/ux/UX-${ISSUE}.md"; then
 echo -e "${GREEN}[PASS]${NC} UX doc includes wireframes and user flows"
 else
 echo -e "${RED}[FAIL]${NC} UX doc missing wireframes or user flows sections"
 VALIDATION_PASSED=false
 fi
 fi

 # Check prototype (optional, just warn)
 if [ -f "docs/ux/PROTOTYPE-${ISSUE}.md" ]; then
 echo -e "${GREEN}[PASS]${NC} Prototype document exists"
 else
 echo -e "${YELLOW}[WARN]${NC} Prototype document not found (optional)"
 fi
 ;;

 architect)
 echo "Validating Architect deliverables..."
 echo ""

 # Check ADR exists
 if ! check_file_exists "docs/adr/ADR-${ISSUE}.md" "ADR document"; then
 VALIDATION_PASSED=false
 fi

 # Check Tech Spec exists
 if ! check_dir_has_files "docs/specs/SPEC-*.md" "Tech Spec document(s)"; then
 VALIDATION_PASSED=false
 fi

 # Check ADR has required sections
 if [ -f "docs/adr/ADR-${ISSUE}.md" ]; then
 required_sections=("Context" "Decision" "Consequences")
 missing_sections=()

 for section in "${required_sections[@]}"; do
 if ! grep -q "## .*${section}" "docs/adr/ADR-${ISSUE}.md"; then
 missing_sections+=("$section")
 fi
 done

 if [ ${#missing_sections[@]} -gt 0 ]; then
 echo -e "${RED}[FAIL]${NC} ADR missing required sections: ${missing_sections[*]}"
 VALIDATION_PASSED=false
 else
 echo -e "${GREEN}[PASS]${NC} ADR has all required sections"
 fi
 fi

 # Check for "NO CODE EXAMPLES" compliance
 if find docs/specs -name "SPEC-*.md" -exec grep -l '\`\`\`' {} \; | grep -q .; then
 echo -e "${YELLOW}[WARN]${NC} Warning: Tech Spec contains code examples (should use diagrams instead)"
 else
 echo -e "${GREEN}[PASS]${NC} Tech Spec follows NO CODE EXAMPLES policy"
 fi

 # AI Intent Preservation check
 if command -v gh &> /dev/null; then
 LABELS=$(gh issue view ${ISSUE} --json labels --jq '.labels[].name' 2>/dev/null || true)
 if echo "$LABELS" | grep -q "needs:ai"; then
 if [ -f "docs/adr/ADR-${ISSUE}.md" ]; then
 if grep -q "AI/ML Architecture" "docs/adr/ADR-${ISSUE}.md"; then
 echo -e "${GREEN}[PASS]${NC} ADR includes AI/ML Architecture section (needs:ai label)"
 else
 echo -e "${RED}[FAIL]${NC} ADR missing AI/ML Architecture section (issue has needs:ai label)"
 VALIDATION_PASSED=false
 fi
 fi
 # Check SPEC has AI section
 for spec in docs/specs/SPEC-*.md; do
 if [ -f "$spec" ]; then
 if grep -q "AI/ML Specification" "$spec"; then
 echo -e "${GREEN}[PASS]${NC} Tech Spec includes AI/ML Specification section"
 else
 echo -e "${RED}[FAIL]${NC} Tech Spec missing AI/ML Specification section (issue has needs:ai label)"
 VALIDATION_PASSED=false
 fi
 fi
 done
 fi
 fi
 ;;

 engineer)
 echo "Validating Engineer deliverables..."
 echo ""

 # Check code committed
 if ! check_git_commit "${ISSUE}"; then
 VALIDATION_PASSED=false
 fi

 # Check tests exist
 if ! check_dir_has_files "**/*Test*.cs" "Unit tests (.NET)" && \
 ! check_dir_has_files "**/*test*.py" "Unit tests (Python)" && \
 ! check_dir_has_files "**/*.test.ts" "Unit tests (TypeScript)"; then
 echo -e "${RED}[FAIL]${NC} No test files found"
 VALIDATION_PASSED=false
 fi

 # Check for test coverage (if coverage tool available)
 echo ""
 echo -e "${YELLOW}[WARN]${NC} Test coverage check requires manual verification (80%)"
 echo " Run: dotnet test /p:CollectCoverage=true"
 echo " Or: pytest --cov=src --cov-report=term"

 # Check for documentation
 if git diff --name-only HEAD~1 | grep -q "README.md"; then
 echo -e "${GREEN}[PASS]${NC} README updated"
 else
 echo -e "${YELLOW}[WARN]${NC} README not updated (check if needed)"
 fi
 ;;

 reviewer)
 echo "Validating Reviewer deliverables..."
 echo ""

 # Check review doc exists
 if ! check_file_exists "docs/reviews/REVIEW-${ISSUE}.md" "Code review document"; then
 VALIDATION_PASSED=false
 fi

 # Check review has required sections
 if [ -f "docs/reviews/REVIEW-${ISSUE}.md" ]; then
 required_sections=("Executive Summary" "Code Quality" "Testing" "Security" "Decision")
 missing_sections=()

 for section in "${required_sections[@]}"; do
 if ! grep -q "## .*${section}" "docs/reviews/REVIEW-${ISSUE}.md"; then
 missing_sections+=("$section")
 fi
 done

 if [ ${#missing_sections[@]} -gt 0 ]; then
 echo -e "${RED}[FAIL]${NC} Review missing required sections: ${missing_sections[*]}"
 VALIDATION_PASSED=false
 else
 echo -e "${GREEN}[PASS]${NC} Review has all required sections"
 fi

 # Check for approval decision
 if grep -q "APPROVED" "docs/reviews/REVIEW-${ISSUE}.md"; then
 echo -e "${GREEN}[PASS]${NC} Review decision: APPROVED"
 elif grep -q "CHANGES REQUESTED" "docs/reviews/REVIEW-${ISSUE}.md"; then
 echo -e "${YELLOW}[WARN]${NC} Review decision: CHANGES REQUESTED"
 else
 echo -e "${RED}[FAIL]${NC} Review decision not found (must be APPROVED or CHANGES REQUESTED)"
 VALIDATION_PASSED=false
 fi
 fi
 ;;

 devops)
 echo "Validating DevOps Engineer deliverables..."
 echo ""

 # Check for workflow files
 if ! check_dir_has_files ".github/workflows/*.yml" "GitHub Actions workflows"; then
 echo -e "${YELLOW}[WARN]${NC} No new workflow files found (may be updating existing)"
 fi

 # Check for deployment documentation
 if ! check_file_exists "docs/deployment/DEPLOY-${ISSUE}.md" "Deployment documentation"; then
 # Check for alternative naming
 if ! check_dir_has_files "docs/deployment/*.md" "Deployment documentation (any)"; then
 echo -e "${YELLOW}[WARN]${NC} No deployment docs found (optional for minor changes)"
 fi
 fi

 # Check code committed with issue reference
 if ! check_git_commit "${ISSUE}"; then
 VALIDATION_PASSED=false
 fi

 # Check for secrets in workflow files (security)
 if find .github/workflows -name "*.yml" -exec grep -l 'password\|secret\|api_key' {} \; 2>/dev/null | grep -q .; then
 echo -e "${RED}[FAIL]${NC} Warning: Potential secrets found in workflow files"
 echo " Ensure all secrets use GitHub Secrets (\${{ secrets.NAME }})"
 VALIDATION_PASSED=false
 else
 echo -e "${GREEN}[PASS]${NC} No hardcoded secrets detected in workflows"
 fi

 # Check for proper secret references
 if find .github/workflows -name "*.yml" -exec grep -l '\${{ secrets\.' {} \; 2>/dev/null | grep -q .; then
 echo -e "${GREEN}[PASS]${NC} Workflows use GitHub Secrets properly"
 fi
 ;;

 *)
 echo -e "${RED}[FAIL]${NC} Unknown role: ${ROLE}"
 echo "Valid roles: pm, ux, architect, engineer, reviewer, devops"
 exit 1
 ;;
esac

echo ""
echo "========================================="

if [ "$VALIDATION_PASSED" = true ]; then
 echo -e "${GREEN}[PASS] Validation PASSED${NC}"
 echo "Agent can proceed with handoff."
 echo "========================================="
 exit 0
else
 echo -e "${RED}[FAIL] Validation FAILED${NC}"
 echo "Fix the issues above before handoff."
 echo "========================================="
 exit 1
fi
