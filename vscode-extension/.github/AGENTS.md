---
description: 'AI Agent Guidelines - map of all resources, quick-reference rules, and pointers to detailed docs.'
applyTo: '**'
---

# AI Agent Guidelines

> **Single source of truth for repository workflow guidance.**

> **Map to all AgentX resources.** For workflow details, see [docs/WORKFLOW.md](docs/WORKFLOW.md).
> For agent role definitions, see individual files in `.github/agents/`.

---

## Retrieval-Led Reasoning

**IMPORTANT**: Prefer retrieval-led reasoning over pre-training-led reasoning for ALL implementation tasks.
Always `read_file` the relevant SKILL.md, instruction file, or spec before generating code.
Do NOT rely on training data for project-specific patterns, conventions, or APIs.
If a skill, spec, or doc exists in the workspace, read it first; generate second.

---

## Quick Reference

### Issue-First Rule

Every piece of work SHOULD start with an issue. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for full flow.

```bash
# GitHub Mode
gh issue create --title "[Story] Add /health" --label "type:story"  # Creates #42
git commit -m "feat: add health endpoint (#42)"

# Local Mode (issues optional by default)
git commit -m "feat: add user login"
```

Toggle enforcement: `.agentx/agentx.ps1 config set enforceIssues true`

### Classification

| Type | Label | Route To |
|------|-------|----------|
| Broken? | `type:bug` | Engineer |
| Research? | `type:spike` | Architect |
| Docs only? | `type:docs` | Engineer |
| Pipeline/deploy? | `type:devops` | DevOps Engineer |
| ML/AI/eval? | `type:data-science` | Data Scientist |
| Testing/cert? | `type:testing` | Tester |
| Power BI? | `type:powerbi` | Power BI Analyst |
| Large/vague? | `type:epic` | Product Manager |
| Single capability? | `type:feature` | Architect |
| Otherwise | `type:story` | Engineer |

### Commit Format

```
type: description (#issue-number)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

For final delivery in GitHub mode, plain `(#123)` is traceability only. Use `fixes #123`, `closes #123`, or `resolves #123` in the final PR body or delivery commit so GitHub closes the issue automatically.

### Security Checklist

- [PASS] No hardcoded secrets
- [PASS] SQL parameterization (NEVER concatenate)
- [PASS] Input validation on all endpoints
- [PASS] Dependencies scanned
- Blocked commands: `rm -rf /`, `git reset --hard`, `drop database`

### Local Files First Rule

All agents MUST create deliverable files locally using `editFiles` -- MUST NOT use `mcp_github_create_or_update_file` or `mcp_github_push_files` to push files directly to GitHub. Users must be able to review files locally before committing.

### Quality Loop Hard Rule

> HARD RULE: Every agent MUST run `.agentx/agentx.ps1 loop start -p "<task description>"` as the ABSOLUTE FIRST action before any file edit or tool call. Minimum 3 iterations. Complete with `.agentx/agentx.ps1 loop complete -s "<summary>"`. No exceptions. The pre-commit hook blocks review artifacts when no completed loop exists.

### Compound Engineering Hard Rule

> HARD RULE: Every agent MUST resolve Compound Capture before declaring work Done. After delivery and review are complete, classify the capture decision:
> - **Mandatory**: Work produces reusable workflow, architecture, review, or operator guidance -> create `docs/artifacts/learnings/LEARNING-<issue>.md`
> - **Optional**: Narrow or low-leverage work -> capture is helpful but not required
> - **Skip**: Trivial, transient, or duplicated -> record skip rationale in the issue close comment
>
> Work is NOT Done until Compound Capture is resolved. The pre-commit hook validates LEARNING file structure when staged. See [docs/WORKFLOW.md](docs/WORKFLOW.md) for the full Compound Capture contract.

### Pipeline Phase Compliance Hard Rule

> HARD RULE: Every agent MUST follow their prescribed pipeline phases IN SEQUENCE. No phase may be skipped. Each phase has a completion gate -- the gate MUST pass before advancing to the next phase. Agents MUST NOT write deliverables before completing research phases, MUST NOT implement before planning, MUST NOT approve before verifying all checks.
>
> See the Role Pipeline Reference table (below the Agents table) for each role's phases and key delivery gate. The pre-commit hook validates deliverable structure for key artifacts (PRD, ADR, UX). Use `.agentx/agentx.ps1 workflow <agent>` to print the phase list for any role.

### CLI Quick Reference

```powershell
.\.agentx\agentx.ps1 loop start -p "Task description"  # FIRST command - start before any work
.\.agentx\agentx.ps1 loop iterate -s "Progress summary"  # After each verification pass
.\.agentx\agentx.ps1 loop complete -s "All gates passed"  # LAST command - required before handoff
.\.agentx\agentx.ps1 ready                    # Show unblocked work
.\.agentx\agentx.ps1 state -a engineer -s working -i 42
.\.agentx\agentx.ps1 deps 42                  # Check blockers
.\.agentx\agentx.ps1 workflow engineer        # Show workflow steps
.\.agentx\agentx.ps1 loop -LoopAction status   # Check quality loop status
.\.agentx\agentx.ps1 config show               # View configuration
```

---

## Agents (20 total)

Agent definitions live in `.github/agents/*.agent.md` (13 visible) and `.github/agents/internal/*.agent.md` (7 internal sub-agents). Each file contains the role's constraints, boundaries, deliverables, and self-review checklist.

| Agent | File | Deliverable |
|-------|------|-------------|
| Agent X (Hub) | `agent-x.agent.md` | Autonomous orchestration and direct execution across the full workflow |
| Product Manager | `product-manager.agent.md` | PRD at `docs/artifacts/prd/` |
| UX Designer | `ux-designer.agent.md` | Wireframes + HTML prototypes at `docs/ux/` |
| Architect | `architect.agent.md` | ADR + Tech Specs at `docs/artifacts/adr/`, `docs/artifacts/specs/` |
| Engineer | `engineer.agent.md` | Code + Tests (80% coverage) |
| Reviewer | `reviewer.agent.md` | Review at `docs/artifacts/reviews/` |
| Auto-Fix Reviewer | `reviewer-auto.agent.md` | Review + safe auto-fixes |
| DevOps Engineer | `devops.agent.md` | Pipelines at `.github/workflows/` |
| Data Scientist | `data-scientist.agent.md` | ML pipelines + evals at `docs/data-science/` |
| Tester | `tester.agent.md` | Test suites + certification at `docs/testing/` |
| Power BI Analyst | `powerbi-analyst.agent.md` | Reports at `reports/`, `datasets/` |
| Consulting Research | `consulting-research.agent.md` | Research briefs at `docs/coaching/` |
| Agile Coach | `agile-coach.agent.md` | Stories at `docs/coaching/` |

**Internal sub-agents** (spawned by parent agents, not user-invokable):
GitHub Ops, ADO Ops, Functional Reviewer, Prompt Engineer, Eval Specialist, Ops Monitor, RAG Specialist.

---

## Role Pipeline Reference

Each role follows a prescribed phase pipeline. All phases are mandatory. No phase may be skipped without an explicit documented reason. The pre-commit hook validates artifact structure for PRD, ADR, and UX deliverables as a mechanical enforcement layer.

| Role | Pipeline Phases (in order) | Key Delivery Gate |
|------|---------------------------|-------------------|
| **Agent X (Hub)** | Classify -> Route -> Execute specialist phases -> Validate handoffs | All specialist phase gates pass before advancing |
| **Product Manager** | Research (5 phases) -> Classify Intent -> PRD -> Backlog (Epic, Feature, User Stories) -> Self-Review -> Commit | PRD has all required sections; Backlog items (Epic, Features, User Stories) linked to PRD |
| **UX Designer** | Read PRD -> Design Research -> UX Spec -> HTML/CSS Prototypes -> Self-Review -> Commit | WCAG 2.1 AA prototypes exist at `docs/ux/prototypes/` |
| **Architect** | Research (6 phases) -> ADR (3+ options) -> Tech Spec -> GenAI Assessment -> Self-Review -> Commit | ADR + Spec exist; zero code examples in Spec |
| **Engineer** | Research -> Brainstorm -> Plan -> Design -> Implement -> Test -> Review | Loop complete + coverage >=80% + score >=70% |
| **Reviewer** | Read Context -> Verify Loop -> Functional Review -> Code Review -> Run Tests -> Write Review -> Decision | Review doc complete; approval/rejection explicitly stated |
| **Auto-Fix Reviewer** | Read Context -> Verify Loop -> Review Code -> Apply Safe Fixes -> Document -> Self-Review -> Decision | All auto-fixes pass full test suite; review doc complete |
| **DevOps Engineer** | Read Context -> Design Pipeline -> Implement Workflows -> Validate -> Self-Review -> Commit | Pipelines pass lint + execution; deployment docs updated |
| **Data Scientist** | Research (6 phases) -> Pipeline Design -> Eval Plan -> Implementation -> Drift Monitoring -> Self-Review -> Commit | Eval baseline + model card exist |
| **Tester** | Read Context -> Write Tests -> Execute Suite -> Report Defects -> Certification Report -> Commit | Test pyramid complete; certification report signed off |
| **Power BI Analyst** | Read Context -> Semantic Model -> DAX Measures -> Power Query -> Report Layout -> Optimize -> Docs -> Self-Review -> Commit | Semantic model validated; DAX measures tested |
| **Consulting Research** | Understand Request -> Research (7 phases) -> Calibrate Audience -> Create Deliverable | All key claims sourced + triangulated; deliverable complete |
| **Agile Coach** | Mode Selection -> Create/Refine/Decompose Story -> Confirm -> Output | INVEST criteria met; ACs in Given/When/Then format |

---

## Deep References

| Document | Purpose |
|----------|---------|
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Workflow, routing, handoff, status transitions, architecture |
| [Skills.md](Skills.md) | 67 production code skills index (load max 3-4 per task) |
| [docs/GUIDE.md](docs/GUIDE.md) | Quickstart, setup, troubleshooting, local mode |
| [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) | Graded quality assessment of every component |
| [docs/GOLDEN_PRINCIPLES.md](docs/GOLDEN_PRINCIPLES.md) | Mechanical rules enforced by linters and agents |
| [docs/tech-debt-tracker.md](docs/tech-debt-tracker.md) | Known gaps and deferred work |
| `.github/agents/` | 20 agent definition files |
| `.github/skills/` | 67 skill files across 10 categories |
| `.github/instructions/` | 7 instruction files (auto-loaded by file pattern) |
| `.github/schemas/` | Handoff message JSON Schema + communication protocol |
| `.github/templates/` | 8 templates (PRD, ADR, Spec, UX, Review, Security Plan, Progress, Exec Plan) |
| `.github/prompts/` | 12 reusable prompt templates |
| `.agentx/` | CLI utilities (agentx.ps1, agentx.sh, agentic-runner.ps1) |
| `scripts/modules/` | Shared PowerShell modules |
| `packs/` | Agent pack bundles |

### Instruction Files (Auto-Loaded)

| Instruction | Triggers on |
|-------------|-------------|
| `ai.instructions.md` | `*agent*`, `*llm*`, `*model*`, `*workflow*`, `agents/` |
| `python.instructions.md` | `*.py`, `*.pyx` |
| `csharp.instructions.md` | `*.cs`, `*.csx` |
| `typescript.instructions.md` | `*.ts` (backend/server TypeScript) |
| `react.instructions.md` | `*.tsx`, `*.jsx`, `components/`, `hooks/` |
| `memory.instructions.md` | `**` (all files) |
| `project-conventions.instructions.md` | `**` (all files) |

---

## ASCII-Only Rule

All source code, scripts, configuration files, and documentation MUST use ASCII characters only (U+0000-U+007F). Use `[PASS]` not checkmarks, `[FAIL]` not cross marks, `->` not arrows, `-` not em-dashes.

## Directive Language (RFC 2119)

- **MUST** / **MUST NOT** - Absolute requirement or prohibition
- **SHOULD** / **SHOULD NOT** - Strong recommendation (exceptions need justification)
- **MAY** - Truly optional
