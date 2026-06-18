# CLAUDE.md - Entry Point for Claude Code

> This file is the equivalent of `.github/copilot-instructions.md` for Claude Code.
> It loads once at session start. Keep it small -- point to detailed docs, don't duplicate them.

---

## Quality Loop Hard Rule (NON-SKIPPABLE)

> **HARD RULE**: Before editing, creating, or deleting any file for a code or docs change, run `.agentx/agentx.ps1 loop start -p "<task>"` as your ABSOLUTE FIRST tool call. Reading files and running `loop status` are allowed; mutating the workspace before `loop start` succeeds is a contract violation. The loop is NOT done until `.agentx/agentx.ps1 loop complete -s "<summary>"` succeeds, and at least one history iteration summary must contain the word "review" (subagent review pass). The pre-commit hook blocks commits when these conditions are unmet.
>
> **Honesty rule**: If asked whether the loop ran, run `.agentx/agentx.ps1 loop status` and report the actual state. Do not claim completion unless `loop complete` succeeded in the current session.
>
> **Minimum 5 iterations**: EVERY agent and task class requires at least 5 quality iterations before `loop complete` is allowed (enforced by the loop CLI, agentic runner, extension runtime, and pre-commit hook). Report each iteration with `loop iterate -s "..."`, then summarize before completing.
>
> **Cross-Cutting Agent Protocol**: The shared rules (quality loop, subagent review, per-iteration reporting, Karpathy, Model Council, Scrub, Brainstorm, Plan, Research) are defined ONCE in [.github/AGENT-PROTOCOL.md](.github/AGENT-PROTOCOL.md). Agent files keep only the front-loaded Pre-edit gate + Honesty rule stubs and point there.
>
> Frontmatter-only enforcement is insufficient -- this rule lives here in body prose because models routinely skip rules placed only in deeper docs.

---

## Mandatory Workflow Gates (NON-SKIPPABLE)

These four rules carry the same weight as the Quality Loop. The pre-commit hook hard-fails commits that violate them. Bypass tokens exist for genuine emergencies only.

> **Compound Capture (Done gate)**: Any commit that stages an APPROVED review under `docs/artifacts/reviews/REVIEW-*.md` MUST also stage the matching `docs/artifacts/learnings/LEARNING-<issue>.md`, OR record a skip rationale in the issue close comment and tag the commit message with `[skip-capture]`. Work is NOT Done until Compound Capture is resolved. See [AGENTS.md#compound-engineering-hard-rule](AGENTS.md#compound-engineering-hard-rule).
>
> **Model Council (ADR/PRD/Eval gate -- MANDATORY, NO SKIP)**: Any commit that stages a new `docs/artifacts/adr/ADR-*.md` MUST also stage a matching `docs/artifacts/adr/COUNCIL-*.md` capturing 3 diverse-model perspectives and a Synthesis section. Mandatory for Product Manager (prd-scope), Architect (adr-options), and any complex task; also Data Scientist (ai-design), Reviewer (code-review), and Consulting Research. There is no skip token -- the pre-commit hook hard-fails when the COUNCIL file is missing. See [AGENTS.md#role-pipeline-reference](AGENTS.md#role-pipeline-reference).
>
> **Execution Plan (complex-work gate)**: Any commit changing **8 or more** code files (`.ts/.tsx/.js/.ps1/.py/.cs/.go/.rs/.tf/.bicep/.sql`) MUST stage a corresponding `docs/execution/plans/EXEC-PLAN-*.md` derived from [.github/templates/EXEC-PLAN-TEMPLATE.md](.github/templates/EXEC-PLAN-TEMPLATE.md), OR tag the commit message with `[skip-plan]`. Plans are living documents and MUST be updated, not only authored. See [docs/WORKFLOW.md#execution-plans-for-complex-work](docs/WORKFLOW.md#execution-plans-for-complex-work).
>
> **Brainstorm (Engineer pre-Plan gate)**: When acting in the Engineer phase on non-trivial work, the `Research -> Brainstorm -> Plan -> Design -> Implement -> Test -> Review` pipeline is mandatory. The Brainstorm step is satisfied by recording at least one entry of type `brainstorm` in the clarification ledger OR an `## Alternatives Considered` block inside the execution plan **before** Plan is written. This step has no missing-file hook gate; reviewers MUST verify it during the review phase. See [AGENTS.md#pipeline-phase-compliance-hard-rule](AGENTS.md#pipeline-phase-compliance-hard-rule).

**Honesty rule**: If asked whether any of these gates ran, inspect the staged files and commit message and report the actual state. Never claim a gate was satisfied without the artifact or skip token.

---

## Core Documents (Read Before Coding)

1. **[AGENTS.md](AGENTS.md)** - Map of all resources, quick-reference rules, pointers to detailed docs. Read for ANY coding or workflow task.
2. **[docs/WORKFLOW.md](docs/WORKFLOW.md)** - Workflow, routing, handoff, status transitions, architecture. Read for multi-agent coordination.
3. **[Skills.md](Skills.md)** - Production code standards index. Use the Quick Reference table to pick only the skills relevant to the task and active phase, then read those SKILL.md files.

**When to skip AGENTS.md**: Answering questions, research, debugging only.

---

## Retrieval-Led Reasoning

**IMPORTANT**: Prefer retrieval-led reasoning over pre-training-led reasoning for ALL implementation tasks.
Always `read_file` the relevant SKILL.md, instruction file, or spec before generating code.
Do NOT rely on training data for project-specific patterns, conventions, or APIs.
If a skill, spec, or doc exists in the workspace, read it first; generate second.

---

## Context Loading Rules

Load context on-demand, not upfront. Match the task to the right documents:

| Task | Load | Skip |
|------|------|------|
| Writing/editing code | AGENTS.md + matching instruction file + relevant skills | Skills not matching task |
| Creating new files, features, issues | AGENTS.md (workflow + classification) | Unrelated skills |
| Multi-agent coordination, handoffs | AGENTS.md + [docs/WORKFLOW.md](docs/WORKFLOW.md) | Unrelated skills |
| Answering questions, research | Nothing extra | AGENTS.md, Skills.md |
| Debugging | Matching instruction file + error handling skill | AGENTS.md |

**Token budget**: Load only the skills relevant to the task and active phase. Prefer progressive disclosure over broad context loading.

---

## Context Loading

### Session-Persistent Instructions (load at session start)

Read these two files at the start of EVERY session -- they apply to all tasks:

- [.github/instructions/memory.instructions.md](.github/instructions/memory.instructions.md) -- memory read/write protocol
- [.github/instructions/project-conventions.instructions.md](.github/instructions/project-conventions.instructions.md) -- learned project conventions

### Instruction Files (5 remaining -- load on demand)

| File Pattern | Read This |
|--------------|-----------|
| `*agent*`, `*llm*`, `*workflow*` | [.github/instructions/ai.instructions.md](.github/instructions/ai.instructions.md) |
| `*.py`, `*.pyx` | [.github/instructions/python.instructions.md](.github/instructions/python.instructions.md) |
| `*.cs`, `*.csx` | [.github/instructions/csharp.instructions.md](.github/instructions/csharp.instructions.md) |
| `*.ts` (backend) | [.github/instructions/typescript.instructions.md](.github/instructions/typescript.instructions.md) |
| `*.tsx`, `*.jsx`, `components/`, `hooks/` | [.github/instructions/react.instructions.md](.github/instructions/react.instructions.md) |

### Skills (load directly for domains without instructions)

| File Pattern | Load Skill |
|--------------|------------|
| `*.tf`, `*.tfvars` | [.github/skills/infrastructure/terraform/SKILL.md](.github/skills/infrastructure/terraform/SKILL.md) |
| `*.bicep`, `*.bicepparam` | [.github/skills/infrastructure/bicep/SKILL.md](.github/skills/infrastructure/bicep/SKILL.md) |
| `*.razor`, `*.razor.cs` | [.github/skills/languages/blazor/SKILL.md](.github/skills/languages/blazor/SKILL.md) |
| `*.sql`, `migrations/` | [.github/skills/languages/sql-server/SKILL.md](.github/skills/languages/sql-server/SKILL.md) + [.github/skills/languages/postgresql/SKILL.md](.github/skills/languages/postgresql/SKILL.md) |
| `*.yml`, `*.yaml`, `workflows/` | [.github/skills/operations/yaml-pipelines/SKILL.md](.github/skills/operations/yaml-pipelines/SKILL.md) + [.github/skills/operations/github-actions-workflows/SKILL.md](.github/skills/operations/github-actions-workflows/SKILL.md) |
| `Controllers/`, `api/`, `endpoints/` | [.github/skills/architecture/api-design/SKILL.md](.github/skills/architecture/api-design/SKILL.md) |
| `**/ux/**`, `**/prototypes/**` | [.github/skills/design/ux-ui-design/SKILL.md](.github/skills/design/ux-ui-design/SKILL.md) |

---

## Issue-First Workflow

Every piece of work SHOULD start with an issue. Issue enforcement depends on mode:
- **GitHub Mode**: Issue references in commits are **required** (teams need traceability)
- **Local Mode**: Issue references are **optional** by default (solo developers can commit freely)
- Toggle: `.agentx/agentx.ps1 config set enforceIssues true` (or `false`)

```bash
# GitHub Mode
gh issue create --title "[Story] Add /health endpoint" --label "type:story"
# Work...
git commit -m "feat: add health endpoint (#42)"
gh issue close 42 --reason completed
```

```bash
# Local Mode (issues optional - commit freely)
git commit -m "feat: add user login"

# Or use full issue workflow if preferred:
./.agentx/local-issue-manager.ps1 -Action create -Title "[Bug] Fix timeout" -Labels "type:bug"
git commit -m "fix: resolve login timeout (#1)"
./.agentx/local-issue-manager.ps1 -Action close -IssueNumber 1
```

---

## Classification

| Type | Label | Route To |
|------|-------|----------|
| Broken? | `type:bug` | Engineer |
| Research? | `type:spike` | Architect |
| Docs only? | `type:docs` | Engineer |
| Pipeline/deploy? | `type:devops` | DevOps Engineer |
| Testing/certification? | `type:testing` | Tester |
| Large/vague? | `type:epic` | Product Manager |
| Single capability? | `type:feature` | Architect |
| Otherwise | `type:story` | Engineer |

---

## Commit Format

```
type: description (#issue-number)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

---

## ASCII-Only Rule

All source code, scripts, config, and documentation MUST use ASCII characters only (U+0000-U+007F).

- MUST NOT use emoji, Unicode symbols, box-drawing characters, smart quotes
- MUST use ASCII equivalents: `[PASS]` not checkmarks, `[FAIL]` not cross marks, `->` not arrows, `-` not em-dashes

---

## Security Checklist

Before any commit:

- [ ] No hardcoded secrets
- [ ] SQL parameterization (no string concatenation)
- [ ] Input validation on all endpoints
- [ ] Dependencies scanned

**Blocked commands**: `rm -rf /`, `git reset --hard`, `drop database`

### Local Files First Rule

All agents MUST create deliverable files locally using `editFiles` -- MUST NOT use `mcp_github_create_or_update_file` or `mcp_github_push_files` to push files directly to GitHub. Users must be able to review files locally before committing.

---

## Directive Language

- **MUST** / **MUST NOT** - Absolute requirement or prohibition
- **SHOULD** / **SHOULD NOT** - Strong recommendation (exceptions need justification)
- **MAY** - Truly optional

---

## Agent Definitions

Agent role files are at `.github/agents/`. Load only the active agent's definition:

| Agent | Definition |
|-------|-----------|
| Agent X (Hub) | [.github/agents/agent-x.agent.md](.github/agents/agent-x.agent.md) |
| Product Manager | [.github/agents/product-manager.agent.md](.github/agents/product-manager.agent.md) |
| UX Designer | [.github/agents/ux-designer.agent.md](.github/agents/ux-designer.agent.md) |
| Architect | [.github/agents/architect.agent.md](.github/agents/architect.agent.md) |
| Engineer | [.github/agents/engineer.agent.md](.github/agents/engineer.agent.md) |
| Reviewer | [.github/agents/reviewer.agent.md](.github/agents/reviewer.agent.md) |
| Auto-Fix Reviewer | [.github/agents/reviewer-auto.agent.md](.github/agents/reviewer-auto.agent.md) |
| DevOps Engineer | [.github/agents/devops.agent.md](.github/agents/devops.agent.md) |
| Data Scientist | [.github/agents/data-scientist.agent.md](.github/agents/data-scientist.agent.md) |
| Tester | [.github/agents/tester.agent.md](.github/agents/tester.agent.md) |
| Power BI Analyst | [.github/agents/powerbi-analyst.agent.md](.github/agents/powerbi-analyst.agent.md) |
| Consulting Research | [.github/agents/consulting-research.agent.md](.github/agents/consulting-research.agent.md) |
| GitHub Ops | [.github/agents/internal/github-ops.agent.md](.github/agents/internal/github-ops.agent.md) |
| ADO Ops | [.github/agents/internal/ado-ops.agent.md](.github/agents/internal/ado-ops.agent.md) |
| AzDO PRD to WIT | [.github/agents/internal/ado-prd-to-wit.agent.md](.github/agents/internal/ado-prd-to-wit.agent.md) |
| Functional Reviewer | [.github/agents/internal/functional-reviewer.agent.md](.github/agents/internal/functional-reviewer.agent.md) |
| Architecture Reviewer | [.github/agents/internal/architecture-reviewer.agent.md](.github/agents/internal/architecture-reviewer.agent.md) |
| Prompt Engineer | [.github/agents/internal/prompt-engineer.agent.md](.github/agents/internal/prompt-engineer.agent.md) |
| Eval Specialist | [.github/agents/internal/eval-specialist.agent.md](.github/agents/internal/eval-specialist.agent.md) |
| Ops Monitor | [.github/agents/internal/ops-monitor.agent.md](.github/agents/internal/ops-monitor.agent.md) |
| RAG Specialist | [.github/agents/internal/rag-specialist.agent.md](.github/agents/internal/rag-specialist.agent.md) |
| Agile Coach | [.github/agents/agile-coach.agent.md](.github/agents/agile-coach.agent.md) |

---

## Claude Code Commands

All 21 agents are available as `/project:` slash commands in Claude Code via `.claude/commands/` (invisible sub-agents do not have commands):

| Command | Agent | Purpose |
|---------|-------|---------|
| `/project:agent-x` | Agent X (Hub) | Route work to specialist agents based on type and complexity |
| `/project:product-manager` | Product Manager | Create PRD, break Epics into Features and Stories |
| `/project:ux-designer` | UX Designer | Wireframes, HTML/CSS prototypes, WCAG 2.1 AA |
| `/project:architect` | Architect | ADR with 3+ options, Tech Spec with diagrams |
| `/project:engineer` | Engineer | Implement code, tests (80% coverage), quality loop |
| `/project:reviewer` | Reviewer | Code review (8 categories), approve or reject; also reviews standalone human-written architecture docs (`.md`/`.docx`/`.pptx`/`.pdf`/diagrams) via the Architecture Reviewer sub-agent |
| `/project:reviewer-auto` | Auto-Fix Reviewer | Review + auto-apply safe fixes |
| `/project:devops` | DevOps Engineer | GitHub Actions pipelines, deployment automation |
| `/project:data-scientist` | Data Scientist | ML pipelines, evaluations, drift monitoring |
| `/project:tester` | Tester | Automated testing, certification reports |
| `/project:powerbi-analyst` | Power BI Analyst | Power BI reports, DAX measures, semantic models |
| `/project:consulting-research` | Consulting Research | Domain-expert consulting research, client-ready materials |
| `/project:github-ops` | GitHub Ops | GitHub issue triage, sprint planning, backlog management |
| `/project:ado-ops` | ADO Ops | Azure DevOps work items, sprint planning, PRD decomposition |
| `/project:ado-prd-to-wit` | AzDO PRD to WIT | Analyze PRDs and plan ADO work item hierarchies for execution |
| `/project:agile-coach` | Agile Coach | Story creation, refinement, INVEST compliance |

**Usage**: Type `/project:engineer Implement the health endpoint for issue #1` in Claude Code.

Each command file contains the agent's constraints, boundaries, execution steps, and self-review checklist. It also instructs Claude to `read_file` the full agent definition at `.github/agents/` for retrieval-led reasoning.

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Tech Spec | `.github/templates/SPEC-TEMPLATE.md` |
| UX Design | `.github/templates/UX-TEMPLATE.md` |
| Code Review | `.github/templates/REVIEW-TEMPLATE.md` |
| Architecture Review | `.github/templates/ARCH-REVIEW-TEMPLATE.md` |
| Security Plan | `.github/templates/SECURITY-PLAN-TEMPLATE.md` |
| Progress Log | `.github/templates/PROGRESS-TEMPLATE.md` |
| Roadmap | `.github/templates/ROADMAP-TEMPLATE.md` |
