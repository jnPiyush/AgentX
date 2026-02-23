# Changelog

All notable changes to AgentX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.4.0] - 2026-02-22

### Added

**Critical Pre-Check with Auto-Install**:
- New `runCriticalPreCheck()` checks all required dependencies on startup and before initialization
- Auto-installs missing VS Code extensions (Copilot, Copilot Chat) via Extensions API
- Auto-installs missing CLI tools (Git, PowerShell, Node.js) via terminal commands
- Modal (blocking) dialog for initialization, non-modal for background startup
- Re-check flow after install to verify all dependencies are present
- 12 new unit tests covering all pre-check scenarios

**PowerShell Shell Fallback**:
- `resolveWindowsShell()` auto-detects `pwsh` (7+) or `powershell.exe` (5.1) on Windows
- `execShell()` uses resolved shell instead of hardcoded `pwsh`
- Prevents install failures on systems with only Windows PowerShell 5.1
- PowerShell version check in `install.ps1` (requires 5.1+, recommends 7+)
- Bash check in `install.sh`

**Copilot Extension Awareness**:
- Pre-flight Copilot/Copilot Chat check in both legacy and WebView initialization paths
- Copilot install reminder at end of CLI installers (`install.ps1`, `install.sh`)

### Changed

- Startup check now uses `runCriticalPreCheck` (auto-install) instead of dismissable warning
- `dependencyChecker.ts` `tryExec()` uses `powershell.exe` fallback on Windows
- VS Code mock expanded with `withProgress`, `createTerminal`, `ProgressLocation`, `extensions` stubs

## [5.3.0] - 2026-02-21

### Added

**New Agent: Customer Coach**:
- Standalone consulting research agent for topic preparation, client engagement prep
- Creates research briefs, comparison matrices, FAQ docs, presentation outlines
- Outputs at `docs/coaching/` and `docs/presentations/`
- Integrated into VS Code extension agent router

**UX Methodology for UX Agent**:
- 5-phase UX framework: Empathize, Define, Ideate, Prototype, Validate
- New `ux-methodology.instructions.md` auto-loaded for UX file patterns
- Session persistence for interrupted design work
- Phase transition protocol with context management

**Release Automation (auto-release)**:
- `auto-release.yml` workflow for automated semantic versioning
- CHANGELOG auto-generation from conventional commits
- Post-release VSIX packaging and GitHub Release upload
- `release-please-config.json` and `.release-please-manifest.json`

**Copilot Coding Agent Setup**:
- `copilot-setup-steps.yml` for GitHub Copilot Coding Agent environment
- Auto-verifies AgentX installation and compiles extension

**Shared PowerShell Modules**:
- `scripts/modules/CIHelpers.psm1` -- CI platform abstraction (GitHub Actions, local)
- `scripts/modules/SecurityHelpers.psm1` -- reusable security scan functions
- Write-CIOutput, Write-CIAnnotation, Write-CISummary, Set-CIGroup
- Find-HardcodedSecrets, Test-BlockedCommand, Get-ViolationSummary

**Agent Delegation Protocol**:
- Formal agent-delegation.md with invocation patterns
- Predefined subagent tasks: accessibility audit, security scan, coverage check
- Response contract and error handling guidelines

**Pack Bundle System**:
- `packs/` directory with manifest-based artifact distribution
- `pack-manifest.schema.json` for validation
- `agentx-core` pack manifest bundling all core artifacts
- Supports dependencies between packs

### Changed

- UX Designer agent now follows UX methodology phases
- Agent router includes Customer Coach for consulting-related queries
- Status bar icon changed from `$(organization)` to `$(hubot)`

### Removed

- Removed external comparison documents from `docs/reviews/`

## [5.2.6] - 2026-02-19

## [5.2.5] - 2026-02-18

### Fixed

- **Cross-platform CLI args**: `runCli()` now accepts `Record<string, string>` named args, formatted as `-Key value` for PowerShell and positional args for bash
- **Bash workflow command**: Fixed `@agentx /workflow` and `/deps` failing on macOS/Linux due to PowerShell-style parameters being passed to bash
- **Bash `run` subcommand**: Added missing `cmd_run()` to `agentx.sh` for feature parity with `agentx.ps1`

## [5.2.0] - 2026-02-18

### Added

**Nested Folder Support**:
- Auto-detection of AgentX root in subfolders up to configurable depth (default: 2 levels)
- New `agentx.rootPath` setting for explicit override of the project root
- New `agentx.searchDepth` setting to control subfolder search depth (0-5)
- Multi-root workspace support -- searches all workspace folders, not just the first
- FileSystemWatcher auto-discovers AgentX when initialized in nested paths mid-session
- `workspaceContains:**/AGENTS.md` activation event for nested folder detection

**Install Script Enhancements**:
- New `-Path` / `--path` parameter to install AgentX into a subfolder
- Post-install tip printed when using `--path` about VS Code `agentx.rootPath` setting
- `AGENTX_PATH` environment variable support for one-liner installs

**VS Code Extension Improvements**:
- Initialize command supports multi-root workspaces with folder picker
- Refresh command invalidates root cache and re-checks initialization state
- Root path cached with automatic invalidation on config/workspace changes

## [5.1.0] - 2026-02-12

### ✨ Added

**Executable Scripts** (Anthropic Skills Pattern):
- **27 scripts** across **16 skills** — deterministic, executable tooling bundled inside skill folders
- Scripts in PowerShell (.ps1), Python (.py), and Bash (.sh) for cross-platform support
- Each SKILL.md updated with `## Scripts` table (name, purpose, usage)

**New Scripts by Skill**:
- **ai-agent-development** (2): `scaffold-agent.py` (full project scaffold with tracing, eval, MCP), `validate-agent-checklist.ps1` (production readiness validator)
- **ai-agent-development** (1 NEW): `check-model-drift.ps1` (model pinning, data drift signals, judge LLM readiness validator)
- **ai-agent-development** reference: `model-drift-judge-patterns.md` (model change management, data drift detection, judge LLM patterns)
- **ai-agent-development** (1 NEW): `run-model-comparison.py` (multi-model evaluation comparison with CI/CD gate checks)
- **ai-agent-development** reference: `model-change-test-automation.md` (multi-model test pipeline design, GitHub Actions CI, comparison reports)
- **prompt-engineering** (1): `scaffold-prompt.py` (structured prompt template with evaluation checklist)
- **testing** (4): `check-coverage.ps1`, `check-coverage.sh`, `check-test-pyramid.ps1`, `scaffold-playwright.py` (Playwright e2e scaffolding with Page Object Model)
- **security** (3): `scan-secrets.ps1`, `scan-secrets.sh`, `scan-security.ps1`
- **containerization** (2): `generate-dockerfile.ps1` (multi-stage, non-root), `generate-compose.ps1`
- **release-management** (2): `version-bump.ps1`, `generate-changelog.ps1`
- **api-design** (1): `scaffold-openapi.py` (OpenAPI 3.1 spec generator)
- **python** (1): `scaffold-project.py` (pyproject.toml + ruff + mypy + pre-commit)
- **csharp** (1): `scaffold-solution.ps1` (.NET solution with API/Core/Infrastructure layers)
- **code-review-and-audit** (1): `run-checklist.ps1` (automated review checklist)
- **dependency-management** (1): `audit-deps.ps1` (outdated + vulnerability scanning)
- **version-control** (1): `setup-hooks.ps1` (Git hooks for pre-commit + commit-msg)
- **database** (1): `scaffold-migration.py` (SQL/EF Core/Alembic migration scaffold)
- **documentation** (1): `generate-readme.py` (auto-detect project, generate README)
- **performance** (1): `run-benchmark.ps1` (.NET/Python/Node benchmarks with baseline comparison)
- **github-actions-workflows** (1): `validate-workflows.ps1` (lint + auto-fix workflow YAML)
- **skill-creator** (1): `init-skill.ps1` (skill initialization scaffold)

---

## [5.0.0] - 2026-02-11

### ✨ Added

**100% agentskills.io Specification Compliance**:
- All **40 skills** validated and certified compliant with [agentskills.io specification](https://agentskills.io/specification)
- Descriptions standardized to single-quoted `WHAT + WHEN + KEYWORDS` format
- All descriptions within **234–314 characters** (well under 1024 char limit)
- Zero compliance violations across the entire skill library

**Progressive Disclosure Architecture**:
- **112 reference files** created across 40 skills for 3-tier loading
- **Tier 1**: SKILL.md core files (all under 500 lines, range 95–383)
- **Tier 2**: Inline details loaded on demand within SKILL.md
- **Tier 3**: Dedicated reference files for deep-dive content
- Optimized for AI assistant token budgets (~20K tokens per task limit)

**Standardized Skill Descriptions**:
- All **40 skill descriptions** rewritten to consistent format
- Format: `'WHAT the skill does. WHEN to use it. KEYWORDS.'`
- No angle brackets, no multi-line, no markdown in descriptions
- All kebab-case folder names validated

**Anthropic Guide Compliance**:
- Validated against "The Complete Guide to Building Skills for Claude" (33 pages)
- No README.md in skill folders (0 found — correct per spec)
- No XML angle brackets in descriptions
- Progressive disclosure pattern matches Anthropic best practices
- No critical gaps identified

**Skill Categories** (40 skills across 6 categories):
- `ai-systems` (3): ai-agent-development, prompt-engineering, skill-creator
- `architecture` (7): api-design, code-organization, core-principles, database, performance, scalability, security
- `cloud` (5): azure, containerization, fabric-analytics, fabric-data-agent, fabric-forecasting
- `design` (1): ux-ui-design
- `development` (20): blazor, code-review-and-audit, configuration, csharp, data-analysis, dependency-management, documentation, error-handling, frontend-ui, go, logging-monitoring, mcp-server-development, postgresql, python, react, rust, sql-server, testing, type-safety, version-control
- `operations` (4): github-actions-workflows, release-management, remote-git-operations, yaml-pipelines

### 🧹 Cleaned

- Removed stale `.github/ISSUE_TEMPLATE/feature-local-mode.md` (superseded by `.yml` form template)
- Purged local-mode runtime artifacts from version control (issues/*.json, digests/*.md, state/*.json, config.json)
- Added `.venv/`, `venv/`, `env/` to `.gitignore`
- Clean working tree with zero untracked files

### 📊 Framework Totals

| Asset | Count |
|-------|-------|
| Skills | 40 |
| Reference Files | 112 |
| Agent Definitions | 8 (7 stable + 1 preview) |
| Instruction Files | 8 |
| Prompt Files | 11 |
| Template Files | 7 (6 templates + 1 README) |
| TOML Workflows | 7 |
| GitHub Issue Templates | 8 |
| GitHub Actions Workflows | 3 |

---

## [4.0.0] - 2026-02-15

### ✨ Added

**Declarative Workflows**:
- **TOML-based workflow templates** at `.agentx/workflows/` (7 types: feature, epic, story, bug, spike, devops, docs)
- Machine-readable step definitions with agent assignments, required artifacts, and validation rules
- `agentx workflow -Type <type>` command to display workflow steps

**Smart Ready Queue**:
- **Priority-sorted work queue** via `agentx ready` command
- Dual-mode support: queries local JSON issues or GitHub via `gh` CLI
- Filters by status (Ready, open) and sorts by priority labels (P0 > P1 > P2 > P3)

**Agent State Tracking**:
- **Real-time agent status** tracked in `.agentx/state/agent-status.json`
- 6 agent roles: product_manager, ux_designer, architect, engineer, reviewer, devops
- States: idle, working, blocked
- `agentx state` command to display all agent states

**Dependency Management**:
- **Issue dependency checking** via `agentx deps -IssueNumber <N>`
- Convention: `Blocked-by: #N` and `Blocks: #N` in issue body `## Dependencies` section
- Validates all blockers are resolved before allowing work to start

**Issue Digests**:
- **Weekly digest generation** via `agentx digest`
- Summarizes open, closed, and blocked issues with priority breakdown
- Agent state overview included
- Markdown reports saved to `.agentx/digests/`

**Dual-Mode CLI**:
- **AgentX CLI** in PowerShell (`.agentx/agentx.ps1`) and Bash (`.agentx/agentx.sh`)
- Auto-detects mode (local vs GitHub) from `.agentx/config.json`
- 7 subcommands: `ready`, `state`, `deps`, `digest`, `workflow`, `hook`, `help`
- `hook start/finish` lifecycle commands with automatic agent state updates
- GitHub mode queries live issues via `gh` CLI

**Agent Lifecycle Hooks**:
- All 7 agent definitions updated with MUST constraints for auto-calling hooks
- `agentx hook -Phase start -Agent <role> -Issue <N>` before starting work
- `agentx hook -Phase finish -Agent <role> -Issue <N>` after completing work
- Dependency validation on hook start, state cleanup on hook finish

### 🔧 Fixed
- Parse-Dependencies regex now handles both bulleted and bare-line formats
- Label normalization in local-issue-manager.ps1 for comma-separated labels
- DateTime/Substring bounds checking in state display

### ✨ Added (v4.0.1 Enhancements)

**Version Tracking & Smart Upgrade**:
- **Version tracking** via `.agentx/version.json` (version, profile, mode, timestamps)
- **`agentx version`** command to display installed version info (PS1 + Bash)
- **`agentx upgrade`** command with MD5-based smart upgrade (only updates changed framework files, preserves user content)

**AI-First Intent Pipeline**:
- **AI intent classification** in all 6 agent `.agent.md` files (PM, UX, Architect, Engineer, Reviewer, DevOps)
- Updated PRD, UX, and Spec templates with AI-specific sections (Model Strategy, AI UX Patterns, AI Architecture)
- GitHub Actions `validate-ai-intent.yml` workflow for PR-level AI intent validation
- Handoff validation scripts updated with AI intent checks

**CLI Expansion (7 → 10 commands)**:
- Added `version`, `upgrade`, and `run` commands to PowerShell CLI
- Bash CLI expanded with `version` and `upgrade` commands

**Framework Self-Tests**:
- 64-assertion test framework in `tests/agentx-framework-tests.ps1`
- Validates: file existence, YAML frontmatter, TOML syntax, workflow completeness, agent definitions, template structure
- Zero-dependency (pure PowerShell), runs in <2 seconds

**New Instruction & Prompt Files**:
- `ai.instructions.md` — AI/ML coding standards (credentials, structured outputs, tracing, evaluation, security)
- `ai-agent.prompt.md` — Guided prompt for scaffolding AI agents with Agent Framework
- `evaluation.prompt.md` — Guided prompt for setting up AI evaluation with Azure AI Evaluation SDK

**Multi-Model Patterns**:
- Added multi-model routing, fallback chains, and `.env.example` pattern to AI Agent Development skill

### 🔧 Fixed (v4.0.1)

- `agentx ready` command now correctly filters by Status=Ready (was showing all open issues)
- Skill count corrected: 39 → 40 across SETUP.md, Skills.md, and README.md
- SETUP.md instruction count updated: 7 → 8 (added ai.instructions.md)
- Domain classification added to all agent definitions for AI-first routing

**Smart Context Loading**:
- `copilot-instructions.md` rewritten as thin router (~2K chars, down from ~6K) — conditional loading rules instead of mandatory gate
- Added Context Budget section to `Skills.md` with loading order, layer sizes, and 3-4 skill per task limit
- AGENTS.md loading made conditional: only for workflow/coordination tasks, skipped for simple code edits

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

[5.3.0]: https://github.com/jnPiyush/AgentX/compare/v5.2.6...v5.3.0
[5.2.6]: https://github.com/jnPiyush/AgentX/compare/v5.2.5...v5.2.6
[5.2.5]: https://github.com/jnPiyush/AgentX/compare/v5.2.0...v5.2.5
[5.2.0]: https://github.com/jnPiyush/AgentX/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/jnPiyush/AgentX/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/jnPiyush/AgentX/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/jnPiyush/AgentX/compare/v2.2.0...v4.0.0
[2.2.0]: https://github.com/jnPiyush/AgentX/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/jnPiyush/AgentX/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jnPiyush/AgentX/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jnPiyush/AgentX/releases/tag/v1.0.0
