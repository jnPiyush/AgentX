---
description: 'Global instructions for GitHub Copilot across the entire repository.'
applyTo: '**'
---

# Global Copilot Instructions

Frontier Corp is the canonical product and agent identity. `AGENTS.md` holds the
shared contract (quality loop, gates, classification, commits). This file adds
only Copilot-specific guidance and stays small because it loads on every request.
Paths below are plain text: read them when a task needs them.

## Before Editing

Apply the runtime transport and guided interaction rules in `AGENTS.md`; do not
initialize a repository merely to satisfy a command-path example.

Apply AGENTS.md and the canonical protocol's artifact/action applicability first:
only create/update/delete/rename of PRD, TechSpec, code or unit tests requires a
loop. Research/read/review-only/check/commit-only and other artifacts (plans,
docs, config, instructions, declarations) are exempt, retaining nonloop checks
and council policy. Core protected executable code remains covered. Roles and
keywords do not grant exemptions. For covered work, run
`.frontier/runtime/frontier.ps1 loop start -p "<task>"` before the first covered
mutation and finish with `loop complete` after an independent reviewer approves the final
state (`--verdict approved --reviewer <id> --high 0 --medium 0`).
Apply class minima 1/2/3/5 only after applicability. Review-only work inspects
scoped work evidence without starting a nested loop or inheriting unrelated
active state; covered review fixes trigger the gate before editing. Delegates
reuse only the assigned parent loop and MUST NOT start/reset/iterate/complete it.
Honesty rule: exempt work MUST NOT claim its own loop; report applicable gate
state from `loop status` and real artifacts; do not
refresh old evidence or invent scores. Details: `.github/AGENT-PROTOCOL.md`
(relative to this file).

## Loading Context

- Read the spec, skill or instruction that governs the task before generating;
  repository conventions override general knowledge. Skip that for plain
  questions and research.
- Language instructions load automatically by file pattern. For other file types,
  pick the matching skill from `Skills.md` (Terraform, Bicep, Blazor, SQL, YAML
  pipelines, API design, UX) instead of loading the whole index.
- Load only the active phase's skills; prefer `grep`/`read` of the exact section
  over whole-file reads.

## Conventions

- ASCII only (U+0000-U+007F): `[PASS]`/`[FAIL]`, `->`, plain `-`.
- Directive language follows RFC 2119 (MUST, SHOULD, MAY).
- Validate agent, skill and instruction frontmatter with
  `pwsh scripts/validate-frontmatter.ps1`.
