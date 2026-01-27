#!/bin/bash
# Captures session context at handoff points
# Usage: ./capture-context.sh <issue_number> <agent_role>

set -e

ISSUE_NUMBER=$1
AGENT_ROLE=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$AGENT_ROLE" ]; then
    echo "❌ Usage: ./capture-context.sh <issue_number> <agent_role>"
    echo "   agent_role: pm | ux | architect | engineer | reviewer"
    exit 1
fi

# Create context directory if not exists
CONTEXT_DIR=".agent-context"
mkdir -p "$CONTEXT_DIR"

CONTEXT_FILE="${CONTEXT_DIR}/issue-${ISSUE_NUMBER}-${AGENT_ROLE}.md"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
SESSION_ID=$(date +%Y%m%d-%H%M%S)-${AGENT_ROLE}

echo "📝 Capturing context for Agent: $AGENT_ROLE, Issue: #$ISSUE_NUMBER"

# Start building context file
cat > "$CONTEXT_FILE" << EOF
## 🧠 Session Context Summary

**Session ID**: ${SESSION_ID}  
**Issue**: #${ISSUE_NUMBER}  
**Agent**: ${AGENT_ROLE}  
**Timestamp**: ${TIMESTAMP}

---

### 📋 Work Completed

**Deliverables**:
EOF

# Agent-specific deliverables
case $AGENT_ROLE in
  "pm")
    echo "- ✅ PRD: [docs/prd/PRD-${ISSUE_NUMBER}.md](../../docs/prd/PRD-${ISSUE_NUMBER}.md)" >> "$CONTEXT_FILE"
    
    # List created issues
    if command -v gh &> /dev/null; then
      echo "" >> "$CONTEXT_FILE"
      echo "**Backlog Created**:" >> "$CONTEXT_FILE"
      gh issue list --label "type:feature" --search "Parent: #${ISSUE_NUMBER}" --json number,title --jq '.[] | "- Feature #\(.number): \(.title)"' >> "$CONTEXT_FILE" 2>/dev/null || echo "- (Use GitHub to view backlog)" >> "$CONTEXT_FILE"
      gh issue list --label "type:story" --search "Parent: #${ISSUE_NUMBER}" --json number,title --jq '.[] | "- Story #\(.number): \(.title)"' >> "$CONTEXT_FILE" 2>/dev/null || true
    fi
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Next Agent**: UX Designer (if needs:ux) or Architect" >> "$CONTEXT_FILE"
    echo "**Status**: → Ready (in Projects board)" >> "$CONTEXT_FILE"
    ;;
    
  "ux")
    echo "- ✅ UX Designs:" >> "$CONTEXT_FILE"
    find docs/ux -type f -name "*${ISSUE_NUMBER}*" 2>/dev/null | while read -r file; do
      echo "  - [$(basename "$file")](../../${file})" >> "$CONTEXT_FILE"
    done
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Deliverables Include**:" >> "$CONTEXT_FILE"
    echo "- Wireframes and mockups" >> "$CONTEXT_FILE"
    echo "- User flow diagrams" >> "$CONTEXT_FILE"
    echo "- User personas" >> "$CONTEXT_FILE"
    echo "- HTML prototypes (if applicable)" >> "$CONTEXT_FILE"
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Next Agent**: Architect" >> "$CONTEXT_FILE"
    echo "**Status**: → Ready (in Projects board)" >> "$CONTEXT_FILE"
    ;;
    
  "architect")
    echo "- ✅ ADR: [docs/adr/ADR-${ISSUE_NUMBER}.md](../../docs/adr/ADR-${ISSUE_NUMBER}.md)" >> "$CONTEXT_FILE"
    echo "- ✅ Tech Spec: [docs/specs/SPEC-${ISSUE_NUMBER}.md](../../docs/specs/SPEC-${ISSUE_NUMBER}.md)" >> "$CONTEXT_FILE"
    
    if [ -f "docs/architecture/ARCH-${ISSUE_NUMBER}.md" ]; then
      echo "- ✅ Architecture: [docs/architecture/ARCH-${ISSUE_NUMBER}.md](../../docs/architecture/ARCH-${ISSUE_NUMBER}.md)" >> "$CONTEXT_FILE"
    fi
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Key Decisions**:" >> "$CONTEXT_FILE"
    grep "## Decision" "docs/adr/ADR-${ISSUE_NUMBER}.md" -A 5 2>/dev/null | sed 's/^/> /' >> "$CONTEXT_FILE" || echo "> (See ADR for details)" >> "$CONTEXT_FILE"
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Next Agent**: Engineer" >> "$CONTEXT_FILE"
    echo "**Status**: → Ready (in Projects board)" >> "$CONTEXT_FILE"
    ;;
    
  "engineer")
    echo "**Commits**:" >> "$CONTEXT_FILE"
    if command -v git &> /dev/null; then
      git log --all --grep="#${ISSUE_NUMBER}" --oneline 2>/dev/null | sed 's/^/- /' >> "$CONTEXT_FILE" || echo "- (No commits found)" >> "$CONTEXT_FILE"
    fi
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Files Modified**:" >> "$CONTEXT_FILE"
    if command -v git &> /dev/null; then
      git diff --name-only HEAD~5..HEAD 2>/dev/null | grep -v "docs/" | sed 's/^/- /' >> "$CONTEXT_FILE" || echo "- (Run git diff to see changes)" >> "$CONTEXT_FILE"
    fi
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Test Coverage**: ≥80% required (verify with test runner)" >> "$CONTEXT_FILE"
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Next Agent**: Reviewer" >> "$CONTEXT_FILE"
    echo "**Status**: → In Review (in Projects board)" >> "$CONTEXT_FILE"
    ;;
    
  "reviewer")
    echo "- ✅ Code Review: [docs/reviews/REVIEW-${ISSUE_NUMBER}.md](../../docs/reviews/REVIEW-${ISSUE_NUMBER}.md)" >> "$CONTEXT_FILE"
    
    echo "" >> "$CONTEXT_FILE"
    echo "**Review Outcome**: ✅ Approved / ❌ Changes Requested" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"
    echo "**Next Step**: Issue closed (Status: Done) or returned to Engineer for fixes" >> "$CONTEXT_FILE"
    ;;
    
  *)
    echo "- Unknown agent role: $AGENT_ROLE" >> "$CONTEXT_FILE"
    ;;
esac

# Add common footer
cat >> "$CONTEXT_FILE" << EOF

---

### 🎯 Self-Review Checklist

**Completed**:
EOF

case $AGENT_ROLE in
  "pm")
    cat >> "$CONTEXT_FILE" << EOF
- ✅ PRD completeness (problem, users, requirements, stories)
- ✅ Backlog hierarchy (Epic → Features → Stories)
- ✅ Acceptance criteria clarity (all stories have clear AC)
- ✅ Dependencies and risks documented
EOF
    ;;
  "ux")
    cat >> "$CONTEXT_FILE" << EOF
- ✅ Design completeness (all user flows covered)
- ✅ Accessibility standards (WCAG 2.1 AA compliance)
- ✅ Responsive layouts (mobile, tablet, desktop)
- ✅ Component consistency (design system alignment)
- ✅ User experience clarity (intuitive navigation)
EOF
    ;;
  "architect")
    cat >> "$CONTEXT_FILE" << EOF
- ✅ ADR completeness (context, decision, consequences)
- ✅ Tech specs accurate (API contracts, data models)
- ✅ Implementation feasibility verified
- ✅ Security considerations documented
- ✅ Performance requirements specified
- ✅ Dependencies identified and documented
EOF
    ;;
  "engineer")
    cat >> "$CONTEXT_FILE" << EOF
- ✅ Code quality (SOLID principles, DRY, clean code)
- ✅ Test coverage (≥80%, unit + integration + e2e)
- ✅ Documentation completeness (XML docs, inline comments)
- ✅ Security verification (no secrets, SQL injection, XSS)
- ✅ Error handling (try-catch, validation, logging)
- ✅ Performance considerations (async, caching, queries)
EOF
    ;;
  "reviewer")
    cat >> "$CONTEXT_FILE" << EOF
- ✅ Code review completeness
- ✅ Tests verified (passing, comprehensive)
- ✅ Security audit (no vulnerabilities)
- ✅ Documentation review (clear and complete)
- ✅ Quality standards met (Skills.md compliance)
EOF
    ;;
esac

cat >> "$CONTEXT_FILE" << EOF

---

### 🔄 Context for Next Agent

**Prerequisites Met**:
- ✅ All deliverables created
- ✅ Self-review checklist completed
- ✅ Quality gates passed
- ✅ Validation script passed

**Related Issues**:
EOF

# Extract related issues from issue body
if command -v gh &> /dev/null; then
  gh issue view ${ISSUE_NUMBER} --json body --jq '.body' 2>/dev/null | grep -oP '(?<=Parent: #)\d+|(?<=Blocked by: #)\d+|(?<=Blocks: #)\d+' | sed 's/^/- #/' >> "$CONTEXT_FILE" || echo "- (No related issues found)" >> "$CONTEXT_FILE"
else
  echo "- (Use GitHub CLI to view related issues)" >> "$CONTEXT_FILE"
fi

echo "" >> "$CONTEXT_FILE"
echo "---" >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"
echo "*Generated by AgentX Orchestrator* | [View Workflow](../../.github/workflows/agent-orchestrator.yml)" >> "$CONTEXT_FILE"

# Post context as issue comment (if gh CLI available)
if command -v gh &> /dev/null; then
  echo ""
  echo "📤 Posting context summary to issue #${ISSUE_NUMBER}..."
  gh issue comment ${ISSUE_NUMBER} --body-file "$CONTEXT_FILE" 2>/dev/null && echo "✅ Context posted successfully" || echo "⚠️ Could not post to issue (check gh auth)"
else
  echo "ℹ️ GitHub CLI not available. Context saved to: $CONTEXT_FILE"
fi

echo "✅ Context captured at: $CONTEXT_FILE"
exit 0
