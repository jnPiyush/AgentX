---
description: 'AI Agent Guidelines - map of all resources, quick-reference rules, and pointers to detailed docs.'
applyTo: '**'
---

# AI Agent Guidelines

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

### Security Checklist

- [PASS] No hardcoded secrets
- [PASS] SQL parameterization (NEVER concatenate)
- [PASS] Input validation on all endpoints
- [PASS] Dependencies scanned
- Blocked commands: `rm -rf /`, `git reset --hard`, `drop database`

### Local Files First Rule

All agents MUST create deliverable files locally using `editFiles` -- MUST NOT use `mcp_github_create_or_update_file` or `mcp_github_push_files` to push files directly to GitHub. Users must be able to review files locally before committing.

### CLI Quick Reference

```powershell
.\.agentx\agentx.ps1 ready                    # Show unblocked work
.\.agentx\agentx.ps1 state -Agent engineer -Set working -Issue 42
.\.agentx\agentx.ps1 deps -IssueNumber 42     # Check blockers
.\.agentx\agentx.ps1 workflow -Type feature    # Show workflow steps
.\.agentx\agentx.ps1 loop -LoopAction status   # Check quality loop
.\.agentx\agentx.ps1 config show               # View configuration
```

---

## Agents (20 total)

Agent definitions live in `.github/agents/*.agent.md` (13 visible) and `.github/agents/internal/*.agent.md` (7 internal sub-agents). Each file contains the role's constraints, boundaries, deliverables, and self-review checklist.

| Agent | File | Deliverable |
|-------|------|-------------|
| Agent X (Hub) | `agent-x.agent.md` | Routing decisions (delegation-only -- never performs work itself) |
| Product Manager | `product-manager.agent.md` | PRD at `docs/prd/` |
| UX Designer | `ux-designer.agent.md` | Wireframes + HTML prototypes at `docs/ux/` |
| Architect | `architect.agent.md` | ADR + Tech Specs at `docs/adr/`, `docs/specs/` |
| Engineer | `engineer.agent.md` | Code + Tests (80% coverage) |
| Reviewer | `reviewer.agent.md` | Review at `docs/reviews/` |
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

## Deep References

| Document | Purpose |
|----------|---------|
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Workflow, routing, handoff, status transitions, architecture |
| [Skills.md](Skills.md) | 66 production code skills index (load max 3-4 per task) |
| [docs/GUIDE.md](docs/GUIDE.md) | Quickstart, setup, troubleshooting, local mode |
| [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) | Graded quality assessment of every component |
| [docs/GOLDEN_PRINCIPLES.md](docs/GOLDEN_PRINCIPLES.md) | Mechanical rules enforced by linters and agents |
| [docs/tech-debt-tracker.md](docs/tech-debt-tracker.md) | Known gaps and deferred work |
| `.github/agents/` | 20 agent definition files |
| `.github/skills/` | 66 skill files across 10 categories |
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
