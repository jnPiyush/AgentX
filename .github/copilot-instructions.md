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

Run `.agentx/frontier.ps1 loop start -p "<task>"` before the first file mutation
and finish with `loop complete` after an independent reviewer approves the final
state (`--verdict approved --reviewer <id> --high 0 --medium 0`).
Honesty rule: report gate state from `loop status` and real artifacts; do not
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
