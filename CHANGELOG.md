# Changelog

All notable changes to AgentX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - v3.0.0 Roadmap

> **Epic**: [#118](https://github.com/jnPiyush/AgentX/issues/118) | **PRD**: [docs/prd/PRD-118.md](docs/prd/PRD-118.md)

### 🎯 Planned Features

**High Priority (P0)**:
- **Agent Analytics Dashboard** ([#119](https://github.com/jnPiyush/AgentX/issues/119)) - Track handoff times, throughput, rework rates, token consumption
- **Auto-Fix Reviewer** ([#120](https://github.com/jnPiyush/AgentX/issues/120)) - Reviewer agent that applies safe fixes (with human approval)
- **Prompt Engineering Skill** ([#121](https://github.com/jnPiyush/AgentX/issues/121)) - Guide for system prompts, CoT, few-shot, guardrails

**Medium Priority (P1)**:
- **Cross-Repo Orchestration** ([#122](https://github.com/jnPiyush/AgentX/issues/122)) - Monorepo and multi-repo workflow support
- **CLI & Web Interface** ([#123](https://github.com/jnPiyush/AgentX/issues/123)) - Headless `agentx` CLI and web dashboard
- **Agent Memory System** ([#124](https://github.com/jnPiyush/AgentX/issues/124)) - Long-term memory for patterns and preferences
- **Workflow Visualization** ([#125](https://github.com/jnPiyush/AgentX/issues/125)) - Mermaid diagrams and debug mode

---

## [2.2.0] - 2026-02-03

### ✨ Added

**Session Persistence & Auto-Resume** (Phase 1 & 2):
- **Progress Log System**: Agents create session logs at `docs/progress/ISSUE-{id}-log.md`
  - Template at `.github/templates/PROGRESS-TEMPLATE.md`
  - Tracks accomplishments, blockers, next steps across sessions
  - Enables continuity for long-running tasks (>200K tokens)
- **Three-Tier Persistence**: 
  - Tier 1: GitHub Issues (coarse-grained status)
  - Tier 2: Progress logs (medium-grained session notes)
  - Tier 3: Git commits (fine-grained code changes)
- **Session Lifecycle**: Pre-session → Active Session → Checkpoint & Handoff
- **Auto-Resume Pattern**: Agents resume from progress logs when context window fills
- **Token Budget Management**: Agents monitor usage and trigger resume at 80%
- **Documentation**: Complete guide at `docs/session-persistence.md` (700+ lines)

**Defense-in-Depth Security Model** (Phase 2):
- **4-Layer Security Architecture**:
  - Level 1: Sandbox (OS-level isolation) - Recommended
  - Level 2: Filesystem (project directory restrictions) - Active
  - Level 3: Allowlist (command validation) - Active
  - Level 4: Audit (command logging) - Active
- **Command Allowlist**: Configuration at `.github/security/allowed-commands.json`
  - Allowed: git, dotnet, npm, gh, python, filesystem (read/safe write)
  - Blocked: `rm -rf`, `git reset --hard`, `DROP DATABASE`, `DROP TABLE`, etc.
- **Pre-Commit Validation**: Enhanced `.github/hooks/pre-commit`
  - Check #7: Blocked command detection
  - Scans staged files for destructive operations
- **Skills Documentation**: Updated `Skills.md` with security tier model

**Feature Checklist System** (Phase 1):
- **Acceptance Criteria in SPEC Template**:
  - New `acceptance_criteria` input field (array type)
  - Checkbox format: `- [ ] **AC1**: Description`
  - Minimum 3-10 criteria per feature
  - Engineer checks off as verified
- **Architect Constraint**: MUST define acceptance criteria in all specs
- **Engineer Tracking**: Progress logged per criterion

**Verification Test Pattern** (Phase 1):
- **Engineer Workflow Update**: New Step 2 - "Run Verification Tests (CRITICAL!)"
- **Regression Prevention**:
  - MUST run all existing tests before starting new work
  - MUST stop if any tests fail
  - Fix regressions FIRST before proceeding
- **Engineer Constraints**:
  - "MUST run verification tests before starting new work"
  - "MUST NOT proceed if existing tests are failing"
- **Best Practice**: Test ≥3 previously working features manually

**Agent Constraint Updates** (All Agents):
- **PM**: Added progress log requirement
- **UX**: Added progress log and PRD validation requirement
- **Architect**: Added progress log and acceptance criteria definition requirement
- **Engineer**: Added 5 new constraints (verification tests, progress logs, commits)
- **Reviewer**: Added progress log reading and update requirements

### 🔄 Changed
- Engineer agent workflow now includes verification testing step
- All 5 agent files updated with progress log constraints
- SPEC template updated with acceptance criteria section
- Pre-commit hook now validates against command allowlist

### 📚 Documentation
- `docs/session-persistence.md` - Complete guide (700+ lines)
- `.github/templates/PROGRESS-TEMPLATE.md` - Session log template
- `.github/security/allowed-commands.json` - Security configuration
- `Skills.md` - Added defense-in-depth security model section
- `README.md` - Added "What's New in v2.2" section

### 🛡️ Security
- Defense-in-depth security model implemented
- Command allowlist enforcement (pre-commit + runtime)
- Audit logging for all terminal commands
- Blocked destructive commands at multiple layers

### 📊 Status
- ✅ All Phase 1 & Phase 2 features implemented and tested
- ✅ Production-ready and stable
- 🔜 Phase 3 (v3.0.0): Browser automation, Playwright integration

---

## [2.1.0] - 2026-02-03

### ✨ Added

**Agent Enhancements:**
- **Maturity Lifecycle**: All agents now declare maturity level (`stable`/`preview`/`experimental`/`deprecated`)
- **Constraint-Based Design**: Agents explicitly declare boundaries with `CAN`/`CANNOT` and `can_modify`/`cannot_modify`
- **Enhanced Handoff Buttons**: 
  - Added icons (📋 PM, 🎨 UX, 🏗️ Architect, 🔧 Engineer, 🔍 Reviewer)
  - Input variables in prompts (`${issue_number}`)
  - Context notes explaining when to use each handoff
- **Agent X Autonomous Mode**: New agent for auto-routing simple tasks (bugs, docs, ≤3 files)
  - Bypasses PM/Architect for simple work
  - Decision matrix based on complexity
  - Automatic escalation to full workflow when needed

**Template System:**
- **Input Variables**: Dynamic content with `${variable_name}` syntax
- **YAML Frontmatter**: All templates now have `inputs:` declarations
- **Special Tokens**: `${current_date}`, `${current_year}`, `${user}`
- Updated all 5 templates: PRD, ADR, UX, Spec, Review
- Required/optional field enforcement
- Default values for common fields

**Workflow Improvements:**
- **Context Clearing Guidance**: Clear decision matrix for when to clear context between phases
- Prevents assumption contamination (Architect → Engineer transition)
- Forces reliance on documented artifacts
- Updated AGENTS.md with context management section

**Documentation:**
- Template Input Variables Guide (428 lines) - Complete guide for dynamic templates
- New Features Summary v2.1 (387 lines) - Migration guide and feature overview
- Agent X Autonomous specification (368 lines) - Autonomous mode documentation
- Updated AGENTS.md with constraint-based design principles

### 🔄 Changed
- All 6 agent definitions now include `maturity`, `constraints`, and `boundaries` fields
- Handoff buttons enhanced with better UX and context
- AGENTS.md updated with new features reference section

### 📊 Status
- ✅ All features are **stable** and production-ready
- ✅ No breaking changes - all features are additive
- ✅ Backward compatible with existing templates and workflows

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
