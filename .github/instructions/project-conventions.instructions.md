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
- Run `.agentx/agentx.ps1 loop start -p "<task>" -i <issue>` as the ABSOLUTE FIRST action before any file edit for code or docs changes; iterate with `loop iterate -s "..." -e <evidence>` after each verification pass; close with `loop complete -s "..." -e <fresh-evidence>` before handoff. Applies to Agent X, Engineer, and Auto-Fix Reviewer alike.

## Known Pitfalls

<!-- Agents: append pitfalls here -->
- Do NOT manually copy AgentX scaffolding (`.github/agentx/`, `.github/agents/`, `.github/skills/`, `.github/templates/`, `.github/instructions/`, `docs/guides/`, `prompts/`, or any extension-bundled asset tree) from the extension installation into the user workspace. AgentX uses a zero-copy runtime: assets are read in place from the installed extension. When the user asks to "initialize / set up / install / scaffold AgentX", invoke the VS Code command `agentx.initializeLocalRuntime` (palette: "AgentX: Initialize Local Runtime") or instruct the user to run `@agentx initialize local runtime` in chat. That command is the only sanctioned initializer and only seeds `.agentx/`, `docs/artifacts/` skeleton, `memories/` (3 seed files), and runtime wrappers.
- Do NOT use fragile exact-match block replacement habits for large rewrites -- prefer a single well-scoped `apply_patch` edit with enough context to anchor the change
- PowerShell `ConvertTo-Json` flattens single-element arrays; always use `@(...)` to force arrays
- Passing tests is necessary but not sufficient; unexercised UI or wiring regressions can survive unless post-edit verification checks the edited surface directly
- The pre-commit hook only enforces the AgentX quality loop at commit time. A session that edits files and runs tests but never commits can finish without the loop ever starting, leaving `.agentx/state/loop-state.json` with `loopConsumed: true` from a prior session. Run `loop start` BEFORE the first file edit, not at the end. Verifying tests pass is necessary but not sufficient -- the loop is a separate gate.
- The pre-commit hook now BLOCKS code commits unless the quality loop has (1) status=complete, (2) loopConsumed=false, (3) iteration >= minIterations, AND (4) at least one history iteration whose summary contains "review" (case-insensitive). The subagent reviewer pass is non-negotiable -- record it as `agentx loop iterate -s "Subagent Review: <findings>" -e <review-evidence>` before `loop complete`.

## Architecture Decisions

For formal architecture decisions, see `docs/artifacts/adr/`.

This file captures **informal** conventions that emerged from implementation --
not formal design choices.

