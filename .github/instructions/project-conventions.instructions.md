---
description: 'Learned project conventions and pitfalls from agent sessions.'
applyTo: '**'
---

# Project Conventions (Learned)

This always-on file is a router. Detailed cross-cutting rules live in
[AGENT-PROTOCOL.md](../AGENT-PROTOCOL.md); agent definitions MUST link to that file
instead of repeating it.

## Required Rules

- Before any code/docs mutation, start the quality loop as the first tool call.
	Minimum: five evidenced iterations, including a subagent review summary containing
	`review`, then `loop complete`. Check `loop status` before reporting gate state.
- Load and follow the Karpathy guidelines for implementation/review. Run
	`.agentx/agentx.ps1 scrub -Path <changed-area>` before review or handoff.
- Engineer work follows `Research -> Brainstorm -> Plan -> Design -> Implement ->
	Scrub -> Test -> Review`. Record alternatives before Plan.
- New ADRs require a matching Model Council artifact. Approved reviews require
	matching learning capture or the documented skip rationale. Changes to eight or
	more code files require an execution plan or documented skip token.
- UI work defaults to browser validation: primary routes, axe scan, and one primary
	interaction. Report unavailable browser prerequisites instead of silently skipping.
- Agent `model:` fields and named council models are advisory. Preserve role behavior
	across capable models and preserve each agent's tool/permission boundaries.
- AgentX is zero-copy. Initialize through `agentx.initializeLocalRuntime`; never copy
	bundled agent, skill, instruction, template, guide, or prompt trees into a workspace.

## Working Conventions

- Prefer small `apply_patch` edits with enough context to identify the target.
- After structural edits, search for removed identifiers and run the narrowest
	executable check before widening validation.
- PowerShell `ConvertTo-Json` can flatten single-element arrays; wrap with `@(...)`.
- Passing unit tests does not replace validation of UI, wiring, or release boundaries.
- Keep durable decisions and pitfalls concise in `/memories/`; keep this router short.

## References

- [.github/AGENT-PROTOCOL.md](../AGENT-PROTOCOL.md)
- [docs/WORKFLOW.md](../../docs/WORKFLOW.md)
- [AGENTS.md](../../AGENTS.md)
- `/memories/conventions.md`, `/memories/decisions.md`, `/memories/pitfalls.md`

