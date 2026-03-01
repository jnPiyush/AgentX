# CLAUDE.md - Entry Point for Claude Code

> This file is the equivalent of `.github/copilot-instructions.md` for Claude Code.
> It loads once at session start. Keep it small -- point to detailed docs, don't duplicate them.

---

## Core Documents (Read Before Coding)

1. **[AGENTS.md](AGENTS.md)** - Agent roles, workflows, issue-first rules, classification, commit format, security checklist. Read for ANY coding or workflow task.
2. **[Skills.md](Skills.md)** - Production code standards index (42 skills across 8 categories). Use the Quick Reference table to pick 3-4 relevant skills per task, then read those SKILL.md files.

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
| Writing/editing code | AGENTS.md + matching instruction file + relevant skills (max 3-4) | Skills not matching task |
| Creating new files, features, issues | AGENTS.md (workflow + classification) | Unrelated skills |
| Multi-agent coordination, handoffs | AGENTS.md (full) | Unrelated skills |
| Answering questions, research | Nothing extra | AGENTS.md, Skills.md |
| Debugging | Matching instruction file + error handling skill | AGENTS.md |

**Token budget**: Max 3-4 skills per task (~20K tokens). More = noise.

---

## Context Loading

### Instruction Files (5 remaining)

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

Every piece of work MUST start with an issue. No exceptions (except `[skip-issue]` hotfixes).

```bash
# GitHub Mode
gh issue create --title "[Story] Add /health endpoint" --label "type:story"
# Work...
git commit -m "feat: add health endpoint (#42)"
gh issue close 42 --reason completed
```

```bash
# Local Mode
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
| Customer Coach | [.github/agents/customer-coach.agent.md](.github/agents/customer-coach.agent.md) |

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Tech Spec | `.github/templates/SPEC-TEMPLATE.md` |
| UX Design | `.github/templates/UX-TEMPLATE.md` |
| Code Review | `.github/templates/REVIEW-TEMPLATE.md` |
| Security Plan | `.github/templates/SECURITY-PLAN-TEMPLATE.md` |
