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
- Use `replace_string_in_file` with 3+ lines of context on each side to avoid false matches
- Run `npx tsc --noEmit` after every file deletion or refactor to catch broken imports early
- For PowerShell heredocs, use `Set-Content` instead of `replace_string_in_file` for large multi-line blocks

## Known Pitfalls

<!-- Agents: append pitfalls here -->
- Do NOT use `replace_string_in_file` for large rewrites -- the exact-match requirement makes it fragile for files > 200 lines; prefer `Set-Content` for full rewrites
- PowerShell `ConvertTo-Json` flattens single-element arrays; always use `@(...)` to force arrays

## Architecture Decisions

For formal architecture decisions, see `docs/adr/`.

This file captures **informal** conventions that emerged from implementation --
not formal design choices.

