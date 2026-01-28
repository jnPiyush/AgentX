# Review: Hooks, Workflows, and Prompts

**Date**: January 28, 2026  
**Reviewer**: Agent Analysis  
**Purpose**: Validate alignment with Phase 2 implementation

---

## Executive Summary

### Overall Assessment

| Category | Files | Status | Alignment | Action Required |
|----------|-------|--------|-----------|-----------------|
| **Hooks** | 3 files | ⚠️ **OUTDATED** | Partial (40%) | Update to pre-handoff validation |
| **Workflows** | 3 files | ⚠️ **PARTIALLY OUTDATED** | 70% | Update Agent X routing, deprecate quality-gates |
| **Prompts** | 3 files | ✅ **GOOD** | 90% | Minor skill path updates only |

**Critical Findings**:
1. 🚨 **Hooks enforce pre-commit validation**, but Phase 2 uses **pre-handoff validation**
2. ⚠️ **Agent X workflow uses label-based routing**, but Phase 2 uses **Status-based routing**
3. ✅ **Prompts are well-structured** and reference skills correctly

---

## 1. Hooks Analysis

### 1.1 File: `.github/hooks/pre-commit` (Bash)

**Current Behavior**: Runs security and quality checks on every commit

**Issues**:
1. **❌ MISALIGNED**: Enforces pre-commit checks, but Phase 2 uses **pre-handoff validation**
2. **❌ WRONG VALIDATION**: Checks for PRD/ADR/Spec at commit time, not at handoff time
3. **✅ GOOD**: Security checks (secrets, SQL injection) are still valid

**Recommended Changes**:

**Option 1: Remove Workflow Validation (Recommended)**
- Keep security checks only (secrets, large files, SQL injection)
- Remove document checks (lines 100-164 in commit-msg)
- Document checks handled by `.github/scripts/validate-handoff.sh`

**Option 2: Keep as Legacy (Not Recommended)**
- Add warning: "⚠️ This hook uses legacy pre-commit validation. Consider using pre-handoff validation instead."

**Verdict**: ⚠️ **UPDATE REQUIRED** - Remove workflow validation, keep security only

---

### 1.2 File: `.github/hooks/pre-commit.ps1` (PowerShell)

**Current Behavior**: PowerShell version of pre-commit hook

**Issues**: Same as bash version

**Recommended Changes**: Same as bash version

**Verdict**: ⚠️ **UPDATE REQUIRED** - Align with bash version

---

### 1.3 File: `.github/hooks/commit-msg` (Bash)

**Current Behavior**: 
- Validates issue reference in commit message
- Checks for PRD/ADR/Spec documents based on issue type
- Enforces workflow prerequisites

**Issues**:
1. **❌ MISALIGNED**: Checks documents at commit time (pre-commit paradigm)
2. **❌ WRONG TIMING**: Phase 2 validates at handoff, not at commit
3. **✅ GOOD**: Issue reference check is still valid
4. **✅ GOOD**: Conventional commit format check is still valid

**Recommended Changes**:

**Keep**:
- Issue reference check (#123)
- Conventional commit format (feat:, fix:, etc.)
- Emergency bypass (`[skip-issue]` in commit message)

**Remove**:
- Lines 68-154: Document validation (PRD, ADR, Spec, UX checks)
- This is now handled by `.github/scripts/validate-handoff.sh`

**New Simplified Version**:
```bash
#!/usr/bin/env bash
# Commit-msg hook: Issue Reference Validation ONLY
# Workflow validation moved to pre-handoff (validate-handoff.sh)

COMMIT_MSG=$(cat "$1")

# Skip for merge/revert/initial commits
if echo "$COMMIT_MSG" | grep -qE '^(Merge|Revert|Initial commit)'; then
  exit 0
fi

# Skip if [skip-issue] in message (emergency)
if echo "$COMMIT_MSG" | grep -qE '\[skip-issue\]'; then
  echo "⚠️ WARNING: Skipping issue validation (emergency mode)"
  exit 0
fi

# Check for issue reference
if ! echo "$COMMIT_MSG" | grep -qE '#[0-9]+'; then
  echo "❌ Commit must reference a GitHub Issue (#123)"
  echo ""
  echo "Format: type: description (#123)"
  echo "Example: feat: add user login (#42)"
  echo ""
  echo "Create issue: gh issue create --web"
  exit 1
fi

# Check conventional commit format (warning only)
if ! echo "$COMMIT_MSG" | grep -qE '^(feat|fix|docs|test|refactor|perf|chore):'; then
  echo "⚠️ Commit format should be: type: description (#issue)"
fi

echo "✅ Issue reference found"
exit 0
```

**Verdict**: ⚠️ **UPDATE REQUIRED** - Simplify to issue reference check only

---

## 2. Workflows Analysis

### 2.1 File: `.github/workflows/agent-x.yml`

**Current Behavior**:
- Triggers on issue labeled/opened
- Routes based on type labels (type:epic → pm, type:feature → architect, etc.)
- Creates document scaffolds (PRD, ADR, etc.)

**Issues**:
1. **❌ OUTDATED ROUTING**: Uses label-based routing, Phase 2 uses **Status + Label routing**
2. **❌ MISSING VALIDATION**: No pre-handoff validation call
3. **❌ MISSING PREREQUISITES**: Doesn't check if PRD/UX exists before routing to next agent
4. **⚠️ SCAFFOLD ONLY**: Only creates scaffolds, doesn't actually run agents (manual work)

**Alignment with Phase 2**:
- ✅ Correct: Routes based on type labels
- ❌ Missing: Status-based routing (Backlog vs Ready)
- ❌ Missing: Prerequisite checking (hasUXDesign, hasArchitecture)
- ❌ Missing: Validation script integration

**Recommended Changes**:

**Option 1: Update to Match Phase 2 Architecture (Recommended)**

Add routing logic from [agent-x.agent.md](../../.github/agents/agent-x.agent.md):
```yaml
- name: Determine Agent
  run: |
    # Get issue status from Projects V2 (requires GraphQL)
    STATUS=$(gh project item-list ... | grep status)
    
    # Route based on type + status + prerequisites
    if [ "$TYPE" == "type:epic" ] && [ "$STATUS" == "Backlog" ]; then
      AGENT="pm"
    elif [ "$STATUS" == "Ready" ] && has_label "needs:ux"; then
      AGENT="ux"
    elif [ "$STATUS" == "Ready" ] && ! has_prd; then
      AGENT="architect"
    # ... (full routing logic from agent-x.agent.md)
    fi
```

**Option 2: Deprecate and Use Manual Agent Invocation (Alternative)**
- Add warning: "⚠️ This workflow creates scaffolds only. Agents work manually via Copilot."
- Keep for scaffold generation only
- Agents are invoked manually via GitHub Copilot (not automated)

**Verdict**: ⚠️ **UPDATE RECOMMENDED** - Add Status-based routing and validation

---

### 2.2 File: `.github/workflows/quality-gates.yml`

**Current Behavior**:
- Runs on PR open/sync
- Checks for secrets, commit messages, documentation, file structure
- Posts quality report comment on PR

**Issues**:
1. **❌ DUPLICATES PRE-COMMIT HOOK**: Secret scanning done in both places
2. **✅ GOOD**: PR-level checks are appropriate (broader than commit-level)
3. **⚠️ OVERLAPS WITH VALIDATION**: Document checks overlap with validate-handoff.sh

**Recommended Changes**:

**Option 1: Keep as CI/CD Quality Gate (Recommended)**
- Purpose: Automated CI/CD checks (different from pre-handoff)
- Keep: Secret scanning, commit message validation, file structure
- Add: Call `.github/scripts/validate-handoff.sh` for document validation
- Rename: `quality-gates.yml` → `ci-quality-checks.yml` (clarify purpose)

**Option 2: Merge with Pre-Handoff Validation (Not Recommended)**
- Would require CI/CD to know which agent is handing off (complex)

**Verdict**: ✅ **KEEP BUT ENHANCE** - Add validate-handoff.sh integration

---

### 2.3 File: `.github/workflows/dependency-scanning.yml`

**Current Behavior**:
- Scans .NET, Python, Node.js dependencies weekly
- Checks for vulnerabilities
- Posts summary on PRs

**Issues**:
- ✅ **NO ISSUES**: Fully aligned with Phase 2
- ✅ **GOOD**: Independent security scanning (not tied to workflow)

**Verdict**: ✅ **NO CHANGES NEEDED** - Working as designed

---

## 3. Prompts Analysis

### 3.1 File: `.github/prompts/code-review.prompt.md`

**Current Content**: Structured code review prompt with checklist

**Issues**:
1. ⚠️ **OUTDATED REFERENCE**: Points to `18-code-review-and-audit.md` (should be path to skill)
2. ✅ **GOOD**: Review checklist aligns with [REVIEW-TEMPLATE.md](../../.github/templates/REVIEW-TEMPLATE.md)

**Recommended Changes**:
- Update skill reference: `../../skills/18-code-review-and-audit.md` → `../../.github/skills/development/code-review-and-audit/SKILL.md`
- Add reference to REVIEW-TEMPLATE.md
- Add note: "Agents use REVIEW-TEMPLATE.md automatically"

**Verdict**: ⚠️ **MINOR UPDATE** - Fix skill path

---

### 3.2 File: `.github/prompts/test-gen.prompt.md`

**Current Content**: Test generation prompt with coverage targets

**Issues**:
1. ⚠️ **OUTDATED REFERENCE**: Points to `02-testing.md` (should be path to skill)
2. ✅ **GOOD**: Coverage targets (70/20/10 pyramid) match Phase 2

**Recommended Changes**:
- Update skill reference: `../../skills/02-testing.md` → `../../.github/skills/development/testing/SKILL.md`

**Verdict**: ⚠️ **MINOR UPDATE** - Fix skill path

---

### 3.3 File: `.github/prompts/refactor.prompt.md`

**Current Content**: Refactoring prompt with code smells

**Issues**:
1. ⚠️ **OUTDATED REFERENCE**: Points to `01-core-principles.md` (should be path to skill)
2. ✅ **GOOD**: Code smell thresholds are reasonable

**Recommended Changes**:
- Update skill reference: `../../skills/01-core-principles.md` → `../../.github/skills/architecture/core-principles/SKILL.md`

**Verdict**: ⚠️ **MINOR UPDATE** - Fix skill path

---

## 4. Priority Recommendations

### Immediate (Before Week 6 Release)

| Priority | File | Action | Effort | Impact |
|----------|------|--------|--------|--------|
| **P0** | `.github/hooks/commit-msg` | Simplify to issue reference only | 30 min | High |
| **P0** | `.github/hooks/pre-commit` | Remove workflow validation | 15 min | High |
| **P0** | `.github/hooks/pre-commit.ps1` | Sync with bash version | 15 min | High |

**Total P0 Effort**: 1 hour

### High Priority (Week 6)

| Priority | File | Action | Effort | Impact |
|----------|------|--------|--------|--------|
| **P1** | `.github/workflows/agent-x.yml` | Add Status-based routing + validation | 2 hours | Medium |
| **P1** | `.github/workflows/quality-gates.yml` | Integrate validate-handoff.sh | 1 hour | Medium |

**Total P1 Effort**: 3 hours

### Low Priority (Post-Release)

| Priority | File | Action | Effort | Impact |
|----------|------|--------|--------|--------|
| **P2** | `.github/prompts/*.prompt.md` | Fix skill paths (3 files) | 30 min | Low |

**Total P2 Effort**: 30 minutes

---

## 5. Detailed Change Plan

### Phase 1: Update Hooks (P0 - 1 hour)

**Files**: 
- `.github/hooks/commit-msg`
- `.github/hooks/pre-commit`
- `.github/hooks/pre-commit.ps1`

**Changes**:
1. Remove lines 68-154 from `commit-msg` (document validation)
2. Keep issue reference check (#123)
3. Keep conventional commit format check
4. Update hook comments to explain pre-handoff validation

**Validation**:
- Test commit with issue reference → PASS
- Test commit without issue reference → FAIL
- Validate documents are NOT checked at commit time

---

### Phase 2: Update Workflows (P1 - 3 hours)

#### 2.1 Update `agent-x.yml`

**Add**:
```yaml
- name: Get Issue Status from Projects V2
  run: |
    # Requires GraphQL query to Projects V2
    STATUS=$(gh api graphql -f query='...')

- name: Check Prerequisites
  run: |
    # hasUXDesign, hasArchitecture, hasPRD checks
    if [ "$NEXT_AGENT" == "architect" ] && [ ! -f "docs/prd/PRD-${ISSUE}.md" ]; then
      echo "❌ Prerequisite missing: PRD required before architecture"
      exit 1
    fi

- name: Run Pre-Handoff Validation
  run: |
    bash .github/scripts/validate-handoff.sh ${ISSUE} ${CURRENT_AGENT}
```

#### 2.2 Enhance `quality-gates.yml`

**Add**:
```yaml
- name: Validate Agent Deliverables
  if: github.event_name == 'pull_request'
  run: |
    # Detect agent role from PR title/labels
    AGENT_ROLE="engineer"  # Default
    if [[ "$PR_TITLE" == *"[PM]"* ]]; then AGENT_ROLE="pm"; fi
    
    # Run validation
    bash .github/scripts/validate-handoff.sh ${ISSUE} ${AGENT_ROLE}
```

---

### Phase 3: Update Prompts (P2 - 30 min)

**Changes**:
```diff
- [02-testing.md](../../skills/02-testing.md)
+ [testing/SKILL.md](../../.github/skills/development/testing/SKILL.md)

- [01-core-principles.md](../../skills/01-core-principles.md)
+ [core-principles/SKILL.md](../../.github/skills/architecture/core-principles/SKILL.md)

- [18-code-review-and-audit.md](../../skills/18-code-review-and-audit.md)
+ [code-review-and-audit/SKILL.md](../../.github/skills/development/code-review-and-audit/SKILL.md)
```

---

## 6. Decision Matrix

### Should We Keep Hooks?

| Scenario | Keep Hooks? | Reason |
|----------|-------------|--------|
| Security checks (secrets, SQL) | ✅ **YES** | Early detection prevents leaks |
| Issue reference check | ✅ **YES** | Enforces Issue-First Workflow |
| Document validation | ❌ **NO** | Moved to pre-handoff validation |
| Conventional commit format | ⚠️ **WARNING ONLY** | Good practice but not enforced |

**Recommendation**: Keep hooks for security + issue reference, remove workflow validation

---

### Should We Update agent-x.yml?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Update to Phase 2** | Fully automated, Status-aware | Complex, requires GraphQL | ⚠️ Medium Priority |
| **Keep as scaffold generator** | Simple, works today | Manual agent invocation | ✅ Acceptable for now |
| **Deprecate entirely** | Simplifies codebase | Lose scaffold automation | ❌ Not recommended |

**Recommendation**: Update for Week 6 (P1), but not blocking for release

---

## 7. Conclusion

### Summary of Findings

| Category | Current State | Alignment | Action |
|----------|---------------|-----------|--------|
| **Hooks** | Pre-commit validation | 40% | Simplify to security + issue ref |
| **Workflows** | Label-based routing | 70% | Add Status + validation |
| **Prompts** | Skill references | 90% | Fix paths |

### Recommendation

**For Week 6 Release**:
1. ✅ **MUST FIX**: Update hooks to remove workflow validation (P0)
2. ⚠️ **SHOULD FIX**: Update agent-x.yml for Status-based routing (P1)
3. ⏳ **CAN DEFER**: Fix prompt skill paths (P2)

**Estimated Effort**: 4-5 hours total

**Risk**: Low - Changes are isolated and well-defined

---

## 8. Files Summary

### Needs Immediate Update (P0)

1. `.github/hooks/commit-msg` - Simplify to issue ref check only
2. `.github/hooks/pre-commit` - Remove workflow validation
3. `.github/hooks/pre-commit.ps1` - Sync with bash version

### Needs Update for Week 6 (P1)

4. `.github/workflows/agent-x.yml` - Add Status routing + validation
5. `.github/workflows/quality-gates.yml` - Integrate validate-handoff.sh

### Can Defer Post-Release (P2)

6. `.github/prompts/code-review.prompt.md` - Fix skill path
7. `.github/prompts/test-gen.prompt.md` - Fix skill path
8. `.github/prompts/refactor.prompt.md` - Fix skill path

### No Changes Needed

9. ✅ `.github/workflows/dependency-scanning.yml` - Working correctly

---

**Last Updated**: January 28, 2026

**Next Action**: Proceed with P0 updates (hooks) before Week 6 release
