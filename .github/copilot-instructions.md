---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

This file is the **thin router** — it tells you what to load and when. It loads every conversation, so it stays small.

---

## Context Loading Rules

**Load context on-demand, not upfront.** Match the task to the right documents:

| Task | Load | Skip |
|------|------|------|
| Writing/editing code in existing files | [AGENTS.md](../AGENTS.md) + Language instruction (auto via `applyTo`) + relevant skills | Skills not matching task |
| Creating new files, features, issues | [AGENTS.md](../AGENTS.md) (workflow + classification) | Skills not matching task |
| Multi-agent coordination, handoffs | [AGENTS.md](../AGENTS.md) (full) | Unrelated skills |
| Answering questions, research | Nothing extra — use tools | AGENTS.md, Skills.md |
| Debugging | Language instruction + error handling skill | AGENTS.md |

**Token budget**: Load max **3-4 skills** per task (~20K tokens). Use [Skills.md Quick Reference](../Skills.md#-quick-reference-by-task-type) to pick the right ones.

---

## When to Read AGENTS.md

Read [AGENTS.md](../AGENTS.md) for **any coding or workflow task** — it contains classification, commit format, agent roles, and security checklist.

> **Skip AGENTS.md** for: answering questions, research, and debugging only.

---

## Issue-First Rule

When AGENTS.md applies (see above), follow the issue-first workflow:
1. Create issue **before** starting work (no retroactive issues)
2. Update status: `Backlog → In Progress → In Review → Done`
3. Reference issue in commits: `type: description (#ID)`

---

## Instruction Files (Auto-Loaded)

These load automatically when editing matching files — no manual action needed:

| Instruction | Triggers on |
|-------------|-------------|
| `ai.instructions.md` | `*agent*`, `*llm*`, `*model*`, `*workflow*`, `agents/` |
| `python.instructions.md` | `*.py`, `*.pyx` |
| `csharp.instructions.md` | `*.cs`, `*.csx` |
| `typescript.instructions.md` | `*.ts` (backend/server TypeScript) |
| `terraform.instructions.md` | `*.tf`, `*.tfvars` (Infrastructure as Code) |
| `bicep.instructions.md` | `*.bicep`, `*.bicepparam` (Azure IaC) |
| `react.instructions.md` | `*.tsx`, `*.jsx`, `components/`, `hooks/` |
| `blazor.instructions.md` | `*.razor`, `*.razor.cs` |
| `api.instructions.md` | `Controllers/`, `api/`, `endpoints/` |
| `sql.instructions.md` | `*.sql`, `migrations/` |
| `yaml.instructions.md` | `*.yml`, `*.yaml` (config, K8s, compose) |
| `devops.instructions.md` | `*.yml`, `*.yaml`, `workflows/` |

---

## Session State

- `manage_todo_list` — Track tasks within current session
- `get_changed_files` — Review uncommitted work before commits
- `get_errors` — Check compilation state after changes

---

## Reference

- **Workflows & Agent Roles**: [AGENTS.md](../AGENTS.md) (load when needed)
- **Skills Index**: [Skills.md](../Skills.md) (use Quick Reference to pick skills)
- **Setup**: [docs/SETUP.md](../docs/SETUP.md)
- **Frontmatter Validation**: `pwsh scripts/validate-frontmatter.ps1`

## Directive Language (RFC 2119)

All instruction files use RFC 2119 keywords:
- **MUST** / **MUST NOT** — Absolute requirement or prohibition
- **SHOULD** / **SHOULD NOT** — Strong recommendation (exceptions need justification)
- **MAY** — Truly optional, at developer discretion
