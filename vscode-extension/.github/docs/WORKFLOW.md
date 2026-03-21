# AI Agent Workflow Reference

> **Complete workflow, routing, handoff, and status management for AgentX agents.**
> This file is the deep reference for how work flows through the system.
> For a quick map of all resources, see [AGENTS.md](../AGENTS.md).

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Assess Complexity** (simple vs. complex / multi-phase)
5. **Create Execution Plan** for complex work before implementation or long-running loops
6. **Execute** role-specific work
7. **Update Status** in GitHub Projects V2 (or local file in Local Mode)

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
git commit -m "feat: add health endpoint (refs #42)"
# Final delivery should use a closing keyword in the PR body or merge commit:
# fix: add health endpoint (fixes #42)
# If no closing keyword was used, close the issue manually:
gh issue close 42 --reason completed
```

**Closeout rule:** Plain issue references like `(#42)` or `refs #42` do not close GitHub issues. The final PR or delivery commit MUST use `fixes #42`, `closes #42`, or `resolves #42`, or the issue must be closed manually as an explicit release step.

**Local Mode:**
```powershell
# Issues are optional in local mode - you can commit without issue references
git commit -m "feat: add user login"

# Or use full issue workflow if preferred:
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Bug] Fix timeout" -Labels "type:bug"
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
git commit -m "fix: resolve login timeout (#1)"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1

# Enable issue enforcement in local mode:
.\.agentx\agentx.ps1 config set enforceIssues true
```

**Emergency bypass (GitHub mode)**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward.

> **Status Tracking**: Use GitHub Projects V2 **Status** field (GitHub mode) or local JSON status (Local mode).
> See [GUIDE.md](GUIDE.md#local-mode-no-github) for local mode details.

> **GitHub reroute trigger**: GitHub does not emit a normal workflow event when a Project V2 Status field changes. After moving an issue to a new Status value in GitHub mode, add the issue comment `/agentx route` to rerun the router against the latest board state.

> **Automatic GitHub reroute**: When `.agentx/config.json` includes a GitHub project number, the scheduled `Agent X Project Reroute Poller` workflow scans recent Project V2 item changes and redispatches `agent-x.yml`. The comment trigger remains the immediate fallback between scheduled scans.

### Execution Plans For Complex Work

For simple work, the standard issue-first flow is sufficient. For complex work, the issue-first flow is necessary but not sufficient.

**Complex work** includes any task with one or more of the following characteristics:

- Multi-phase implementation or investigation
- Multiple subsystems, agents, or deliverables touched in one effort
- Significant ambiguity or meaningful design decisions to record
- Expected duration beyond a short interactive session
- Work that must be resumable by a different agent or after context loss

When a task is complex, agents **MUST** create and maintain an execution plan using [.github/templates/EXEC-PLAN-TEMPLATE.md](../agentx/templates/EXEC-PLAN-TEMPLATE.md) before starting implementation.

Canonical locations:
- Execution plans live under `docs/execution/plans/`
- Progress logs live under `docs/execution/progress/`
- Legacy `docs/plans/` and `docs/progress/` paths are redirect-only shims during migration

**Current enforcement state:** This is a workflow policy today. Mechanical enforcement is partial until the quality gates and automation are extended to check plan presence, freshness, and evidence links.

**Execution plan requirements:**

- Plans are living documents, not one-time approvals
- Plans must record progress, decisions, blockers, validation steps, and recovery guidance
- Plans must be detailed enough that a new agent can resume from the plan and current repo state alone
- Plans must be updated at meaningful stopping points, not only at the end of work

**Why this exists:** Harness-oriented workflows depend on durable, repo-local state. If a complex task cannot be resumed from artifacts in the repository, it is not yet legible enough for reliable agent execution.

### Workflow Checkpoint Contract

AgentX also uses a deterministic checkpoint overlay so docs, chat, commands, sidebars, and CLI surfaces can describe the same operating loop without introducing a second workflow state machine.

Checkpoint names are canonical and MUST be reused verbatim:

- `Brainstorm`
- `Plan`
- `Work`
- `Review`
- `Compound Capture`
- `Done`

These checkpoints layer on top of the existing issue statuses (`Backlog`, `Ready`, `In Progress`, `In Review`, `Validating`, `Done`) and do not replace them. Status remains the routing and backlog source of truth. Checkpoints describe the current operating stage within that status model.

#### Deterministic Resolution Rules

The current checkpoint is resolved from durable evidence, not chat history or model judgment.

| Checkpoint | When AgentX Resolves It | Required Evidence | Closeout Expectation | Typical Next Move |
|------------|-------------------------|-------------------|----------------------|-------------------|
| `Brainstorm` | No active issue or harness thread is linked yet | Open workspace plus missing scoped issue context | Frame the work before durable planning starts | Use brainstorm guidance to tighten scope |
| `Plan` | Scope exists, but no durable execution plan is linked yet | Active issue or harness thread, but no execution plan/progress pair | Attach or refine the plan before implementation spreads across surfaces | Use `Deepen Plan` |
| `Work` | A durable plan exists and review evidence does not yet exist | Execution plan, optionally progress log, active issue context | Produce validation-ready work without outrunning the plan | Continue implementation and validation |
| `Review` | Review evidence exists, or the quality loop is complete and review is the next bounded checkpoint | Review artifact, durable finding, `In Review` status, or completed quality loop | Settle correctness and risk before closure | Use `Kick Off Review` or resume review |
| `Compound Capture` | The issue is effectively closed for delivery, but reusable learning capture is still unresolved | Closed issue plus review evidence, but no curated learning capture | Preserve reusable learning or record an explicit closeout rationale | Create learning capture or document why none is needed |
| `Done` | Delivery and compound closeout are both complete | Closed issue, review evidence, and durable compound-closeout evidence | No further lifecycle action is required | Review rollout posture or move to the next slice |

#### Checkpoint Definitions

| Checkpoint | Intent | Entry Criteria | Exit Criteria | Dependencies And Artifacts |
|------------|--------|----------------|---------------|----------------------------|
| `Brainstorm` | Shape the problem before planning | Need is visible, but issue scope is not yet durable enough to plan | A concrete issue, thread, or bounded task exists | Brainstorm guidance, issue discovery, prior learnings when available |
| `Plan` | Turn scope into a durable execution path | Active issue or task context exists, but no linked plan anchors the work | Execution plan exists and can carry progress forward | Issue context, `docs/execution/plans/`, optional `docs/execution/progress/` |
| `Work` | Produce the change while keeping evidence current | Durable plan exists and the task is in active delivery | Validation evidence is strong enough to begin or resume review | Execution plan, progress log, loop state, implementation evidence |
| `Review` | Assess readiness, correctness, and follow-up work | Validation-ready output exists or review has already started | Review outcome is explicit: approved, changes requested, or follow-up captured | Review artifact, durable findings, `In Review` or `Validating` status |
| `Compound Capture` | Preserve reusable learning before final closure drifts | Delivery is closed or closing, but reusable outcome capture is unresolved | Curated learning capture exists or an explicit closeout rationale is recorded | `docs/artifacts/learnings/`, issue closeout comment, related ADR/spec/review links |
| `Done` | Mark the lifecycle complete with no remaining compound work | Review outcome and compound closeout are both settled | No further required lifecycle work remains | Closed issue, stable review outcome, durable capture or documented skip |

#### Transition Guardrails

| Transition | Required Before Transition | Blockers |
|------------|----------------------------|----------|
| `Brainstorm -> Plan` | The work is named and scoped to an issue, thread, or bounded task | Missing scope owner, unresolved problem statement |
| `Plan -> Work` | A durable execution plan exists and the main constraints are explicit | No plan, no progress anchor for complex work, pending clarification |
| `Work -> Review` | Validation evidence is ready and the quality loop is complete when applicable | Incomplete validation, unresolved clarification, no plan context for review |
| `Review -> Compound Capture` | Review outcome is explicit and any durable findings are captured | Review still in progress, unresolved findings, approval state unclear |
| `Compound Capture -> Done` | Curated learning exists or the closeout rationale is explicitly recorded in durable artifacts | Missing learning capture and no durable skip rationale |

#### Surface-Language Contract

The checkpoint names above are the shared vocabulary for:

- `docs/WORKFLOW.md` as the canonical lifecycle reference
- `docs/WORKFLOW.md` for post-review and compound guidance
- VS Code sidebars that render `Current checkpoint` and `Next step`
- VS Code commands such as `Workflow next step`, `Deepen Plan`, and `Kick Off Review`
- Chat responses that explain the current checkpoint and recommended action
- CLI or automation summaries that need to explain why a transition is or is not ready

Surfaces MAY add local rationale or blockers, but they MUST NOT rename the checkpoints or imply a transition succeeded when the required evidence is missing.

#### Current Runtime Note

The current extension resolver in `vscode-extension/src/utils/workflowGuidance.ts` treats curated learning capture as the durable machine-readable signal for leaving `Compound Capture`. An explicit human skip rationale is still a valid process closeout, but until it is represented in a durable artifact the resolver will remain conservative and keep the workflow at `Compound Capture` instead of inferring `Done`.

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
    Engineer (bug fixes) <---+     Consulting Research
                                  (standalone)
```

**Standalone Agents** (outside SDLC pipeline):

```
  Agile Coach    Consulting Research    Power BI Analyst
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

1. **Centralized Coordination** - Agent X is the top-level autonomous executor. It SHOULD complete work in one session whenever feasible and use specialist stages as internal workflow phases. Manual agent switching is a fallback for isolation or platform limitations.
2. **Role-Contract Preservation** - When Agent X executes a specialist phase internally, it MUST follow that specialist agent's constraints, boundaries, required templates, required skills, entry gates, exit gates, and deliverable rules. Internal execution is not permission to weaken the role contract.
3. **Strict Role Separation** - Each agent produces one deliverable type (PRD, ADR, Code, Review)
4. **Universal Tool Access** - All agents have access to all tools for maximum flexibility
5. **Status-Driven** - GitHub Projects V2 Status field is the source of truth
6. **Pre-Handoff Validation** - Artifacts validated before status transitions
7. **Post-Review Validation** - DevOps and Tester validate in parallel after Reviewer approves
8. **Bug-Fix Feedback Loop** - Tester defects route back to Engineer for resolution
9. **Two-Layer Architecture** - Skills (Markdown) encode domain knowledge; MCP servers handle tool execution. Skills are the orchestration layer; MCP is the plumbing. Every skill works standalone without MCP connections.

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

**Autonomous Mode**: For simple tasks (bugs, docs, stories <=3 files), Agent X can automatically route to Engineer, skipping manual coordination. When Agent X acts as Engineer internally, it is still required to follow the Engineer agent's own contract and gates. See [Agent X](../agentx/agents/agent-x.agent.md) (mode: adaptive).

**Universal Iterative Refinement**: ALL workflows include `iterate = true` on the Engineer's implementation step by default. The Reviewer ALWAYS verifies loop completion before approval. The `needs:iteration` label is reserved for **extended** iteration (max 20 iterations). See [Iterative Loop Skill](../agentx/skills/development/iterative-loop/SKILL.md).

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
- Architect: ADR + Tech Spec exist, NO CODE EXAMPLES compliance, PM requirement-fit validation captured
- Data Scientist: ML pipeline design, evaluation plan, model card present
- Engineer: Code committed, tests 80% coverage, docs updated, and required Architect/Data Scientist design alignment captured when the issue crosses those boundaries
- Reviewer: Review document complete, approval decision present
- DevOps: CI/CD pipelines validated, deployment docs present
- Tester: Test suites pass, certification report complete
- Power BI Analyst: Semantic model validated, DAX measures tested, report spec documented

**Harness-oriented validation additions:**
- Complex tasks: execution plan exists and is current
- Multi-phase work: progress log reflects actual current state
- Validation-heavy work: evidence artifacts or summaries are linked from the plan or progress log
- Architecture/runtime changes: docs and implementation claims do not materially drift

These checks are the target validation model. Where automation is not yet present, reviewers and role agents are expected to enforce them manually.

---

## Orchestration Modes

| Mode | How It Works | Platform |
|------|-------------|----------|
| **Mode 1: Agent X Autonomous** | Agent X classifies work and executes it end to end in one session, applying PM -> [Architect, UX, Data Scientist] -> Engineer -> Reviewer -> [DevOps, Tester] as internal phases when needed while preserving each specialist agent's own rules and gates | VS Code, Claude Code |
| **Mode 2: Human-Orchestrated** | User picks agent from Copilot agent picker; `handoffs:` frontmatter renders "Hand off to X" buttons | VS Code |
| **CLI Standalone** | `agentx.ps1 run <agent> <task>` runs agent via GitHub Models API; no sub-agent chaining | CLI |

### Agent-to-Agent Communication

Agent X SHOULD keep work in one session by applying specialist constraints internally.
When it does so, it MUST read and honor the active specialist agent definition instead of treating the phase as a lightweight approximation.
When strict role isolation or platform behavior requires it, agents MAY still communicate
through the user and ask for a manual switch to the relevant specialist.

### Self-Review Loop

Body text in every agent instructs: "Before handoff, re-check your work against the done criteria."
The agent evaluates with structured findings ([HIGH], [MEDIUM], [LOW]) and addresses HIGH/MEDIUM
findings before completing.

For complex tasks, self-review also checks that the execution plan and progress artifacts remain accurate. A technically correct change with stale plan state is not complete.

---

## Handoff Flow

```
Discover/Plan -> [Architect, Data Scientist, UX] -> Architect/PM fit check -> Engineer -> conditional Architect/Data Scientist alignment -> Reviewer -> [DevOps, Tester] -> Engineer (bug fixes if needed)
```

**Design Phase**: Architect, Data Scientist, and UX inputs are applied before implementation when complexity requires them.
**Architect Requirement-Fit Check**: Before architecture returns to `Ready`, Architect performs a lightweight review with PM to confirm the ADR and Tech Spec still satisfy PRD scope, business outcomes, and success metrics. PM validates requirement fit, not low-level technical correctness.
**Engineer Design Alignment Check**: Before implementation, Engineer consults Architect when the implementation crosses architecture boundaries or diverges from the ADR/Spec, and consults Data Scientist when `needs:ai` work changes model, eval, prompt, RAG, or ML contracts. These are conditional checkpoints, not mandatory approvals on every story.
**Parallel Validation Phase**: DevOps Engineer and Tester validate in parallel after Reviewer approves.
**Bug-Fix Feedback Loop**: Tester defects route back to Engineer for resolution before closing.

For Agent X autonomous execution, each phase above inherits the same non-skippable contract as the corresponding specialist agent. PM phase still requires PRD rules and PM boundaries, Architect phase still requires ADR/Spec and zero-code policy, UX phase still requires prototypes and accessibility rules, Engineer phase still requires the quality loop, and Reviewer phase still requires review artifacts and approval gates.

> **Note**: Consulting Research, Power BI Analyst, and Agile Coach operate **standalone** (not part of the core SDLC pipeline). GitHub Ops, ADO Ops, Functional Reviewer, Prompt Engineer, Eval Specialist, Ops Monitor, and RAG Specialist are invisible sub-agents spawned by their parent agents.

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

Clear context before implementation phase to prevent design assumptions from leaking into code.

| Transition | Clear? | Reason |
|------------|--------|--------|
| PM -> UX/Architect/Data Scientist | No | Needs PRD context |
| UX/Architect/Data Scientist -> Engineer | **Yes** | Engineer follows spec only |
| Engineer -> Reviewer | No | Reviewer needs full context |
| Reviewer -> DevOps/Tester | No | Needs review context |
| Tester -> Engineer (bug fixes) | No | Needs defect details |
| Reviewer -> Engineer (rework) | No | Needs review feedback |

### Cross-Role Validation Checkpoints

These checkpoints are intentionally lightweight. They exist to catch scope drift and boundary mistakes without turning every handoff into a full secondary approval loop.

In live AgentX execution, run these checkpoints through the existing clarification loop when specialist input is needed so the discussion stays visible to the user in chat and CLI output.

| Checkpoint | Trigger | Participants | Purpose | Output |
|------------|---------|--------------|---------|--------|
| Architect requirement-fit validation | ADR + Tech Spec drafted | Architect + PM | Confirm the proposed solution still satisfies PRD scope, business outcomes, and success metrics | Short validation note or clarification record |
| Engineer architecture alignment | Implementation crosses architecture boundaries, introduces a new pattern, or diverges from ADR/Spec | Engineer + Architect | Confirm the implementation approach still fits the selected architecture | Short validation note or clarification record |
| Engineer AI/ML alignment | `needs:ai` work changes model behavior, prompt flow, evals, RAG, or ML contracts | Engineer + Data Scientist | Confirm AI/ML contracts, eval hooks, and operating assumptions before coding | Short validation note or clarification record |

### Status Transitions

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

## Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`, `type:data-science`, `type:testing`, `type:powerbi`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`, `needs:iteration` (extended loop, max 20), `needs:testing` (pre-release certification)

---

**See Also**: [AGENTS.md](../AGENTS.md) (map) | [Skills.md](../Skills.md) (production code standards) 

---

# Agent Communication Protocol

> Shared clarification, escalation, and handoff guidance for AgentX roles.

## Shared Rules

All roles follow these rules before asking for more context:

1. Read the relevant repo artifacts first.
2. Post a blocker only after the missing context is still unresolved.
3. Do not guess missing requirements, architecture, or review intent.
4. Limit follow-up loops to 3 exchanges per topic.
5. Escalate unresolved ambiguity to the user when the loop is exhausted.

## Read Artifacts First

Before asking any agent or user for help, review the relevant repo-local artifacts:

- `docs/artifacts/prd/PRD-{issue}.md`
- `docs/artifacts/adr/ADR-{issue}.md`
- `docs/artifacts/specs/SPEC-{issue}.md`
- `docs/ux/UX-{issue}.md`

Only continue to a clarification step if the question remains unresolved after reviewing the available artifacts.

## Specialist Agent Mode

Use this mode for specialist agents such as Product Manager, Architect, UX Designer, Engineer, Reviewer, DevOps Engineer, Tester, Power BI Analyst, Data Scientist, and Consulting Research.

1. Read the artifacts first.
2. Ask the user for cross-agent help when another role must answer the question.
3. Reference only agents listed in the current agent's `agents:` frontmatter.
4. If the returned answer is incomplete, request a more specific follow-up from the same role.
5. After 3 unresolved exchanges, escalate the ambiguity directly to the user.

Suggested phrasing:

`I need input from <AgentName> on <specific question>. Please switch to the <AgentName> agent and ask: <question with context>.`

## AgentX Auto Mode

Use this mode only for AgentX Auto.

1. Read the artifacts first.
2. Continue in the same session using the relevant specialist lens and constraints.
3. Ask the user to switch agents only when the platform cannot preserve the required context or the user explicitly wants manual role isolation.
4. If the user response is incomplete, continue the clarification loop in the same session.
5. After 3 unresolved internal attempts, escalate the unresolved question directly to the user.

Suggested phrasing:

`I need clarification on <topic> before I can continue. The unresolved question is: <question>.`

## Related Workflow Docs

- See `docs/WORKFLOW.md#handoff-flow` for status transitions and handoff stages.
- See `docs/GUIDE.md#local-mode-no-github` for local issue-management behavior.

---

# Knowledge And Review Workflows

## Purpose

This guide defines the shared workflow contract for three related AgentX concerns:

- post-review knowledge capture
- agent-native review parity
- durable review findings and promotion

These concerns are intentionally documented together because they form one compound-engineering workflow: shape the work with prior learnings, evaluate parity, decide what should be preserved, and track durable follow-up work when review findings require it.

The canonical checkpoint names for this loop live in `docs/WORKFLOW.md`. This guide extends the `Review` and `Compound Capture` checkpoints and MUST reuse those names verbatim.

## Workflow Chain

1. Start with a brainstorm step when planning would benefit from prior learnings or known workflow constraints.
2. Finish implementation review and validation.
3. Run agent-native review to check action parity, context parity, and shared workspace expectations.
4. Resolve whether the outcome creates reusable knowledge that should be captured.
5. Persist durable review findings when follow-up work should survive beyond the current review cycle.
6. Promote important findings into the normal AgentX backlog instead of creating a parallel tracker.

## Agent-Native Review

### Review Lens

Agent-native review is architectural and workflow-focused. It does not score naming style, formatting taste, or subjective implementation preferences.

The review asks three questions:

1. Action parity: can agents reach the same high-value review-time actions that users can trigger?
2. Context parity: do agents and users operate on the same workspace, issue, plan, review, and state context?
3. Shared workspace expectations: do both paths resolve the same repo-local artifacts, guidance, and workflow contracts?

### Capability Map

| Capability | User Surface | Agent Surface | Shared Artifacts | Why It Matters |
|------------|--------------|---------------|------------------|----------------|
| Brainstorm with learnings | Command palette, Work sidebar | `@agentx brainstorm ...` | this guide, `docs/artifacts/learnings/` | Planning should start from reusable lessons instead of a cold start when prior knowledge exists |
| Workflow execution | Command palette, Work sidebar | `@agentx run ...` | issue, plan, workflow state | Review findings are weak if agents cannot trigger the same delivery flow |
| Review learnings retrieval | Command palette, Work sidebar | `@agentx learnings review ...` | `docs/artifacts/learnings/` | Review should reuse prior solutions without user-only lookup steps |
| Compound loop visibility | Command palette, Work and Quality sidebars | `@agentx compound` | this guide, `docs/artifacts/learnings/`, `docs/artifacts/reviews/findings/` | Operators and agents should inspect the same post-review capture and follow-up state |
| Knowledge capture guidance | Command palette, Work sidebar | `@agentx capture guidance` | this guide, `docs/artifacts/learnings/` | Reusable outcomes should be preserved consistently after review |
| Learning capture scaffold | Command palette, Work and Quality sidebars | `@agentx create learning capture` | `docs/artifacts/learnings/`, harness state | Capture should start from the active issue context instead of a blank file |
| Durable review findings | Command palette, Quality sidebar | `@agentx review findings` | this guide, `docs/artifacts/reviews/findings/` | Important review outcomes should remain visible across sessions |

### Scoring Rubric

#### Action Parity

- 100%: every mapped capability is available in both user and agent surfaces
- 50-99%: at least one mapped capability is missing from one side
- 0-49%: review-time actions are materially user-only or agent-only

#### Context Parity

- 100%: workspace root, pending clarification state, execution plan access, and state-file access are shared
- 50-99%: one shared context dependency is missing or indirect
- 0-49%: user and agent flows rely on different context models

#### Shared Workspace Expectations

- 100%: review guidance, templates, and review surfaces all point at the same repo-local contract
- 50-99%: one contract artifact or review surface is missing
- 0-49%: review output depends on disconnected or host-specific assumptions

### Severity Model

- High: a user-visible review capability is not reachable for agents, or vice versa
- Medium: the capability exists, but shared context or contract artifacts are missing
- Low: the parity path exists but is weakly documented or exposed in only one minor surface
- None: no parity gap detected

### Output Expectations

Agent-native review output should include:

- a capability map
- per-pillar scores for action parity, context parity, and shared workspace expectations
- concrete findings that point to architectural gaps
- an advisory-first recommendation, not an immediate hard gate

## Knowledge Capture

### Planning Entry Point

Use the brainstorm step before planning when the repo likely already contains reusable guidance.

Operator surfaces:

- Command palette: `AgentX: Show Brainstorm Guide`
- Work sidebar: `Brainstorm`
- Chat: `@agentx brainstorm <topic>`

The brainstorm output should pull forward the highest-signal planning learnings, restate the active issue context when available, and make the next narrowing step explicit before execution begins.

### Trigger Model

- Mandatory capture:
  Work produces reusable workflow, architecture, review, validation, or operator guidance that is likely to help future planning or review.
- Optional capture:
  Work is useful but narrow, local, or low-leverage, so a capture artifact is helpful but not required.
- Skip capture:
  Work is trivial, transient, duplicated by an existing learning, or too weakly validated to preserve as durable guidance.

### Operator-Facing Path

1. Finish review and validate the final outcome.
2. Resolve the capture decision as mandatory, optional, or skip.
3. Inspect the compound loop view when you need the combined picture of reusable learnings, promotable review findings, and capture readiness.
4. When capture is produced, store it under `docs/artifacts/learnings/LEARNING-<issue>.md`.
5. Prefer scaffolding capture from the active issue context through `AgentX: Create Learning Capture` or `@agentx create learning capture`.
6. Link the learning back to the originating issue and its supporting ADR, spec, review, or validation artifacts.
7. If capture is skipped, record a short rationale in the close-out summary or issue comment.

### Autonomous Execution Path

1. AgentX finishes the same review and validation steps it would require from an operator.
2. AgentX resolves the capture decision after review, not during initial implementation.
3. AgentX can surface the compound loop or scaffold a learning artifact from the active harness thread before writing a final capture.
4. When capture is required or accepted, AgentX creates the learning artifact and mentions it in the final summary.
5. The flow stays advisory-first until stronger automation and duplication checks are proven.

### Artifact Location

- Curated durable learnings: `docs/artifacts/learnings/LEARNING-<issue>.md`
- Durable review findings: `docs/artifacts/reviews/findings/FINDING-<issue>-<id>.md`
- Source documents remain in their original families, such as `docs/artifacts/adr/`, `docs/artifacts/specs/`, `docs/artifacts/reviews/`, and issue state

### Minimum Link-Back Requirements

Each curated learning should link back to:

- the originating issue
- the main supporting design or execution artifacts
- the review or validation artifact that makes the learning trustworthy

## Durable Review Findings

### Durable Record

Store durable review findings under `docs/artifacts/reviews/findings/FINDING-<issue>-<id>.md`.

Each durable finding record should capture:

- source review artifact
- source issue when known
- severity
- workflow status using the standard AgentX status set
- priority using `p0` through `p3`
- owner or suggested owner
- dependencies
- evidence links
- promotion classification
- linked backlog issue once promoted

### Status Contract

Durable findings reuse the normal AgentX workflow states so review follow-up does not create a second state machine.

| Status | Meaning |
|--------|---------|
| Backlog | Finding is captured and awaiting triage or promotion |
| Ready | Finding has been accepted as follow-up work and is ready to be picked up |
| In Progress | Follow-up implementation is underway |
| In Review | Follow-up change is under review |
| Done | Follow-up is resolved or explicitly closed |

### Promotion Contract

Each finding must declare one of these promotion modes:

- `review-only`: preserve the finding in the review record, but do not create a backlog item
- `recommended`: finding is important enough that maintainers should normally promote it
- `required`: finding should become tracked backlog work unless it is immediately resolved in the current review cycle

### Promote Versus Keep Review-Only

Promote the finding when one or more of these conditions are true:

- the finding affects correctness, security, resilience, or workflow safety
- the finding requires code or documentation work beyond the current review cycle
- the finding should be prioritized, assigned, or tracked across sessions
- the finding blocks parity, review quality, or repeatable operator behavior

Keep the finding review-only when one or more of these conditions are true:

- the note is informational and needs no tracked follow-up
- the issue is already fully covered by an existing backlog item
- the concern is too weakly evidenced to justify tracked work
- the fix is completed before the review closes

### Lifecycle Rules

1. Capture the durable finding record during review or immediately after review.
2. Use `Backlog` as the initial status for captured findings.
3. Promote only into the existing AgentX issue flow. Do not create a parallel tracker.
4. When promoted, link the created backlog issue number back into the finding record.
5. Let the promoted issue follow the normal AgentX workflow from `Backlog` to `Done`.
6. Keep dependencies and evidence links in the finding record even after promotion.

## Notes

- Local and GitHub-backed workflows should use the same artifact-based contract even when storage or status plumbing differs.
- Do not create a second backlog or sidecar tracker for learnings.
- Do not treat raw runtime observations as curated learnings by default.
- Prefer a small number of high-signal learning artifacts over a large volume of weak notes.
