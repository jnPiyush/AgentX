---
description: 'Learned project conventions and pitfalls from agent sessions.'
applyTo: '**'
---

# Project Conventions (Learned)

Always-on. The quality loop and workflow gates live in `AGENTS.md`; shared
mechanics in `.github/AGENT-PROTOCOL.md`. This file keeps only learned
conventions that are not stated there.

- Apply the Karpathy guidelines to implementation and review; run
  `.agentx/frontier.ps1 scrub -Path <changed-area>` before review or handoff.
- UI work defaults to browser validation: primary routes, an axe scan and one
  primary interaction. Report unavailable browser prerequisites instead of
  silently skipping them.
- Agent `model:` fields and named council models are advisory. Preserve role
  behavior across capable models and each agent's tool and write boundaries.
- Frontier is zero-copy: initialize with `agentx.initializeLocalRuntime`; do not
  copy bundled agent, skill, instruction, template, guide or prompt trees into a
  workspace.
- After structural edits, search for removed identifiers and run the narrowest
  executable check before widening validation.
- PowerShell `ConvertTo-Json` flattens single-element arrays; wrap with `@(...)`.
- Passing unit tests do not replace validation of UI, wiring or release boundaries.
- Keep durable decisions and pitfalls concise in `/memories/`.

