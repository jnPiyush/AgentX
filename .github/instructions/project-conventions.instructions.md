---
description: 'Learned project conventions and pitfalls from agent sessions.'
applyTo: '**'
---

# Project Conventions (Learned)

This file captures conventions discovered during agent sessions. Agents update it when
they find a pattern, pitfall, or convention that should be shared.

## How to Update This File

When you discover a new convention or pitfall, append it to the relevant section.
Use concise bullet points with a date and context.

## Patterns That Work

<!-- Agents: append effective patterns here -->
- Use `apply_patch` with 3+ lines of context on each side to avoid false matches
- Run `npx tsc --noEmit` after every file deletion or refactor to catch broken imports early
- For PowerShell heredocs and other large multi-line edits, prefer one well-scoped `apply_patch` change instead of brittle piecemeal replacements
- Treat `.agentx/agentx.ps1 loop complete -s "..."` as the final pre-handoff gate, not a user-prompted post-condition
- After a large block replacement, immediately search for removed unique identifiers and the new declaration before moving on

## Known Pitfalls

<!-- Agents: append pitfalls here -->
- Do NOT use fragile exact-match block replacement habits for large rewrites -- prefer a single well-scoped `apply_patch` edit with enough context to anchor the change
- PowerShell `ConvertTo-Json` flattens single-element arrays; always use `@(...)` to force arrays
- Passing tests is necessary but not sufficient; unexercised UI or wiring regressions can survive unless post-edit verification checks the edited surface directly

## Architecture Decisions

For formal architecture decisions, see `docs/artifacts/adr/`.

This file captures **informal** conventions that emerged from implementation --
not formal design choices.

