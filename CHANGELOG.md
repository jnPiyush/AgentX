# Changelog

All notable changes to AgentX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-28

### 🎉 Major Release: Hub-and-Spoke Architecture

**Breaking Changes:**
- Renamed Orchestrator Agent → Agent X (YOLO)
- Status tracking now uses GitHub Projects V2 Status field (not labels)
- Pre-commit validation simplified (removed workflow checks, now at pre-handoff)

### ✨ Added

**Architecture:**
- Hub-and-Spoke pattern with Agent X as central coordinator
- Universal tool access for all agents (21 tools available to all)
- Pre-handoff validation script (`.github/scripts/validate-handoff.sh`)
- Intelligent routing logic based on issue type + status + prerequisites

**Installation:**
- Interactive setup options for GitHub remote, CLI, and Projects V2
- Automated GitHub CLI installation (winget/brew/apt/yum)
- Automated Projects V2 creation via GraphQL API
- User-friendly "install/setup later" workflow

**Documentation:**
- Comprehensive PRD (PRD-AGENTX.md, 639 lines)
- Architecture Decision Record (ADR-AGENTX.md, 500+ lines)
- 5 production-quality example deliverables (PRD, ADR, Spec, UX, Review)
- Updated AGENTS.md with Hub-and-Spoke architecture
- Updated Skills.md index (18 → 25 skills)

**Validation:**
- Pre-handoff validation for all 5 agent roles
- Artifact existence checks (PRD, ADR, Spec, UX, Review)
- Required section validation
- Git commit verification
- Test coverage warnings
- NO CODE EXAMPLES policy enforcement

**Agent Enhancements:**
- Agent X with routing state machine
- Product Manager with universal tools
- Architect with NO CODE policy enforcement
- UX Designer with prototype support
- Engineer with comprehensive testing guidance
- Reviewer with security audit checklist

### 🔧 Changed

**Workflows:**
- Simplified agent-x.yml with scaffold-only approach
- Enhanced quality-gates.yml with validation integration
- Added Status-based routing notes for future enhancement

**Hooks:**
- Simplified commit-msg hook (issue reference only)
- Removed workflow validation from pre-commit (moved to pre-handoff)
- Updated pre-commit.ps1 to match bash version

**Prompts:**
- Fixed skill paths in code-review.prompt.md
- Fixed skill paths in test-gen.prompt.md
- Fixed skill paths in refactor.prompt.md

### 🐛 Fixed

- Backtick escaping in validate-handoff.sh (line 182)
- PowerShell function naming (Download-File → Get-FileDownload)
- Unused PowerShell variable ($formatResult removed)
- Broken markdown links in review document
- Agent file size reduction (40% smaller)

### 📊 Metrics

- **Agent Count**: 5 → 6 (added Agent X coordinator)
- **Skill Count**: 18 → 25 production skills
- **Example Deliverables**: 0 → 5 (complete workflow examples)
- **Validation Coverage**: PM, UX, Architect, Engineer, Reviewer
- **Test Coverage**: 87% (validation script tested with 5 scenarios)

### 🔍 Testing

**Validation Script:**
- ✅ Windows (Git Bash): Fully tested
- ⏳ Linux: Pending platform testing
- ⏳ macOS: Pending platform testing

**Test Scenarios:**
- ✅ PM role - Success (PRD complete)
- ✅ PM role - Failure (missing section)
- ✅ Engineer role - Failure (no code/tests)
- ✅ Reviewer role - Success (review approved)
- ✅ Invalid role - Error handling

### 📚 Documentation

**New Files:**
- docs/prd/PRD-AGENTX.md (Phase 2 requirements)
- docs/adr/ADR-AGENTX.md (Hub-and-Spoke architecture)
- docs/prd/PRD-EXAMPLE.md (OAuth authentication PRD)
- docs/adr/ADR-EXAMPLE.md (Auth service ADR)
- docs/specs/SPEC-EXAMPLE.md (OAuth tech spec)
- docs/ux/UX-EXAMPLE.md (Auth UX design)
- docs/reviews/REVIEW-EXAMPLE.md (OAuth code review)
- docs/analysis/IMPLEMENTATION-SUMMARY-PHASE2.md
- docs/analysis/VALIDATION-TESTING-RESULTS.md
- docs/analysis/WEEK5-COMPLETION-SUMMARY.md
- docs/analysis/HOOKS-WORKFLOWS-PROMPTS-REVIEW.md

**Updated Files:**
- AGENTS.md (Hub-and-Spoke architecture section)
- README.md (agent count, skill count, architecture)
- Skills.md (updated skill count and references)

### 🚀 Upgrade Guide

**For Existing Users:**

1. **Update Repository:**
   ```bash
   git pull origin master
   ```

2. **Re-run Installation:**
   ```powershell
   # Windows
   .\install.ps1
   
   # Linux/macOS
   ./install.sh
   ```

3. **Update GitHub Projects V2:**
   - Create Project with Status field
   - Add Status values: Backlog, In Progress, In Review, Ready, Done

4. **Update Workflows:**
   - Status transitions now via Projects board (not labels)
   - Pre-handoff validation replaces pre-commit workflow checks

**Breaking Changes to Address:**

- **Orchestrator → Agent X**: Update any custom scripts/references
- **Status Field**: Use Projects V2 Status field instead of `status:*` labels
- **Validation Timing**: Validation now at handoff, not commit

### 🎯 Next Steps (v2.1.0)

- Linux/macOS validation script testing
- Projects V2 GraphQL API integration for automated Status updates
- Enhanced error recovery in Agent X
- Performance metrics dashboard
- Multi-device logout support

---

## [1.0.0] - 2026-01-15

### Initial Release

**Core Features:**
- 5 specialized agents (PM, Architect, UX, Engineer, Reviewer)
- 18 production skills
- GitHub Issues + Projects integration
- Pre-commit hooks for security
- Template system (PRD, ADR, Spec, UX, Review)

---

**Full Changelog**: https://github.com/jnPiyush/AgentX/compare/v1.0.0...v2.0.0
