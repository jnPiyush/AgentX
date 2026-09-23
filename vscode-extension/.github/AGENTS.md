---
description: 'AI Agent Guidelines - map of all resources, quick-reference rules, and pointers to detailed docs.'
applyTo: '**'
---

# Frontier FDE Guidelines

> **Single source of truth for repository workflow guidance.**

Frontier Corp practices Hypervelocity Engineering through specialized Forward
Deployed Engineers (FDEs). This file loads on every request, so it holds only the
shared contract. Paths are plain text on purpose: read a file when the task needs
it rather than loading every reference up front. Paths resolve relative to this
file (in extension-only workspaces, inside the installed Frontier extension).

## Working Contract

- Read the relevant spec, skill or instruction before writing code; repository
  conventions override general knowledge.
- Quality loop: before the first file mutation, run
  `.agentx/frontier.ps1 loop start -p "<task>"`. Record each fix/verify cycle with
  `loop iterate -s "<summary>" -e <evidence>`. The final iteration carries an
  independent reviewer verdict (`--verdict approved --reviewer <id> --high 0
  --medium 0`); edits after it need a fresh review. Finish with
  `loop complete -s "<summary>" -e <fresh-evidence>`. Minimum iterations:
  standard 1, auto-fix 2, complex/orchestrated 3, high-risk 5.
- Honesty rule: report loop and gate state from `loop status` and the actual
  artifacts; never claim a check ran, passed or was reviewed without evidence.
- Shared mechanics (review, scrub, Karpathy, Model Council, plans, research) are
  defined once in `.github/AGENT-PROTOCOL.md`; agent files keep role rules only.

### Compound Engineering Hard Rule

Work is done only after Compound Capture is resolved: create
`docs/artifacts/learnings/LEARNING-<issue>.md` for reusable guidance, or record a
skip rationale in the issue close comment for trivial or duplicated work.

### Pipeline Phase Compliance Hard Rule

Follow your agent file's phases in order; each phase gate passes before the next.
Research precedes deliverables, planning precedes implementation, and approval
follows verification. Stage deliverables pass `frontier validate <issue> <role>`
(which runs the stage gate) before handoff. Cross-role summary:
`docs/guides/ROLE-PIPELINES.md`.

### Other Gates

- A new ADR needs a matching `COUNCIL-*.md` with three independently executed
  models and a Synthesis; there is no skip token.
- Changing 8+ code files needs a maintained `docs/execution/plans/EXEC-PLAN-*.md`
  or the `[skip-plan]` commit tag.
- Engineer work records alternatives before the Plan phase (Brainstorm).

## Classification

| Type | Label | Route To |
|------|-------|----------|
| Broken? | `type:bug` | Engineer |
| Research? | `type:spike` | Architect |
| Docs only? | `type:docs` | Engineer |
| Pipeline/deploy? | `type:devops` | DevOps Engineer |
| ML/AI/eval? | `type:data-science` | Data Scientist |
| Testing/cert? | `type:testing` | Tester |
| Fabric data platform? | `type:fabric` | Fabric Engineer |
| Power Platform solution? | `type:lowcode` | Power Platform Builder |
| Power BI? | `type:powerbi` | Power BI Analyst |
| Large/vague? | `type:epic` | Product Manager |
| Single capability? | `type:feature` | Architect |
| Otherwise | `type:story` | Engineer |

## Commits And Delivery

- Commit format: `type: description (#issue)` with `feat`, `fix`, `docs`, `test`,
  `refactor`, `perf` or `chore`. `(#123)` only links; use `fixes #123` in the
  final PR or delivery commit to close the issue. GitHub mode requires the issue
  reference; local mode makes it optional (`frontier config set enforceIssues`).
- Create deliverables as local files so the user can review them; do not push
  files through remote GitHub write APIs.
- Security: no hardcoded secrets, parameterized SQL, validated inputs at system
  boundaries, scanned dependencies. Never run `rm -rf /`, `git reset --hard`,
  force pushes or `DROP DATABASE` as shortcuts.
- ASCII only in source, scripts, config and docs (`[PASS]`, `->`, `-`).
- Directive language follows RFC 2119: MUST/MUST NOT are absolute, SHOULD needs a
  justified exception, MAY is optional.

## Read On Demand

| Need | Path (relative to this file) |
|------|------------------------------|
| Workflow, routing, handoffs, statuses | `docs/WORKFLOW.md` |
| Cross-cutting agent protocol | `.github/AGENT-PROTOCOL.md` |
| Skill index (load only matching skills) | `Skills.md` |
| Setup, local mode, troubleshooting (GUIDE) | `docs/GUIDE.md` |
| Stage-gate and code-quality rubrics | `evaluation/rubrics/` |
| Context budgets and tokenomics | `docs/guides/CODING-HARNESS.md` |
| Role pipelines | `docs/guides/ROLE-PIPELINES.md` |
| Agents, templates, prompts | `.github/agents/`, `.github/templates/`, `.github/prompts/` |

Deliverables live in `docs/artifacts/{prd,adr,specs,reviews,learnings}/`,
`docs/ux/` and `docs/execution/plans/`. CLI: `.agentx/frontier.ps1 help`.
