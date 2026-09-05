---
description: 'Global instructions for GitHub Copilot across the entire repository.'
applyTo: '**'
---

# Global Copilot Instructions

This file is the **thin router** - it tells you what to load and when. It loads every conversation, so it stays small.

---

## Quality Loop Hard Rule (NON-SKIPPABLE)

Before code/docs mutation, run `.agentx/agentx.ps1 loop start -p "<task>"` as the
first tool call. Reads and `loop status` are allowed before mutation.
Meet minimum iterations: standard 1, auto-fix 2, complex/AgentX 3, high-risk 5.
Record each iteration with real evidence. The FINAL iteration requires
`--verdict approved --reviewer <id> --high 0 --medium 0`; later edits require
fresh review. Work is incomplete until `loop complete -s "<summary>"` succeeds.

**Honesty rule**: inspect `loop status` before reporting completion. Do not
retimestamp old evidence or invent scores. Shared mechanics, Karpathy, research,
scrub, council and capture are defined once in
[AGENT-PROTOCOL.md](AGENT-PROTOCOL.md); retain this pre-edit/honesty stub in body
prose and load the protocol for implementation.

---

## Mandatory Workflow Gates (NON-SKIPPABLE)

These gates retain the [protocol](AGENT-PROTOCOL.md) contract:

- **Compound Capture**: stage matching `LEARNING-<issue>.md` with an APPROVED
  review, or record the issue-close rationale and `[skip-capture]` commit tag.
  Resolve capture before Done.
- **Model Council**: new ADRs require matching `COUNCIL-*.md` with three
  diverse-model perspectives and Synthesis; no skip token. Required for PM,
  Architect, Data Scientist, Reviewer, Consulting Research and complex tasks.
- **Execution Plan**: changes to 8+ code files require a maintained
  `docs/execution/plans/EXEC-PLAN-*.md` from the
  [template](templates/EXEC-PLAN-TEMPLATE.md), or `[skip-plan]`.
- **Brainstorm**: Engineer phases stay ordered: Research -> Brainstorm -> Plan
  -> Design -> Implement -> Scrub -> Test -> Review. Record a `brainstorm`
  ledger entry or `## Alternatives Considered` before Plan; reviewers verify it.

**Honesty rule**: If asked whether any of these gates ran, inspect the staged files and commit message and report the actual state. Never claim a gate was satisfied without the artifact or skip token.

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
| Multi-agent coordination, handoffs | [AGENTS.md](../AGENTS.md) + [docs/WORKFLOW.md](../docs/WORKFLOW.md) | Unrelated skills |
| Answering questions, research | Nothing extra - use tools | AGENTS.md, Skills.md |
| Debugging | Language instruction + error handling skill | AGENTS.md |

**Token budget**: Load only the skills relevant to the task and active phase. Use [Skills.md Quick Reference](../Skills.md) to pick the right ones.

---

## When to Read AGENTS.md

Read [AGENTS.md](../AGENTS.md) for **any coding or workflow task** - it contains classification, commit format, and security checklist. For workflow details, routing, and handoff rules, see [docs/WORKFLOW.md](../docs/WORKFLOW.md).

> **Skip AGENTS.md** for: answering questions, research, and debugging only.

---

## Issue-First Rule

When AGENTS.md applies (see above), follow the issue-first workflow:
1. Create issue **before** starting work (no retroactive issues)
2. Update status: `Backlog -> In Progress -> In Review -> Done`
3. Reference issue in commits: `type: description (#ID)`

> **Note**: In Local Mode, issue enforcement is **optional** by default. Toggle with `agentx config set enforceIssues true`.

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

- **Workflows & Agent Roles**: [AGENTS.md](../AGENTS.md) (map) + [docs/WORKFLOW.md](../docs/WORKFLOW.md) (workflow details)
- **Skills Index**: [Skills.md](../Skills.md) (use Quick Reference to pick skills)
- **Quality & Debt**: [docs/QUALITY_SCORE.md](../docs/QUALITY_SCORE.md) | [docs/tech-debt-tracker.md](../docs/tech-debt-tracker.md)
- **Golden Principles**: [docs/GOLDEN_PRINCIPLES.md](../docs/GOLDEN_PRINCIPLES.md)
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
