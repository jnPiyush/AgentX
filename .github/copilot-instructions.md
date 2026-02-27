---
description: 'Global instructions for GitHub Copilot across the entire repository.'
---

# Global Copilot Instructions

This file is the **thin router** - it tells you what to load and when. It loads every conversation, so it stays small.

---

## Retrieval-Led Reasoning

**IMPORTANT**: Prefer retrieval-led reasoning over pre-training-led reasoning for ALL implementation tasks.
Always `read_file` the relevant SKILL.md, instruction file, or spec before generating code.
Do NOT rely on training data for project-specific patterns, conventions, or APIs.
If a skill, spec, or doc exists in the workspace, read it first; generate second.

---

## Context Loading Rules

**Load context on-demand, not upfront.** Match the task to the right documents:

| Task | Load | Skip |
|------|------|------|
| Writing/editing code in existing files | [AGENTS.md](../AGENTS.md) + Language instruction (auto via `applyTo`) + relevant skills | Skills not matching task |
| Creating new files, features, issues | [AGENTS.md](../AGENTS.md) (workflow + classification) | Skills not matching task |
| Multi-agent coordination, handoffs | [AGENTS.md](../AGENTS.md) (full) | Unrelated skills |
| Answering questions, research | Nothing extra - use tools | AGENTS.md, Skills.md |
| Debugging | Language instruction + error handling skill | AGENTS.md |

**Token budget**: Load max **3-4 skills** per task (~20K tokens). Use [Skills.md Quick Reference](../Skills.md) to pick the right ones.

---

## When to Read AGENTS.md

Read [AGENTS.md](../AGENTS.md) for **any coding or workflow task** - it contains classification, commit format, agent roles, and security checklist.

> **Skip AGENTS.md** for: answering questions, research, and debugging only.

---

## Issue-First Rule

When AGENTS.md applies (see above), follow the issue-first workflow:
1. Create issue **before** starting work (no retroactive issues)
2. Update status: `Backlog -> In Progress -> In Review -> Done`
3. Reference issue in commits: `type: description (#ID)`

---

## Instruction Files (Auto-Loaded)

These load automatically when editing matching files - no manual action needed:

| Instruction | Triggers on |
|-------------|-------------|
| `ai.instructions.md` | `*agent*`, `*llm*`, `*model*`, `*workflow*`, `agents/` |
| `python.instructions.md` | `*.py`, `*.pyx` |
| `csharp.instructions.md` | `*.cs`, `*.csx` |
| `typescript.instructions.md` | `*.ts` (backend/server TypeScript) |
| `react.instructions.md` | `*.tsx`, `*.jsx`, `components/`, `hooks/` |

For file types not listed above, load the matching **skill** on demand from [Skills.md](../Skills.md):
`*.tf`/`*.tfvars` -> `infrastructure/terraform`, `*.bicep`/`*.bicepparam` -> `infrastructure/bicep`,
`*.razor` -> `languages/blazor`, `*.sql` -> `languages/sql-server` + `languages/postgresql`,
`*.yml`/`*.yaml` -> `operations/yaml-pipelines` + `operations/github-actions-workflows`,
`Controllers/`/`api/` -> `architecture/api-design`, `**/ux/**` -> `design/ux-ui-design`.

---

## Session State

- `manage_todo_list` - Track tasks within current session
- `get_changed_files` - Review uncommitted work before commits
- `get_errors` - Check compilation state after changes

---

## Reference

- **Workflows & Agent Roles**: [AGENTS.md](../AGENTS.md) (load when needed)
- **Skills Index**: [Skills.md](../Skills.md) (use Quick Reference to pick skills)
- **Setup**: [docs/SETUP.md](../docs/SETUP.md)
- **Frontmatter Validation**: `pwsh scripts/validate-frontmatter.ps1`

## ASCII-Only Rule

All source code, scripts, configuration files, and documentation in this repository **MUST** use ASCII characters only (U+0000-U+007F). This applies to all `.ps1`, `.sh`, `.py`, `.ts`, `.js`, `.yml`, `.yaml`, `.json`, and `.md` files.

- **MUST NOT** use emoji, Unicode symbols, box-drawing characters, or any non-ASCII characters
- **MUST** use ASCII equivalents: `[PASS]` not check marks, `[FAIL]` not cross marks, `[WARN]` not warning symbols, `->` not arrows, `+=-|` not box-drawing, `"` not smart quotes
- **MUST** use plain ASCII dashes (`-`) instead of em-dashes or en-dashes
- **MUST** use `[1]`, `[2]`, `[3]` instead of circled numbers

This ensures cross-platform compatibility and prevents encoding issues in terminals, CI/CD pipelines, and editors.

---

## Directive Language (RFC 2119)

All instruction files use RFC 2119 keywords:
- **MUST** / **MUST NOT** - Absolute requirement or prohibition
- **SHOULD** / **SHOULD NOT** - Strong recommendation (exceptions need justification)
- **MAY** - Truly optional, at developer discretion
