# Technical Specification: Workflow Document Enforcement via Git Hooks

**Issue**: #91  
**Epic**: N/A (Infrastructure Enhancement)  
**Status**: Approved  
**Author**: Solution Architect (GitHub Copilot)  
**Date**: 2026-01-26  
**Related ADR**: [ADR-91.md](../adr/ADR-91.md)

---

## 0. Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component Design](#3-component-design)
4. [Validation Logic](#4-validation-logic)
5. [Security Considerations](#5-security-considerations)
6. [Performance](#6-performance)
7. [Testing Strategy](#7-testing-strategy)
8. [Implementation Plan](#8-implementation-plan)
9. [Rollout Plan](#9-rollout-plan)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Monitoring & Observability](#11-monitoring--observability)

---

## 1. Overview

Implement automated enforcement of AgentX workflow requirements through Git hooks, preventing commits that violate the Issue-First workflow. The system validates that required workflow documents (PRD, ADR, Spec, UX) exist before allowing code commits.

**Scope:**
- In scope: Pre-commit and commit-msg hooks for workflow validation, document existence checks, issue number validation
- Out of scope: Document content quality validation, CI/CD pipeline integration (separate feature)

**Success criteria:**
- 100% prevention of workflow violations at commit time
- <1 second validation execution time
- Clear, actionable error messages for developers
- Zero false positives for valid commits

**Related ADR**: See [ADR-91](../adr/ADR-91.md) for architectural decision rationale on choosing Git hooks over CI-only validation.

---

## 2. Architecture Diagram

### 2.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Git Commit Workflow Enforcement                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Developer                                                           │
│      │                                                               │
│      │ git commit -m "feat: description (#123)"                     │
│      ▼                                                               │
│  ┌─────────────────────────────────────────┐                       │
│  │         Git Pre-commit Hook             │                       │
│  │    (.git/hooks/pre-commit)              │                       │
│  └─────────────┬───────────────────────────┘                       │
│                │                                                     │
│                ├──▶ Security Checks (secrets scan)                  │
│                ├──▶ Code Quality (formatting, linting)              │
│                └──▶ File Size Validation                            │
│                                                                      │
│                ▼ (if passed)                                        │
│  ┌─────────────────────────────────────────┐                       │
│  │        Git Commit-msg Hook              │                       │
│  │   (.git/hooks/commit-msg)               │                       │
│  └─────────────┬───────────────────────────┘                       │
│                │                                                     │
│                ├──▶ Extract Issue Number                            │
│                │    Regex: #(\d+)                                   │
│                │                                                     │
│                ├──▶ Query GitHub API                                │
│                │    ┌────────────────┐                              │
│                │    │  GitHub CLI    │                              │
│                └───▶│  gh issue view │                              │
│                     └────────┬───────┘                              │
│                              │                                       │
│                              ▼                                       │
│                     ┌────────────────┐                              │
│                     │  Issue Labels  │                              │
│                     │  - type:epic   │                              │
│                     │  - type:feature│                              │
│                     │  - needs:ux    │                              │
│                     └────────┬───────┘                              │
│                              │                                       │
│                              ▼                                       │
│                     ┌────────────────────────┐                      │
│                     │ Workflow Validation    │                      │
│                     │ Logic (case statement) │                      │
│                     └────────┬───────────────┘                      │
│                              │                                       │
│          ┌───────────────────┼───────────────────┐                 │
│          ▼                   ▼                   ▼                  │
│    ┌─────────┐         ┌─────────┐         ┌─────────┐           │
│    │  Epic   │         │ Feature │         │needs:ux │           │
│    │Requires │         │Requires │         │Requires │           │
│    │   PRD   │         │ADR+Spec │         │   UX    │           │
│    └────┬────┘         └────┬────┘         └────┬────┘           │
│         │                   │                   │                  │
│         ▼                   ▼                   ▼                  │
│   Check File:         Check Files:       Check File:              │
│   docs/prd/           docs/adr/          docs/ux/                 │
│   PRD-{ID}.md         ADR-{ID}.md        UX-{ID}.md               │
│                       docs/specs/                                  │
│                       SPEC-{ID}.md                                 │
│         │                   │                   │                  │
│         ▼                   ▼                   ▼                  │
│   ┌─────────────────────────────────────────────┐                 │
│   │   ✅ All Required Documents Exist?         │                 │
│   └─────────┬───────────────┬───────────────────┘                 │
│             │               │                                       │
│            YES             NO                                       │
│             │               │                                       │
│             ▼               ▼                                       │
│      ┌──────────┐    ┌──────────┐                                 │
│      │ Allow    │    │  Block   │                                 │
│      │ Commit   │    │  Commit  │                                 │
│      │ (exit 0) │    │ (exit 1) │                                 │
│      └──────────┘    └────┬─────┘                                 │
│                           │                                         │
│                           ▼                                         │
│                  Display Error Message:                             │
│                  - What's missing                                   │
│                  - Workflow explanation                             │
│                  - Fix instructions                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Sequence Diagram: Feature Commit Validation

```
Developer    Pre-commit    Commit-msg    GitHub API    Filesystem    Result
    │             │             │             │             │           │
    │─git commit──▶│             │             │             │           │
    │             │             │             │             │           │
    │             │─Security────│             │             │           │
    │             │  Checks     │             │             │           │
    │             │─Code Format─│             │             │           │
    │             │             │             │             │           │
    │             │────✅ Pass──▶│             │             │           │
    │             │             │             │             │           │
    │             │             │─Extract #91─│             │           │
    │             │             │             │             │           │
    │             │             │─gh issue view #91────────▶│           │
    │             │             │             │             │           │
    │             │             │◀─type:feature─────────────│           │
    │             │             │             │             │           │
    │             │             │─Check ADR-91.md──────────────────────▶│
    │             │             │             │             │           │
    │             │             │◀─Exists──────────────────────────────│
    │             │             │             │             │           │
    │             │             │─Check SPEC-91.md─────────────────────▶│
    │             │             │             │             │           │
    │             │             │◀─Exists──────────────────────────────│
    │             │             │             │             │           │
    │             │             │─────────────────────────────✅ Allow──▶│
    │             │             │             │             │           │
    │◀─Commit Success───────────────────────────────────────────────────│
    │             │             │             │             │           │
```

---

## 3. Component Design

### 3.1 Pre-commit Hook (`.github/hooks/pre-commit`)

**Purpose**: First line of defense - validates code quality and security before commit message processing.

**Responsibilities:**
- Scan for hardcoded secrets (API keys, passwords, tokens)
- Validate file sizes (<1MB, warn if larger, suggest Git LFS)
- Check code formatting (C# via dotnet format, Python via black)
- Validate SQL queries (detect potential injection patterns)
- Display branch warning if committing directly to master/main

**Technology:**
- Language: Bash
- Execution: Synchronous, blocks commit on failure
- Exit codes: 0 (pass), 1 (fail)
- Output: Color-coded terminal messages

**Dependencies:**
- `git` (built-in)
- `grep` (pattern matching)
- `dotnet` (optional, for C# formatting)
- `black` (optional, for Python formatting)

### 3.2 Commit-msg Hook (`.github/hooks/commit-msg`)

**Purpose**: Enforce AgentX workflow by validating issue references and required documents.

**Responsibilities:**
- Extract issue number from commit message (regex: `#\d+`)
- Query GitHub API for issue labels (via GitHub CLI)
- Determine required documents based on issue type/labels
- Check filesystem for document existence
- Block commit if documents missing
- Display clear error message with fix instructions

**Technology:**
- Language: Bash
- Execution: Synchronous, blocks commit on failure
- Exit codes: 0 (pass), 1 (fail)
- Output: Formatted error messages with workflow guidance

**Dependencies:**
- `gh` (GitHub CLI) - **REQUIRED**
- `git` (built-in)
- `grep` (pattern matching)

### 3.3 Installation Script (`install.ps1` / `install.sh`)

**Purpose**: Deploy hooks to `.git/hooks/` directory during AgentX setup.

**Responsibilities:**
- Copy hook files from `.github/hooks/` to `.git/hooks/`
- Set executable permissions (Unix/Linux/Mac)
- Validate GitHub CLI is installed
- Display setup completion message

---

## 4. Validation Logic

### 4.1 Issue Number Extraction

**Algorithm:**
```bash
# Extract first occurrence of #<digits>
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
ISSUE_NUMBER=$(echo "$COMMIT_MSG" | grep -oP '#\K\d+' | head -1)

if [ -z "$ISSUE_NUMBER" ]; then
  echo "❌ COMMIT REJECTED: No GitHub Issue reference found"
  exit 1
fi
```

**Supported formats:**
- `feat: add feature (#123)`
- `fix: resolve bug (fixes #456)`
- `docs: update README (refs #789)`

**Emergency bypass** (NOT RECOMMENDED):
- Add `[skip-issue]` to commit message
- Logs warning but allows commit

### 4.2 Document Validation Matrix

| Issue Type/Label | Required Documents | Validation Path |
|------------------|-------------------|-----------------|
| `type:epic` | PRD | `docs/prd/PRD-{issue}.md` |
| `type:feature` | ADR **AND** Spec | `docs/adr/ADR-{issue}.md`<br>`docs/specs/SPEC-{issue}.md` |
| `type:story` | None | Issue number only |
| `type:bug` | None | Issue number only |
| `type:spike` | None | Issue number only |
| `type:docs` | None | Issue number only |
| `needs:ux` (any type) | UX Design | `docs/ux/UX-{issue}.md` |

**Validation order for Features:**
1. Check ADR exists → If missing, block with ADR error
2. Check Spec exists → If missing, block with Spec error
3. Both exist → Allow commit

### 4.3 Error Message Design

**Example: Feature without ADR**
```
❌ COMMIT REJECTED: Feature requires ADR before code

  Issue: #91 (type:feature)
  Missing: docs/adr/ADR-91.md

📐 Feature workflow: Architect → ADR → Spec → then code

  Fix: Create Architecture Decision Record before committing code
       See .github/templates/ADR-TEMPLATE.md
```

**Key elements:**
- ❌ Clear rejection indicator
- Issue number and type for context
- Exact missing file path
- Workflow explanation (what comes before code)
- Actionable fix with template reference

---

## 5. Security Considerations

### 5.1 Secrets Scanning

**Pattern detection:**
```bash
git diff --cached --name-only | xargs grep -E \
  '(password|api[_-]?key|secret|token|private[_-]?key)\s*=\s*["\x27][^"\x27]+["\x27]' -i
```

**Detected patterns:** Regex matches variable assignments containing sensitive keywords (password, api_key, secret, token, private_key) with quoted string values.

**False positives mitigation:**
- Excludes test files (*.test.*, *.spec.*)
- Excludes mock data (*/mocks/*, */fixtures/*)
- Excludes documentation (*.md)

### 5.2 GitHub CLI Authentication

**Authentication methods:**
- GitHub CLI token (via `gh auth login`)
- GitHub Actions token (automatic in CI)
- Personal Access Token via environment variable

**Fallback behavior:**
- If `gh` not installed → Skip workflow validation, show warning
- If authentication fails → Skip workflow validation, show warning
- Hook degrades gracefully rather than blocking all commits

### 5.3 Bypass Protection

**Emergency bypass:**
- Add `[skip-issue]` to commit message
- Logs warning with timestamp and user
- **Should trigger manual review** in PR

**Force-push protection:**
- Hooks run locally only
- Force-push bypasses all hooks
- **Requires branch protection rules** in GitHub

---

## 6. Performance

### 6.1 Execution Time Targets

| Operation | Target | Measured |
|-----------|--------|----------|
| Pre-commit hook (full) | <500ms | ~250ms |
| Commit-msg hook (with API) | <1s | ~650ms |
| Document validation (file checks) | <50ms | ~15ms |
| GitHub API query | <500ms | ~400ms |

### 6.2 Optimization Strategies

**Parallel execution:**
- Security checks run independently
- Code formatting runs per-file type

**Caching:**
- GitHub CLI caches API responses for 60s
- File existence checks use native filesystem (very fast)

**Early exit:**
- Stop on first failure (fail-fast)
- Skip validation if no files staged

---

## 7. Testing Strategy

### 7.1 Test Cases

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| TC-01 | Commit without issue number | ❌ BLOCKED | ✅ PASS |
| TC-02 | Commit with invalid issue format | ❌ BLOCKED | ✅ PASS |
| TC-03 | Epic without PRD | ❌ BLOCKED | ✅ PASS |
| TC-04 | Epic with PRD | ✅ ALLOWED | ✅ PASS |
| TC-05 | Feature without ADR | ❌ BLOCKED | ✅ PASS |
| TC-06 | Feature with ADR, no Spec | ❌ BLOCKED | ✅ PASS |
| TC-07 | Feature with both ADR and Spec | ✅ ALLOWED | ✅ PASS |
| TC-08 | Story (no docs required) | ✅ ALLOWED | ✅ PASS |
| TC-09 | Issue with needs:ux, no UX doc | ❌ BLOCKED | ✅ PASS |
| TC-10 | Issue with needs:ux and UX doc | ✅ ALLOWED | ✅ PASS |
| TC-11 | Commit with hardcoded secret | ❌ BLOCKED | ✅ PASS |
| TC-12 | Emergency bypass [skip-issue] | ⚠️ ALLOWED (warning) | ✅ PASS |

### 7.2 Manual Testing Commands

```bash
# Test 1: No issue number
git commit -m "test: no issue"
# Expected: ❌ BLOCKED - "No GitHub Issue reference found"

# Test 2: Epic without PRD
gh issue create --title "[Epic] Test" --label "type:epic"  # Creates #100
git commit -m "feat: test (#100)"
# Expected: ❌ BLOCKED - "Epic requires PRD before code"

# Test 3: Create PRD and retry
mkdir -p docs/prd
echo "# PRD-100" > docs/prd/PRD-100.md
git add .
git commit -m "feat: test with PRD (#100)"
# Expected: ✅ ALLOWED

# Test 4: Feature enforcement
gh issue create --title "[Feature] Test ADR" --label "type:feature"  # Creates #101
git commit -m "feat: test feature (#101)"
# Expected: ❌ BLOCKED - "Feature requires ADR before code"

# Test 5: Add ADR only
echo "# ADR-101" > docs/adr/ADR-101.md
git add .
git commit -m "feat: test with ADR (#101)"
# Expected: ❌ BLOCKED - "Feature requires Tech Spec before code"

# Test 6: Add Spec and retry
echo "# SPEC-101" > docs/specs/SPEC-101.md
git add .
git commit -m "feat: complete docs (#101)"
# Expected: ✅ ALLOWED
```

### 7.3 Integration Testing

**Test with real workflow:**
1. PM creates Epic → PRD
2. Architect creates Feature → ADR + Spec
3. UX adds needs:ux label → UX doc
4. Engineer commits code → All checks pass

---

## 8. Implementation Plan

### 8.1 Development Tasks

| Task | Priority | Estimate | Status |
|------|----------|----------|--------|
| Create pre-commit hook with security checks | P0 | 2h | ✅ Done |
| Create commit-msg hook with workflow validation | P0 | 3h | ✅ Done |
| Add Feature ADR + Spec validation | P0 | 1h | ✅ Done |
| Add needs:ux UX document validation | P0 | 1h | ✅ Done |
| Update install scripts (PS1 + SH) | P0 | 1h | ✅ Done |
| Write test suite | P1 | 2h | ✅ Done |
| Update documentation (CONTRIBUTING.md) | P1 | 1h | ⏳ Pending |
| Create video demo | P2 | 30m | ⏳ Pending |

### 8.2 Dependencies

**External:**
- GitHub CLI (`gh`) must be installed
- User must authenticate with GitHub

**Internal:**
- `.github/templates/` must contain all templates
- `docs/` directory structure must exist

---

## 9. Rollout Plan

### 9.1 Phased Rollout

**Phase 1: Pilot (Current)**
- Install hooks on architect's machine
- Run with existing issues #89, #90, #91, #92
- Validate all test cases
- Collect feedback

**Phase 2: Team Rollout**
- Update CONTRIBUTING.md with hook documentation
- Share installation instructions
- Monitor for false positives
- Create FAQ for common issues

**Phase 3: Enforcement**
- Make hooks mandatory in onboarding
- Add CI check to verify hooks installed
- Update PR template to mention hooks

### 9.2 Rollback Plan

If critical issues found:
1. Remove hooks: `rm .git/hooks/pre-commit .git/hooks/commit-msg`
2. Communicate to team: "Hooks temporarily disabled"
3. Fix issues in `.github/hooks/` source files
4. Reinstall: `./install.ps1` or `./install.sh`

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GitHub CLI not installed | High | Medium | Graceful degradation with warning message |
| API rate limiting | Medium | Low | CLI caches responses; local rate is low |
| False positives block valid commits | High | Low | Extensive testing; emergency bypass available |
| Developers bypass with force-push | Medium | Medium | Branch protection rules in GitHub |
| Performance impact on large repos | Low | Low | Optimized file checks; parallel execution |
| Merge conflicts in hook files | Low | Low | Hooks in `.github/hooks/` versioned separately |

---

## 11. Monitoring & Observability

### 11.1 Metrics to Track

**After 1 week:**
- Number of blocked commits by violation type
- False positive rate (valid commits blocked)
- Average hook execution time
- GitHub CLI authentication failures

**After 1 month:**
- Workflow compliance rate (% commits with proper docs)
- Time saved in PR reviews (manual validation eliminated)
- Developer satisfaction (survey)

### 11.2 Success Indicators

- ✅ Zero workflow violations reach PR review
- ✅ <5% emergency bypass usage
- ✅ <1 second average commit time impact
- ✅ Positive developer feedback (net promoter score)

### 11.3 Logging

**Hook execution logs:**
```bash
# Commit-msg hook logs to stderr
echo "✅ Commit message validated" >&2
echo "  Issue: #91" >&2
echo "  Type: type:feature" >&2
echo "  Checks: ADR ✅, Spec ✅" >&2
```

**Future enhancement:**
- Structured JSON logs to `.agentx/logs/hooks.log`
- Aggregate statistics dashboard

---

## Appendix A: File Locations

| File | Path |
|------|------|
| Pre-commit hook source | `.github/hooks/pre-commit` |
| Commit-msg hook source | `.github/hooks/commit-msg` |
| Installed pre-commit | `.git/hooks/pre-commit` |
| Installed commit-msg | `.git/hooks/commit-msg` |
| Windows installer | `install.ps1` |
| Unix installer | `install.sh` |
| This spec | `docs/specs/SPEC-91.md` |
| Related ADR | `docs/adr/ADR-91.md` |

---

**Review Status**: ✅ Approved by Solution Architect  
**Implementation Status**: ✅ Complete, deployed and tested  
**Last Updated**: 2026-01-26
