# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Update Status** in GitHub Projects V2 (or local file in Local Mode)

### Issue-First Flow

Every piece of work -- bug fix, feature, docs update -- **MUST** start with an issue.

**Why issue-first?** Agents rely on issues for routing, status tracking, and handoffs. The ready queue sorts by priority. Commits reference issues for traceability. Without an issue, nothing can be routed or reviewed.

**GitHub Mode:**
```bash
gh issue create --title "[Story] Add /health endpoint" --label "type:story"  # Creates #42
.\.agentx\agentx.ps1 ready                        # Pick from ready queue
# Work... then commit:
git commit -m "feat: add health endpoint (#42)"
gh issue close 42 --reason completed
```

**Local Mode:**
```powershell
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Bug] Fix timeout" -Labels "type:bug"  # Creates #1
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
git commit -m "fix: resolve login timeout (#1)"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

**Emergency bypass**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward.

> **Status Tracking**: Use GitHub Projects V2 **Status** field (GitHub mode) or local JSON status (Local mode).
> See [docs/SETUP.md](docs/SETUP.md#local-mode-no-github) for local mode details.

### AgentX CLI Utilities

The AgentX CLI provides lightweight orchestration commands that work in both Local and GitHub modes. The CLI reads `.agentx/config.json` to detect the mode and fetches issue data from the appropriate source (`gh` CLI for GitHub mode, local JSON files for Local mode).

```powershell
# PowerShell
.\.agentx\agentx.ps1 ready # Show unblocked work sorted by priority
.\.agentx\agentx.ps1 state # Show all agent states
.\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
.\.agentx\agentx.ps1 deps -IssueNumber 42 # Check issue dependencies
.\.agentx\agentx.ps1 digest # Generate weekly digest
.\.agentx\agentx.ps1 workflow -Type feature # Show workflow steps
.\.agentx\agentx.ps1 hook -Phase start -Agent engineer -Issue 42 # Lifecycle hook
```

```bash
# Bash
./.agentx/agentx.sh ready
./.agentx/agentx.sh state engineer working 42
./.agentx/agentx.sh deps 42
./.agentx/agentx.sh hook start engineer 42
```

**Dependency Convention**: Add a `## Dependencies` section in issue bodies:
```markdown
## Dependencies
Blocked-by: #10, #12
Blocks: #15
```

---

## Architecture

### Hub-and-Spoke Pattern

AgentX uses a **Hub-and-Spoke architecture** for agent coordination:

```
 Agent X (Hub)
 |
 --------------+--------------
 | | |
 PM Agent Architect Agent UX Agent
 | | |
 --------------+--------------
 |
 Engineer Agent
 |
 Reviewer Agent
```

**Key Principles:**

1. **Centralized Coordination** - Agent X routes all work, validates prerequisites, handles errors
2. **Strict Role Separation** - Each agent produces one deliverable type (PRD, ADR, Code, Review)
3. **Universal Tool Access** - All agents have access to all tools for maximum flexibility
4. **Status-Driven** - GitHub Projects V2 Status field is the source of truth
5. **Pre-Handoff Validation** - Artifacts validated before status transitions

### Routing Logic

Agent X routes issues based on:
- **Issue type** (Epic, Feature, Story, Bug, Spike)
- **Status** (Backlog, In Progress, In Review, Ready, Done)
- **Labels** (needs:ux, needs:changes, etc.)
- **Prerequisites** (PRD exists, UX complete, Spec ready)

**Routing rules:**
```
Epic + Backlog -> Product Manager
Ready + needs:ux -> UX Designer
Ready + (no architecture) -> Architect
Ready + (has architecture) -> Engineer
needs:iteration -> Engineer (extended iterative-loop workflow, max 20)
In Review -> Reviewer
Bug + Backlog -> Engineer (skip PM/Architect)
Spike + Backlog -> Architect
type:devops + Backlog -> DevOps Engineer (skip PM/Architect for infrastructure work)
```

**Autonomous Mode**: For simple tasks (bugs, docs, stories 3 files), Agent X can automatically route to Engineer, skipping manual coordination. See [Agent X](.github/agents/agent-x.agent.md) (mode: adaptive).

**Universal Iterative Refinement**: ALL workflows include `iterate = true` on the Engineer's implementation step by default. Loop state is auto-initialized when the workflow runs, and the Engineer ALWAYS works in iterations until completion criteria are met. The Reviewer ALWAYS verifies loop completion before approval. The `needs:iteration` label is reserved for **extended** iteration via `iterative-loop.toml` (max 20 iterations, dedicated planning step). See [Iterative Loop Skill](.github/skills/ai-systems/iterative-loop/SKILL.md).

### Validation

**Pre-handoff validation** ensures quality before status transitions:

```bash
# Validate before handoff
./.github/scripts/validate-handoff.sh <issue_number> <role>

# Example
./.github/scripts/validate-handoff.sh 100 pm
```

**Validation checks:**
- PM: PRD exists, child issues created, required sections present
- UX: Wireframes + user flows + **HTML/CSS prototypes (MANDATORY)** complete, accessibility considered
- Architect: ADR + Tech Spec exist, NO CODE EXAMPLES compliance
- Engineer: Code committed, tests 80% coverage, docs updated
- Reviewer: Review document complete, approval decision present

---

## Classification

| Type | Role | Deliverable |
|------|------|-------------|
| `type:epic` | PM | PRD + Backlog |
| `type:feature` | Architect | ADR + Tech Spec |
| `type:story` | Engineer | Code + Tests |
| `type:bug` | Engineer | Bug fix + Tests |
| `type:spike` | Architect | Research doc |
| `type:docs` | Engineer | Documentation |
| `type:devops` | DevOps Engineer | CI/CD Pipelines + Deployment Docs |

**Decision Tree:**
- Broken? -> `type:bug`
- Research? -> `type:spike`
- Docs only? -> `type:docs`
- Pipeline/deployment/release? -> `type:devops`
- Large/vague? -> `type:epic`
- Single capability? -> `type:feature`
- Else -> `type:story`

---

## Agent Roles

### Agent Design Principles

**Constraint-Based Design**: Each agent explicitly declares what it CAN and CANNOT do. This prevents role confusion and workflow violations.

**Maturity Levels**:
- `stable` - Production-ready, fully tested, recommended for all users
- `preview` - Feature-complete, undergoing final validation
- `experimental` - Early development, subject to breaking changes
- `deprecated` - Scheduled for removal, use alternative agent

All AgentX core agents are currently **stable** (production-ready).

### Product Manager
- **Maturity**: Stable
- **Trigger**: `type:epic` label
- **Output**: PRD at `docs/prd/PRD-{issue}.md` + Feature/Story issues
- **Status**: Move to `Ready` when PRD complete
- **Tools**: All tools available (issue_write, semantic_search, create_file, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} pm`
- **Constraints**:
 - [PASS] CAN research codebase, create PRD, create child issues
 - [FAIL] CANNOT write code, create UX designs, or technical specs
- **Boundaries**:
 - Can modify: `docs/prd/**`, GitHub Issues
 - Cannot modify: `src/**`, `docs/adr/**`, `docs/ux/**`

### UX Designer
- **Maturity**: Stable
- **Trigger**: `needs:ux` label + Status = `Ready`
- **Output**: UX Design at `docs/ux/UX-{issue}.md` + **HTML/CSS Prototypes (MANDATORY)** at `docs/ux/prototypes/`
- **Status**: Move to `Ready` when designs complete
- **Tools**: All tools available (create_file, read_file, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} ux`
- **Constraints**:
 - [PASS] MUST create wireframes, user flows, and production-ready HTML/CSS prototypes
 - [FAIL] CANNOT write application code or create technical architecture
- **Boundaries**:
 - Can modify: `docs/ux/**`, `docs/assets/**`
 - Cannot modify: `src/**`, `docs/adr/**`, `docs/prd/**`

### Solution Architect
- **Maturity**: Stable
- **Trigger**: `type:feature`, `type:spike`, or Status = `Ready` (after PM, parallel with UX)
- **Output**: ADR at `docs/adr/ADR-{issue}.md` + Tech Specs at `docs/specs/`
- **Status**: Move to `Ready` when spec complete
- **Tools**: All tools available (create_file, semantic_search, grep_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} architect`
- **Note**: Tech Specs use diagrams, NO CODE EXAMPLES
- **Constraints**:
 - [PASS] CAN research codebase patterns, create ADR/specs with diagrams
 - [FAIL] CANNOT write implementation code or include code examples in specs
- **Boundaries**:
 - Can modify: `docs/adr/**`, `docs/specs/**`, `docs/architecture/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/ux/**`

### Software Engineer
- **Maturity**: Stable
- **Trigger**: `type:story`, `type:bug`, or Status = `Ready` (spec complete)
- **Status**: Move to `In Progress` when starting -> `In Review` when code complete
- **Output**: Code + Tests (80% coverage) + Documentation
- **Tools**: All tools available (replace_string_in_file, run_in_terminal, get_errors, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} engineer`
- **Constraints**:
 - [PASS] CAN implement code, write tests, update documentation
 - [FAIL] CANNOT modify PRD/ADR/UX docs, skip tests, or merge without review
- **Boundaries**:
 - Can modify: `src/**`, `tests/**`, `docs/README.md`
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `docs/ux/**`, `.github/workflows/**`

### Code Reviewer
- **Maturity**: Stable
- **Trigger**: Status = `In Review`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Done` and close issue (or back to `In Progress` if changes needed)
- **Tools**: All tools available (get_changed_files, run_in_terminal, semantic_search, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} reviewer`
- **Constraints**:
 - [PASS] CAN review code, request changes, approve/reject
 - [FAIL] CANNOT modify source code directly (must request changes)
- **Boundaries**:
 - Can modify: `docs/reviews/**`, GitHub Issues (comments, labels, status)
 - Cannot modify: `src/**`, `tests/**`, `docs/prd/**`, `docs/adr/**`

### DevOps Engineer
- **Maturity**: Stable
- **Trigger**: `type:devops`, or Status = `Ready` (for pipeline/deployment work)
- **Output**: Workflows at `.github/workflows/**`, Deployment docs at `docs/deployment/**`
- **Status**: Move to `Ready` when pipelines complete -> `In Review` for review
- **Tools**: All tools available (create_file, semantic_search, run_in_terminal, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} devops`
- **Constraints**:
 - [PASS] CAN create CI/CD pipelines, GitHub Actions workflows, deployment automation, release pipelines
 - [FAIL] CANNOT modify application source code, PRD, ADR, or UX documents
- **Boundaries**:
 - Can modify: `.github/workflows/**`, `scripts/deploy/**`, `scripts/ci/**`, `docs/deployment/**`
 - Cannot modify: `src/**`, `tests/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

### Auto-Fix Reviewer (Preview)
- **Maturity**: Preview
- **Trigger**: Status = `In Review` (when auto-fix is preferred)
- **Output**: Review + auto-applied safe fixes at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Done` (or `In Progress` for complex changes)
- **Constraints**:
 - [PASS] CAN auto-fix: formatting, imports, naming, null checks, docs
 - [PASS] CAN suggest: refactoring, logic changes (needs human approval)
 - [FAIL] CANNOT merge without human approval
 - [FAIL] CANNOT modify business logic without explicit approval
- **Boundaries**:
 - Can modify: `src/**` (safe fixes only), `tests/**`, `docs/reviews/**`
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `.github/workflows/**`

### Agent X (Hub Coordinator)
- **Maturity**: Stable
- **Mode**: Adaptive (auto-detects complexity)
- **Role**: Routes work to specialized agents based on issue type and complexity
- **Tools**: All tools available + runSubagent for delegation
- **Constraints**:
 - [PASS] CAN analyze complexity and route autonomously or through full workflow
 - [PASS] CAN skip PM/Architect for simple bugs/docs (3 files, clear scope)
 - [PASS] MUST escalate to full workflow when complexity detected
 - [FAIL] CANNOT create deliverables (PRD, ADR, Code, etc.)
- **Autonomous Triggers**: `type:bug`, `type:docs`, simple `type:story` (3 files, clear acceptance criteria)
- **Full Workflow Triggers**: `type:epic`, `type:feature`, `needs:ux`, complex stories (>3 files)

### Customer Coach
- **Maturity**: Stable
- **Trigger**: Consulting research requests, topic preparation, client engagement prep
- **Output**: Research briefs at `docs/coaching/`, presentation outlines at `docs/presentations/`
- **Status**: Creates deliverables standalone (not part of SDLC pipeline)
- **Tools**: All tools available (web search, semantic_search, read_file, create_file, etc.)
- **Constraints**:
 - [PASS] CAN research any topic, create briefs, comparison matrices, FAQ docs
 - [PASS] CAN create presentation outlines and executive summaries
 - [FAIL] CANNOT provide legal, medical, or financial advice
 - [FAIL] CANNOT fabricate statistics or case studies
- **Boundaries**:
 - Can modify: `docs/coaching/**`, `docs/presentations/**`, GitHub Issues
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

---

## Handoff Flow

```
PM -> UX (optional, parallel) -> Engineer -> Reviewer -> Done
 (down) Architect (parallel) -------(up)
```

**Parallel Work**: UX Designer and Architect can work simultaneously after PM completes PRD.

### Backlog-Based Handoffs

Agents query the backlog for the next priority item instead of receiving explicit issue numbers.

| Agent | Picks Up |
|-------|----------|
| **UX Designer** | Status=`Ready` + `needs:ux`, sorted by priority |
| **Architect** | Status=`Ready` + PRD complete, sorted by priority |
| **Engineer** | Status=`Ready` + ADR/Spec complete, sorted by priority |
| **Reviewer** | Status=`In Review`, sorted by priority |
| **DevOps** | `type:devops` + Status=`Ready`, sorted by priority |

**Priority Order**: `priority:p0` > `priority:p1` > `priority:p2` > `priority:p3` > (no label)

If no matching issues found, agent reports "No [role] work pending."

### Context Management

Clear context before implementation phase (UX/Architect -> Engineer) to prevent design assumptions from leaking into code. Use `/clear` in Copilot Chat or start a new session.

| Transition | Clear? | Reason |
|------------|--------|--------|
| PM -> UX/Architect | No | Needs PRD context |
| UX/Architect -> Engineer | **Yes** | Engineer follows spec only |
| Engineer -> Reviewer | No | Reviewer needs full context |
| Reviewer -> Engineer (rework) | No | Needs review feedback |

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | -> `Ready` | Ready for design/architecture |
| UX completes designs | -> `Ready` | Ready for architecture |
| Architect completes spec | -> `Ready` | Ready for implementation |
| Engineer starts work | -> `In Progress` | Active development |
| Engineer completes code | -> `In Review` | Ready for code review |
| Reviewer approves | -> `Done` + Close | Work complete |

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Spec | `.github/templates/SPEC-TEMPLATE.md` |
| Spec Lite | `.github/templates/SPEC-TEMPLATE-LITE.md` |
| UX | `.github/templates/UX-TEMPLATE.md` |
| Review | `.github/templates/REVIEW-TEMPLATE.md` |
| Security Plan | `.github/templates/SECURITY-PLAN-TEMPLATE.md` |

**Template Features**:
- **Input Variables**: Dynamic content with `${variable_name}` syntax declared in YAML frontmatter
- **Required Fields**: Enforce critical data collection (`required: true`)
- **Default Values**: Pre-fill common values (`default: "p2"`)
- **Special Tokens**: `${current_date}`, `${user}`, etc.

Templates declare inputs in frontmatter. Agents substitute values when creating documents:
```yaml
---
inputs:
  epic_title:
    description: "Title of the Epic"
    required: true
  date:
    required: false
    default: "${current_date}"
---
# PRD: ${epic_title}
```

---

## Commit Messages

```
type: description (#issue-number)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

---

## Security

**Blocked Commands**: `rm -rf /`, `git reset --hard`, `drop database`

**Checklist**:
- [PASS] No hardcoded secrets
- [PASS] SQL parameterization
- [PASS] Input validation
- [PASS] Dependencies scanned

---

## Quick Reference

### File Locations

| Need | Location |
|------|----------|
| Agent Definitions | `.github/agents/` |
| Templates | `.github/templates/` |
| Skills | `.github/skills/` |
| Instructions | `.github/instructions/` |
| Workflow Templates | `.agentx/workflows/` |
| Agent State | `.agentx/state/` |
| Issue Digests | `.agentx/digests/` |
| CLI Utilities | `.agentx/agentx.ps1`, `.agentx/agentx.sh` |
| Shared Modules | `scripts/modules/` |
| Packs | `packs/` |
| Agent Delegation | `.github/agent-delegation.md` |

### New Features (v6.1)

| Feature | Location | Status |
|---------|----------|--------|
| **Typed Event Bus** | `vscode-extension/src/utils/eventBus.ts` | [PASS] Stable |
| **Structured Thinking Log** | `vscode-extension/src/utils/thinkingLog.ts` | [PASS] Stable |
| **Context Compaction** | `vscode-extension/src/utils/contextCompactor.ts` | [PASS] Stable |
| **Channel Abstraction** | `vscode-extension/src/utils/channelRouter.ts` | [PASS] Stable |
| **Cron Task Scheduler** | `vscode-extension/src/utils/taskScheduler.ts` | [PASS] Stable |

### New Features (v6.0)

| Feature | Location | Status |
|---------|----------|--------|
| **Critical Pre-Check Auto-Install** | `src/commands/setupWizard.ts` | [PASS] Stable |
| **PowerShell Shell Fallback** | `src/utils/shell.ts` | [PASS] Stable |
| **Copilot Extension Awareness** | `src/commands/initialize.ts` | [PASS] Stable |
| **Expanded VS Code Test Mocks** | `src/test/mocks/vscode.ts` | [PASS] Stable |

### Previous Versions

<details>
<summary>Click to expand v2.1-v5.3 features</summary>

**v5.3**: Customer Coach Agent, UX Methodology Instructions, Release Automation, Copilot Coding Agent Setup, Shared PowerShell Modules, Agent Delegation Protocol, Pack Bundle System

**v5.1-v5.2**: Executable Scripts (30 across 17 skills), Playwright E2E Scaffold, Cognitive Architecture, TypeScript Instructions, 5-Minute Quickstart

**v5.0**: 100% agentskills.io Compliance (41 skills), Progressive Disclosure (112 reference files), Standardized Descriptions, Anthropic Guide Compliance

**v4.0**: Declarative Workflows (7 TOML templates), Smart Ready Queue, Agent State Tracking, Dependency Management, Issue Digests

**v3.0**: Agent Analytics, Auto-Fix Reviewer (Preview), Prompt Engineering Skill, Local Mode, Cross-Repo Orchestration, DevOps Agent, Visualization

**v2.1**: Maturity Levels, Constraint-Based Design, Handoff Buttons, Template Input Variables, Context Clearing, Agent X Adaptive Mode

</details>

### Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`, `needs:iteration` (extended loop, max 20)

---

**See Also**: [Skills.md](Skills.md) for production code standards and workflow scenarios | [Quickstart](docs/QUICKSTART.md) for 5-minute onboarding | [Setup](docs/SETUP.md) for installation and troubleshooting
