---
description: 'Global instructions for GitHub Copilot across the entire repository.'
applyTo: '**'
---

# Global Copilot Instructions

This file is the **thin router** - it tells you what to load and when. It loads every conversation, so it stays small.

---

## Quality Loop Hard Rule (NON-SKIPPABLE)

> **HARD RULE**: Before editing, creating, or deleting any file for a code or docs change, run `.agentx/agentx.ps1 loop start -p "<task>"` as your ABSOLUTE FIRST tool call. Reading files and running `loop status` are allowed; mutating the workspace before `loop start` succeeds is a contract violation. The loop is NOT done until `.agentx/agentx.ps1 loop complete -s "<summary>"` succeeds, and at least one history iteration summary must contain the word "review" (subagent review pass). The pre-commit hook blocks commits when these conditions are unmet.
>
> **Minimum 5 iterations**: EVERY agent and task class requires at least 5 quality iterations before `loop complete` is allowed (enforced by the loop CLI, agentic runner, extension runtime, and pre-commit hook). Report each iteration with `loop iterate -s "..."`, then summarize before completing.
>
> **Cross-Cutting Agent Protocol**: The shared rules (quality loop, subagent review, per-iteration reporting, Karpathy, Model Council, Scrub, Brainstorm, Plan, Research) are defined ONCE in [.github/AGENT-PROTOCOL.md](AGENT-PROTOCOL.md). Agent files keep only the front-loaded Pre-edit gate + Honesty rule stubs and point there.
>
> **Honesty rule**: If asked whether the loop ran, run `.agentx/agentx.ps1 loop status` and report the actual state. Do not claim completion unless `loop complete` succeeded in the current session.
>
> Frontmatter-only enforcement is insufficient -- this rule lives here in body prose because models routinely skip rules placed only in deeper docs.

---

## Mandatory Workflow Gates (NON-SKIPPABLE)

These four rules carry the same weight as the Quality Loop. The pre-commit hook hard-fails commits that violate them. Bypass tokens exist for genuine emergencies only.

> **Compound Capture (Done gate)**: Any commit that stages an APPROVED review under `docs/artifacts/reviews/REVIEW-*.md` MUST also stage the matching `docs/artifacts/learnings/LEARNING-<issue>.md`, OR record a skip rationale in the issue close comment and tag the commit message with `[skip-capture]`. Work is NOT Done until Compound Capture is resolved. See [AGENTS.md#compound-engineering-hard-rule](../AGENTS.md#compound-engineering-hard-rule).
>
> **Model Council (ADR/PRD/Eval gate -- MANDATORY, NO SKIP)**: Any commit that stages a new `docs/artifacts/adr/ADR-*.md` MUST also stage a matching `docs/artifacts/adr/COUNCIL-*.md` capturing 3 diverse-model perspectives and a Synthesis section. Mandatory for Product Manager (prd-scope), Architect (adr-options), and any complex task; also Data Scientist (ai-design), Reviewer (code-review), and Consulting Research. There is no skip token -- the pre-commit hook hard-fails when the COUNCIL file is missing. See [AGENTS.md#role-pipeline-reference](../AGENTS.md#role-pipeline-reference).
>
> **Execution Plan (complex-work gate)**: Any commit changing **8 or more** code files (`.ts/.tsx/.js/.ps1/.py/.cs/.go/.rs/.tf/.bicep/.sql`) MUST stage a corresponding `docs/execution/plans/EXEC-PLAN-*.md` derived from [.github/templates/EXEC-PLAN-TEMPLATE.md](../.github/templates/EXEC-PLAN-TEMPLATE.md), OR tag the commit message with `[skip-plan]`. Plans are living documents and MUST be updated, not only authored. See [docs/WORKFLOW.md#execution-plans-for-complex-work](../docs/WORKFLOW.md#execution-plans-for-complex-work).
>
> **Brainstorm (Engineer pre-Plan gate)**: When acting in the Engineer phase on non-trivial work, the `Research -> Brainstorm -> Plan -> Design -> Implement -> Test -> Review` pipeline is mandatory. The Brainstorm step is satisfied by recording at least one entry of type `brainstorm` in the clarification ledger OR an `## Alternatives Considered` block inside the execution plan **before** Plan is written. This step has no missing-file hook gate; reviewers MUST verify it during the review phase. See [AGENTS.md#pipeline-phase-compliance-hard-rule](../AGENTS.md#pipeline-phase-compliance-hard-rule).

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

**Token budget**: Load max **3-4 skills** per task (~20K tokens). Use [Skills.md Quick Reference](../Skills.md) to pick the right ones.

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
