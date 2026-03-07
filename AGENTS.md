# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Retrieval-Led Reasoning

**IMPORTANT**: Prefer retrieval-led reasoning over pre-training-led reasoning for ALL implementation tasks.
Always `read_file` the relevant SKILL.md, instruction file, or spec before generating code.
Do NOT rely on training data for project-specific patterns, conventions, or APIs.
If a skill, spec, or doc exists in the workspace, read it first; generate second.

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Update Status** in GitHub Projects V2 (or local file in Local Mode)

### Issue-First Flow

Every piece of work -- bug fix, feature, docs update -- **SHOULD** start with an issue.

**Why issue-first?** Agents rely on issues for routing, status tracking, and handoffs. The ready queue sorts by priority. Commits reference issues for traceability. Without an issue, nothing can be routed or reviewed.

**Issue enforcement by mode:**
- **GitHub Mode**: Issue references in commits are **required** by default (teams need traceability)
- **Local Mode**: Issue references are **optional** by default (solo developers can commit freely)
- To toggle enforcement: `.agentx/agentx.ps1 config set enforceIssues true` (or `false`)

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
# Issues are optional in local mode - you can commit without issue references
git commit -m "feat: add user login"

# Or use full issue workflow if preferred:
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Bug] Fix timeout" -Labels "type:bug"  # Creates #1
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
git commit -m "fix: resolve login timeout (#1)"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1

# Enable issue enforcement in local mode:
.\.agentx\agentx.ps1 config set enforceIssues true
```

**Emergency bypass (GitHub mode)**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward.

> **Status Tracking**: Use GitHub Projects V2 **Status** field (GitHub mode) or local JSON status (Local mode).
> See [docs/GUIDE.md](docs/GUIDE.md#local-mode-no-github) for local mode details.

### AgentX CLI Utilities

The AgentX CLI provides lightweight orchestration commands that work in both Local and GitHub modes. The CLI reads `.agentx/config.json` to detect the mode and fetches issue data from the appropriate source (`gh` CLI for GitHub mode, local JSON files for Local mode).

```powershell
# PowerShell
.\.agentx\agentx.ps1 ready # Show unblocked work sorted by priority
.\.agentx\agentx.ps1 state # Show all agent states
.\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
.\.agentx\agentx.ps1 deps -IssueNumber 42 # Check issue dependencies
.\.agentx\agentx.ps1 digest # Generate weekly digest
.\.\.agentx\agentx.ps1 workflow -Type feature # Show workflow steps
.\.agentx\agentx.ps1 hook -Phase start -Agent engineer -Issue 42 # Lifecycle hook
.\.agentx\agentx.ps1 run engineer "Fix the failing tests" # Run agentic loop (LLM + tools)
.\.agentx\agentx.ps1 run architect "Design auth system" -i 42 # Run with issue number
.\.agentx\agentx.ps1 config show # View current configuration
.\.agentx\agentx.ps1 config set enforceIssues true # Toggle issue enforcement
```

```bash
# Bash
./.agentx/agentx.sh ready
./.agentx/agentx.sh state engineer working 42
./.agentx/agentx.sh deps 42
./.agentx/agentx.sh hook start engineer 42
./.agentx/agentx.sh run engineer "Fix the failing tests"
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
              +--------------+--------------+
              |              |              |
         PM Agent     (PRD complete)        |
              |              |              |
    +---------+---------+    |              |
    |         |         |    |              |
 Architect  Data     UX     |              |
  Agent   Scientist Agent   |              |
    |         |         |    |              |
    +---------+---------+    |              |
              |              |              |
         Engineer Agent      |              |
              |              |              |
         Reviewer Agent      |              |
              |              |              |
    +---------+---------+    |              |
    |                   |    |              |
  DevOps Agent    Tester Agent              |
    |                   |    |              |
    +---------+---------+    |              |
              |              |              |
    Engineer (bug fixes) <---+     Customer Coach
                                  (standalone)
```

**Standalone Agents** (outside SDLC pipeline):

```
  Agile Coach    Customer Coach    Power BI Analyst
     |               |                  |
  (Stories)       (Research)         (Reports)
```

**Invisible Sub-Agents** (spawned by parent agents):

```
  Agent X -------> GitHub Ops (GitHub backlog management)
  Agent X -------> ADO Ops (ADO backlog management)
  PM -------------> GitHub Ops (child issue creation)
  PM -------------> ADO Ops (work item creation)
  Reviewer ------> GitHub Ops (issue status/labels)
  Reviewer ------> ADO Ops (work item status)
  Reviewer ------> Functional Reviewer (branch diff analysis)
  Reviewer ------> Eval Specialist (AI model quality review)
  Tester --------> GitHub Ops (defect issue creation)
  Tester --------> ADO Ops (defect work item creation)
  Data Scientist -> Prompt Engineer (prompt lifecycle)
  Data Scientist -> Eval Specialist (evaluation pipelines)
  Data Scientist -> Ops Monitor (AgentOps + drift)
  Data Scientist -> RAG Specialist (retrieval pipelines)
  Engineer -------> Prompt Engineer (needs:ai prompt work)
  Engineer -------> RAG Specialist (needs:ai RAG implementation)
  DevOps ---------> Ops Monitor (deployment monitoring)
```

**Key Principles:**

1. **Centralized Coordination** - Agent X routes all work, validates prerequisites, handles errors
2. **Strict Role Separation** - Each agent produces one deliverable type (PRD, ADR, Code, Review)
3. **Universal Tool Access** - All agents have access to all tools for maximum flexibility
4. **Status-Driven** - GitHub Projects V2 Status field is the source of truth
5. **Pre-Handoff Validation** - Artifacts validated before status transitions
6. **Post-Review Validation** - DevOps and Tester validate in parallel after Reviewer approves
7. **Bug-Fix Feedback Loop** - Tester defects route back to Engineer for resolution

### Routing Logic

Agent X routes issues based on:
- **Issue type** (Epic, Feature, Story, Bug, Spike)
- **Status** (Backlog, In Progress, In Review, Ready, Done)
- **Labels** (needs:ux, needs:changes, etc.)
- **Prerequisites** (PRD exists, UX complete, Spec ready)

**Routing rules:**
```
Epic + Backlog -> Product Manager
Ready + needs:ux -> UX Designer (parallel with Architect, Data Scientist)
Ready + (no architecture) -> Architect (parallel with UX, Data Scientist)
Ready + type:data-science -> Data Scientist (parallel with Architect, UX)
Ready + (has architecture) -> Engineer
needs:iteration -> Engineer (extended iterative-loop workflow, max 20)
In Review -> Reviewer
Reviewer approved -> DevOps Engineer + Tester (parallel post-review validation)
Tester defects found -> Engineer (bug-fix feedback loop)
Bug + Backlog -> Engineer (skip PM/Architect)
Spike + Backlog -> Architect
type:devops + Backlog -> DevOps Engineer (skip PM/Architect for infrastructure work)
type:data-science + Backlog -> Data Scientist (skip PM/Architect for ML/AI work)
type:testing + Backlog -> Tester (skip PM/Architect for testing/certification work)
type:powerbi + Backlog -> Power BI Analyst (skip PM/Architect for report/dashboard work)
In Review + needs:testing -> Tester (pre-release certification)
```

**Autonomous Mode**: For simple tasks (bugs, docs, stories 3 files), Agent X can automatically route to Engineer, skipping manual coordination. See [Agent X](.github/agents/agent-x.agent.md) (mode: adaptive).

**Universal Iterative Refinement**: ALL workflows include `iterate = true` on the Engineer's implementation step by default. Loop state is auto-initialized when the workflow runs, and the Engineer ALWAYS works in iterations until completion criteria are met. The Reviewer ALWAYS verifies loop completion before approval. The `needs:iteration` label is reserved for **extended** iteration via `iterative-loop.toml` (max 20 iterations, dedicated planning step). See [Iterative Loop Skill](.github/skills/development/iterative-loop/SKILL.md).

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
- Data Scientist: ML pipeline design, evaluation plan, model card present
- Engineer: Code committed, tests 80% coverage, docs updated
- Reviewer: Review document complete, approval decision present
- DevOps: CI/CD pipelines validated, deployment docs present
- Tester: Test suites pass, certification report complete
- Power BI Analyst: Semantic model validated, DAX measures tested, report spec documented

---

## Runtime Implementation Reference

Maps core AgentX concepts to their implementation. v8.0.0 uses a **declarative architecture**:
agents, skills, and instructions are defined in markdown files; Copilot's native agentic loop
executes them. The VS Code extension provides sidebar views and CLI command wrappers only.

### Declarative Layer (Source of Truth)

| Concept | Location | Purpose |
|---------|----------|---------|
| Agent Definitions | `.github/agents/*.agent.md` + `.github/agents/internal/*.agent.md` | 20 agents (15 visible + 5 internal sub-agents) with YAML frontmatter (name, description, model, handoffs, tools, agents) + body text instructions |
| Skills | `.github/skills/*/SKILL.md` | 63 domain skills loaded on demand |
| Instructions | `.github/instructions/*.instructions.md` | 7 instruction files auto-applied via `applyTo:` patterns |
| Prompts | `.github/prompts/*.prompt.md` | 11 reusable prompt templates |
| Templates | `.github/templates/*.md` | PRD, ADR, Spec, UX, Review, Security Plan, Progress templates |

### Agent Orchestration

| Mode | How It Works | Platform |
|------|-------------|----------|
| **Mode 1: Agent X Hub** | Agent X body text + `runSubagent` calls route work through PM -> [Architect, UX, Data Scientist] -> Engineer -> Reviewer -> [DevOps, Tester] | VS Code, Claude Code |
| **Mode 2: Human-Orchestrated** | User picks agent from Copilot agent picker; `handoffs:` frontmatter renders "Hand off to X" buttons | VS Code |
| **CLI Standalone** | `agentx.ps1 run <agent> <task>` runs agent via GitHub Models API; no sub-agent chaining | CLI |

### Agent-to-Agent Communication

Agents use Copilot's built-in `runSubagent` tool. Body text instructs: read artifacts first,
spawn target agent with full context, max 3 follow-up exchanges, escalate to user if unresolved.
Scope is controlled by `agents:` frontmatter (which agents can be spawned).

### Self-Review Loop

Body text in every agent instructs: "Before handoff, spawn a same-role reviewer sub-agent."
Reviewer produces structured findings ([HIGH], [MEDIUM], [LOW]). Agent addresses HIGH/MEDIUM
findings, then re-runs. Copilot executes this natively via `runSubagent`.

### Handoff & Status Transitions

| Component | Location | Purpose |
|-----------|----------|---------|
| Handoff Buttons | Agent frontmatter `handoffs:` | Renders "Hand off to X" in VS Code Copilot |
| Quality Loop Gate | `.agentx/agentx.ps1 loop` | CLI blocks handoff if loop not complete (exit 1) |
| Handoff Validator | `.github/scripts/validate-handoff.sh` | Pre-handoff artifact validation (PRD, ADR, code, tests) |
| Agent State | `.agentx/agentx.ps1 state` | Read/write agent state for issue tracking |

### Memory & Cross-Session Context

| Component | Location | Purpose |
|-----------|----------|---------|
| Memory Protocol | `.github/instructions/memory.instructions.md` | Instructs Copilot to read/write `/memories/*.md` files |
| Conventions | `.github/instructions/project-conventions.instructions.md` | Auto-applied patterns and pitfalls from prior sessions |
| Session Memory | `/memories/session/` | Temporary in-progress notes for current conversation |
| Persistent Memory | `/memories/*.md` | Cross-session decisions, pitfalls, conventions |

### VS Code Extension (Thin Shell)

23 TypeScript source files providing sidebar views and CLI command wrappers only.
All agent logic lives in declarative `.agent.md` files, not TypeScript.

| Component | File | Purpose |
|-----------|------|---------|
| Extension Entry | `vscode-extension/src/extension.ts` | Activation, command registration, sidebar setup |
| Context Provider | `vscode-extension/src/agentxContext.ts` | AgentX initialisation state for UI |
| Agent Tree View | `vscode-extension/src/views/agentTreeProvider.ts` | Sidebar: lists agents from `.agent.md` frontmatter |
| Template Tree View | `vscode-extension/src/views/templateTreeProvider.ts` | Sidebar: lists templates |
| Workflow Tree View | `vscode-extension/src/views/workflowTreeProvider.ts` | Sidebar: lists agent handoff chains |
| Agent Context Loader | `vscode-extension/src/chat/agentContextLoader.ts` | Loads agent definitions for Copilot Chat |
| CLI Command Wrappers | `vscode-extension/src/commands/*.ts` | VS Code commands that invoke `.agentx/agentx.ps1` |

### CLI Utilities

| Script | Purpose |
|--------|---------|
| `.agentx/agentx.ps1` | Main CLI: ready, state, deps, digest, workflow, loop, hook, config, issue, version |
| `.agentx/agentx.sh` | Bash wrapper for Linux/Mac |
| `.agentx/agentic-runner.ps1` | Standalone agentic loop via GitHub Models API (no sub-agent chaining) |
| `.agentx/local-issue-manager.ps1` | Local mode issue CRUD |

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
| `type:data-science` | Data Scientist | ML Pipelines + Evals + Model Cards |
| `type:testing` | Tester | Test Suites + Certification Reports |
| `type:powerbi` | Power BI Analyst | Reports + Semantic Models + DAX Measures |

**Decision Tree:**
- Broken? -> `type:bug`
- Research? -> `type:spike`
- Docs only? -> `type:docs`
- Pipeline/deployment/release? -> `type:devops`
- ML/AI model, drift, eval, RAG, fine-tuning? -> `type:data-science`
- Testing, certification, quality gates, pre-release? -> `type:testing`
- Power BI report, dashboard, DAX, semantic model? -> `type:powerbi`
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
- **Validation**: `.agentx/agentx.ps1 validate {issue} engineer`
- **Constraints**:
 - [PASS] CAN implement code, write tests, update documentation
 - [PASS] MUST start a quality loop (`agentx loop start`) after first implementation commit
 - [PASS] MUST run full test suite in EVERY loop iteration
 - [PASS] MUST iterate until: all tests pass, coverage >=80%, lint clean, self-review done
 - [FAIL] CANNOT move to In Review while loop is active OR cancelled (CLI hard-blocks with exit 1)
 - [FAIL] CANNOT skip the quality loop -- loop MUST reach status=complete; cancelling does not bypass the gate
 - [FAIL] CANNOT modify PRD/ADR/UX docs, skip tests, or merge without review
- **Boundaries**:
 - Can modify: `src/**`, `tests/**`, `docs/README.md`
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `docs/ux/**`, `.github/workflows/**`

### Code Reviewer
- **Maturity**: Stable
- **Trigger**: Status = `In Review`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Validating` when approved (or back to `In Progress` if changes needed)
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
- **Trigger**: `type:devops`, Status = `Validating` (post-review validation), or Status = `Ready` (for pipeline/deployment work)
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

### Data Scientist
- **Maturity**: Stable
- **Trigger**: `type:data-science` label, or ML/AI optimization tasks
- **Output**: ML pipelines, evaluation reports, model cards at `docs/data-science/`
- **Status**: Move to `In Progress` when starting -> `In Review` when implementation complete
- **Tools**: All tools available (execute, read, edit, search, web, AI Toolkit, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} data-scientist`
- **Constraints**:
 - [PASS] CAN design ML pipelines, fine-tune models, build RAG systems, create evaluations
 - [PASS] CAN implement drift monitoring, feedback loops, context management
 - [FAIL] CANNOT deploy model changes without evaluation gate approval
 - [FAIL] CANNOT fabricate metrics, benchmarks, or evaluation results
 - [FAIL] CANNOT modify PRD/ADR/UX docs or CI/CD pipelines
- **Boundaries**:
 - Can modify: `src/**` (ML/AI code), `tests/**`, `docs/data-science/**`, `prompts/**`, `notebooks/**`
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `docs/ux/**`, `.github/workflows/**`

### Tester
- **Maturity**: Stable
- **Trigger**: `type:testing` label, Status = `In Review` + `needs:testing`, or pre-release certification
- **Output**: Test suites at `tests/**`, `e2e/**`; certification reports at `docs/testing/`
- **Status**: Move to `In Progress` when starting -> `In Review` when test suite complete
- **Tools**: All tools available (run_in_terminal, read_file, create_file, get_errors, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} tester`
- **Constraints**:
 - [PASS] CAN write and execute unit, integration, e2e, performance, and security tests
 - [PASS] CAN create production readiness certification reports
 - [PASS] CAN configure test automation pipelines and CI gates
 - [PASS] MUST achieve >= 80% code coverage, 100% unit/integration pass, >= 95% e2e pass
 - [FAIL] CANNOT modify application source code (report defects to Engineer)
 - [FAIL] CANNOT approve releases (provides certification report for go/no-go decision)
 - [FAIL] CANNOT skip security testing or accessibility validation
- **Boundaries**:
 - Can modify: `tests/**`, `e2e/**`, `docs/testing/**`, `scripts/test/**`, `.github/workflows/*test*`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

### Power BI Analyst
- **Maturity**: Stable
- **Trigger**: `type:powerbi` label, or Power BI report/dashboard tasks
- **Output**: Reports at `reports/**`, semantic models at `datasets/**`, docs at `docs/powerbi/`
- **Status**: Move to `In Progress` when starting -> `In Review` when report complete
- **Tools**: All tools available (create_file, read_file, semantic_search, run_in_terminal, etc.)
- **Validation**: `.github/scripts/validate-handoff.sh {issue} powerbi-analyst`
- **Constraints**:
 - [PASS] CAN design star schema models, author DAX measures, build Power Query transformations, create reports
 - [PASS] CAN configure row-level security and performance optimization
 - [FAIL] CANNOT modify application source code, PRD, ADR, UX docs, or CI/CD pipelines
 - [FAIL] CANNOT embed credentials in reports or connection strings
 - [FAIL] CANNOT use copyrighted third-party visuals without verified license
- **Boundaries**:
 - Can modify: `reports/**`, `datasets/**`, `docs/powerbi/**`, `scripts/powerbi/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`, `.github/workflows/**`

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

### GitHub Ops (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Agent X, Product Manager, Reviewer, or Tester via `runSubagent` for GitHub issue/PR management
- **Output**: Triage reports, sprint plans, execution logs at `.copilot-tracking/github-issues/`
- **Status**: Invisible sub-agent (not user-invokable, spawned by parent agents)
- **Tools**: All tools available + `mcp_github_*` for GitHub API
- **Constraints**:
 - [PASS] CAN triage, discover, plan sprints, execute work items, manage labels and status
 - [PASS] CAN persist state to `.copilot-tracking/` for resumable workflows
 - [PASS] MUST sanitize content before GitHub API calls (strip internal tracking paths)
 - [PASS] MUST respect autonomy level (Full/Partial/Manual) for mutations
 - [FAIL] CANNOT modify source code, PRD, ADR, UX, or architecture documents
 - [FAIL] CANNOT create issues without duplicate checking
- **Boundaries**:
 - Can modify: GitHub Issues/PRs/Projects, `.copilot-tracking/github-issues/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

### ADO Ops (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Agent X, Product Manager, Reviewer, or Tester via `runSubagent` for ADO work item management
- **Output**: Triage reports, sprint plans, PRD decompositions at `.copilot-tracking/ado-items/`
- **Status**: Invisible sub-agent (not user-invokable, spawned by parent agents)
- **Tools**: All tools available for ADO API interaction
- **Constraints**:
 - [PASS] CAN triage, discover, plan sprints, decompose PRDs, execute work items
 - [PASS] CAN adapt to ADO process templates (Agile, Scrum, CMMI, Basic)
 - [PASS] MUST sanitize content before ADO API calls
 - [PASS] MUST respect autonomy level (Full/Partial/Manual) for mutations
 - [FAIL] CANNOT modify source code, PRD, ADR, UX, or architecture documents
 - [FAIL] CANNOT create work items without duplicate checking
- **Boundaries**:
 - Can modify: ADO Work Items/Boards/Queries, `.copilot-tracking/ado-items/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

### Functional Reviewer (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Code Reviewer via `runSubagent` during review phase
- **Output**: Severity-ordered findings report at `.copilot-tracking/reviews/`
- **Status**: Invisible sub-agent (not user-invokable, not routed by Agent X)
- **Tools**: Read-only tools (codebase, search, changes, problems)
- **Constraints**:
 - [PASS] CAN analyze branch diffs for logic, edge cases, error handling, concurrency, contract issues
 - [PASS] MUST apply false positive mitigation (6 filters) before reporting any finding
 - [PASS] MUST provide evidence of harm for every finding
 - [FAIL] CANNOT modify source code or tests
 - [FAIL] CANNOT flag style/formatting issues (linter territory)
 - [FAIL] CANNOT report findings outside the scope of changed files
- **Boundaries**:
 - Can modify: `.copilot-tracking/reviews/**`
 - Cannot modify: `src/**`, `tests/**`, `docs/**`

### Prompt Engineer (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Data Scientist or Engineer via `runSubagent` for prompt lifecycle tasks
- **Output**: Prompt files at `prompts/`, evaluation results at `.copilot-tracking/prompt-eval/`
- **Status**: Invisible sub-agent (not user-invokable, not routed by Agent X)
- **Tools**: codebase, editFiles, search, runCommands, fetch, think
- **Constraints**:
 - [PASS] CAN design, evaluate, test, iterate, and version prompts
 - [PASS] MUST test prompts across at least 2 models (primary + fallback)
 - [PASS] MUST use structured scoring rubrics for evaluation
 - [PASS] MUST store all prompts as separate files in `prompts/`
 - [FAIL] CANNOT modify application source code
 - [FAIL] CANNOT deploy prompts without passing quality gates
 - [FAIL] CANNOT fabricate evaluation scores
- **Boundaries**:
 - Can modify: `prompts/**`, `.copilot-tracking/prompt-eval/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `.github/workflows/**`

### Eval Specialist (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Data Scientist or Reviewer via `runSubagent` for evaluation pipelines
- **Output**: Evaluation reports at `.copilot-tracking/eval-reports/`, docs at `docs/data-science/EVAL-*.md`
- **Status**: Invisible sub-agent (not user-invokable, not routed by Agent X)
- **Tools**: codebase, editFiles, search, runCommands, fetch, think
- **Constraints**:
 - [PASS] CAN design LLM-as-judge rubrics, build test datasets, run benchmarks, compare models
 - [PASS] MUST use a different model for judge than the model under test
 - [PASS] MUST validate judge against known-answer set (agreement > 0.6)
 - [PASS] MUST define quality gates with actionable thresholds
 - [FAIL] CANNOT fabricate metrics, benchmarks, or evaluation results
 - [FAIL] CANNOT approve model deployment without all quality gates passing
 - [FAIL] CANNOT modify application source code
- **Boundaries**:
 - Can modify: `.copilot-tracking/eval-reports/**`, `docs/data-science/EVAL-*.md`, `tests/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `.github/workflows/**`

### Ops Monitor (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Data Scientist or DevOps via `runSubagent` for production AI monitoring
- **Output**: Monitoring config at `.copilot-tracking/ops-monitor/`, docs at `docs/data-science/DRIFT-*.md`, `docs/data-science/AGENTOPS-*.md`
- **Status**: Invisible sub-agent (not user-invokable, not routed by Agent X)
- **Tools**: codebase, editFiles, search, runCommands, fetch, think
- **Constraints**:
 - [PASS] CAN setup OpenTelemetry tracing, configure drift detection, track cost/latency, define alerts
 - [PASS] MUST establish baselines before configuring drift alerts
 - [PASS] MUST define drift thresholds with statistical backing
 - [PASS] MUST monitor both model drift and data drift
 - [FAIL] CANNOT fabricate monitoring data or drift signals
 - [FAIL] CANNOT disable alerting without documenting the reason
- **Boundaries**:
 - Can modify: `.copilot-tracking/ops-monitor/**`, `docs/data-science/DRIFT-*.md`, `docs/data-science/AGENTOPS-*.md`, `src/**` (tracing code only)
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `.github/workflows/**`

### RAG Specialist (Preview)
- **Maturity**: Preview
- **Trigger**: Spawned by Data Scientist or Engineer via `runSubagent` for RAG pipeline tasks
- **Output**: Pipeline config at `.copilot-tracking/rag-pipeline/`, docs at `docs/data-science/RAG-*.md`
- **Status**: Invisible sub-agent (not user-invokable, not routed by Agent X)
- **Tools**: codebase, editFiles, search, runCommands, fetch, think
- **Constraints**:
 - [PASS] CAN design chunking strategies, select embeddings, configure retrieval, implement reranking
 - [PASS] MUST analyze corpus characteristics before design decisions
 - [PASS] MUST implement hybrid search as default retrieval approach
 - [PASS] MUST evaluate retrieval quality with RAGAS metrics
 - [FAIL] CANNOT hardcode embedding model choices without comparison testing
 - [FAIL] CANNOT skip retrieval quality evaluation
- **Boundaries**:
 - Can modify: `.copilot-tracking/rag-pipeline/**`, `docs/data-science/RAG-*.md`, `src/**`, `tests/**`
 - Cannot modify: `docs/prd/**`, `docs/adr/**`, `.github/workflows/**`

### Agile Coach (Preview)
- **Maturity**: Preview
- **Trigger**: Story creation, refinement, or decomposition requests
- **Output**: Copy-paste ready stories at `docs/coaching/`
- **Status**: Standalone agent (not part of core SDLC pipeline)
- **Tools**: Read-only tools + editFiles for coaching docs
- **Constraints**:
 - [PASS] CAN guide conversational story elicitation (one question at a time)
 - [PASS] CAN evaluate stories against INVEST criteria
 - [PASS] CAN decompose large stories into smaller ones
 - [PASS] MUST produce stories with Given-When-Then acceptance criteria
 - [FAIL] CANNOT write code or create technical specifications
 - [FAIL] CANNOT create GitHub issues or ADO work items directly
- **Boundaries**:
 - Can modify: `docs/coaching/**`
 - Cannot modify: `src/**`, `docs/prd/**`, `docs/adr/**`, `docs/ux/**`

---

## Handoff Flow

```
PM -> [Architect, Data Scientist, UX] (parallel) -> Engineer -> Reviewer -> [DevOps, Tester] (parallel) -> Engineer (bug fixes)
```

**Parallel Design Phase**: Architect, Data Scientist, and UX Designer work simultaneously after PM completes PRD.
**Parallel Validation Phase**: DevOps Engineer and Tester validate in parallel after Reviewer approves.
**Bug-Fix Feedback Loop**: Tester defects route back to Engineer for resolution before closing.

> **Note**: Customer Coach, Power BI Analyst, and Agile Coach operate **standalone** (not part of the core SDLC pipeline). Customer Coach handles consulting research. Power BI Analyst handles reporting/BI work. Agile Coach helps create and refine user stories. GitHub Ops, ADO Ops, Functional Reviewer, Prompt Engineer, Eval Specialist, Ops Monitor, and RAG Specialist are invisible sub-agents spawned by their parent agents.

### Backlog-Based Handoffs

Agents query the backlog for the next priority item instead of receiving explicit issue numbers.

| Agent | Picks Up |
|-------|----------|
| **UX Designer** | Status=`Ready` + `needs:ux`, sorted by priority |
| **Architect** | Status=`Ready` + PRD complete, sorted by priority |
| **Engineer** | Status=`Ready` + ADR/Spec complete, sorted by priority |
| **Reviewer** | Status=`In Review`, sorted by priority |
| **DevOps** | `type:devops` + Status=`Ready`, sorted by priority |
| **Data Scientist** | `type:data-science` + Status=`Ready`, sorted by priority |
| **Tester** | `type:testing` + Status=`Ready` or `In Review` + `needs:testing`, sorted by priority |
| **Power BI Analyst** | `type:powerbi` + Status=`Ready`, sorted by priority |

**Priority Order**: `priority:p0` > `priority:p1` > `priority:p2` > `priority:p3` > (no label)

If no matching issues found, agent reports "No [role] work pending."

### Context Management

Clear context before implementation phase (UX/Architect/Data Scientist -> Engineer) to prevent design assumptions from leaking into code. Use `/clear` in Copilot Chat or start a new session.

| Transition | Clear? | Reason |
|------------|--------|--------|
| PM -> UX/Architect/Data Scientist | No | Needs PRD context |
| UX/Architect/Data Scientist -> Engineer | **Yes** | Engineer follows spec only |
| Engineer -> Reviewer | No | Reviewer needs full context |
| Reviewer -> DevOps/Tester | No | Needs review context |
| Tester -> Engineer (bug fixes) | No | Needs defect details |
| Reviewer -> Engineer (rework) | No | Needs review feedback |

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | -> `Ready` | Ready for design/architecture |
| UX completes designs | -> `Ready` | Ready for implementation |
| Architect completes spec | -> `Ready` | Ready for implementation |
| Data Scientist completes ML design | -> `Ready` | Ready for implementation |
| Engineer starts work | -> `In Progress` | Active development |
| Engineer completes code | -> `In Review` | Ready for code review |
| Reviewer approves | -> `Validating` | Ready for post-review validation |
| DevOps + Tester validate | -> `Done` + Close | Work complete (or back to Engineer for bug fixes) |

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Validating` | Post-review validation by DevOps + Tester |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Spec | `.github/templates/SPEC-TEMPLATE.md` |
| UX | `.github/templates/UX-TEMPLATE.md` |
| Review | `.github/templates/REVIEW-TEMPLATE.md` |
| Security Plan | `.github/templates/SECURITY-PLAN-TEMPLATE.md` |
| Progress Log | `.github/templates/PROGRESS-TEMPLATE.md` |

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
| Agent Definitions | `.github/agents/` + `.github/agents/internal/` |
| Templates | `.github/templates/` |
| Skills | `.github/skills/` |
| Instructions | `.github/instructions/` |
| Agent State | `.agentx/state/` |
| Issue Digests | `.agentx/digests/` |
| CLI Utilities | `.agentx/agentx.ps1`, `.agentx/agentx.sh` |
| CLI Agentic Runner | `.agentx/agentic-runner.ps1` |
| Shared Modules | `scripts/modules/` |
| Packs | `packs/` |
| Agent Delegation | `.github/agent-delegation.md` |
| Memory Files | `/memories/*.md` |
| Claude Code Commands | `.claude/commands/*.md` |

### New Features (v8.0.0) -- Declarative Migration

| Feature | Description | Status |
|---------|------------|--------|
| **Declarative Architecture** | 108-file TS runtime replaced with 23-file thin shell + declarative `.agent.md` files | [PASS] Stable |
| **Copilot-Native Agents** | 20 agents use standard frontmatter (description, model, handoffs, tools, agents) | [PASS] Stable |
| **Body Text Instructions** | Clarification protocol + quality loop embedded in agent body text | [PASS] Stable |
| **Memory Instructions** | `.github/instructions/memory.instructions.md` for cross-session facts | [PASS] Stable |
| **Project Conventions** | `.github/instructions/project-conventions.instructions.md` auto-applied | [PASS] Stable |
| **Frontmatter Handoffs** | `handoffs:` in agent YAML drives workflow routing and "Hand off to X" buttons | [PASS] Stable |
| **CLI Frontmatter Workflow** | `agentx.ps1 workflow` reads `.agent.md` handoffs (replaced TOML) | [PASS] Stable |
| **Claude Code Commands** | 12 `.claude/commands/*.md` stubs with context-first rule and quality loop | [PASS] Stable |
| **63 Skills** | Skills index across 10 categories | [PASS] Stable |

### Previous Versions

<details>
<summary>Click to expand v2.1-v7.3 features</summary>

**v7.0-v7.3**: Self-Review Loop, Clarification Loop, Sub-Agent Spawner, Streaming Visibility, Settings Sidebar, Agentic Loop for Copilot Chat, CLI Agentic Runner, Model Fallback Selector, Databricks Skill, Typed Event Bus, Context Compaction

**v6.0-v6.1**: Critical Pre-Check Auto-Install, PowerShell Shell Fallback, Copilot Extension Awareness, Channel Abstraction, Cron Task Scheduler

**v5.3**: Customer Coach Agent, UX Methodology Instructions, Release Automation, Copilot Coding Agent Setup, Shared PowerShell Modules, Agent Delegation Protocol, Pack Bundle System

**v5.0-v5.2**: Executable Scripts (30 across 17 skills), Playwright E2E Scaffold, Cognitive Architecture, TypeScript Instructions, 5-Minute Quickstart, agentskills.io Compliance

**v4.0**: Declarative Workflows (TOML templates -- replaced by frontmatter handoffs in v8.0.0), Smart Ready Queue, Agent State Tracking, Dependency Management, Issue Digests

**v3.0**: Agent Analytics, Auto-Fix Reviewer (Preview), Prompt Engineering Skill, Local Mode, Cross-Repo Orchestration, DevOps Agent

**v2.1**: Maturity Levels, Constraint-Based Design, Handoff Buttons, Template Input Variables, Context Clearing, Agent X Adaptive Mode

</details>

### Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`, `type:data-science`, `type:testing`, `type:powerbi`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`, `needs:iteration` (extended loop, max 20), `needs:testing` (pre-release certification)

---

**See Also**: [Skills.md](Skills.md) for production code standards and workflow scenarios | [Guide](docs/GUIDE.md) for quickstart, setup, and troubleshooting
