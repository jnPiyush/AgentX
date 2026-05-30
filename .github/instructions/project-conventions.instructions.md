---
description: 'Learned project conventions and pitfalls from agent sessions.'
applyTo: '**'
---

# Project Conventions (Learned)

This file captures conventions discovered during agent sessions. Agents update it when
they find a pattern, pitfall, or convention that should be shared.

## Always-On Rules

- **Cross-Cutting Agent Protocol (SINGLE SOURCE OF TRUTH)**: The shared rules below (quality loop + minimum 5 iterations, subagent review, per-iteration reporting, Karpathy, Model Council, Scrub, Brainstorm, Plan, Research) are defined ONCE in [.github/AGENT-PROTOCOL.md](../AGENT-PROTOCOL.md). Agent definition files MUST NOT re-document them in full -- they keep only the front-loaded Pre-edit gate + Honesty rule stubs and point to that protocol. The discipline is carried by two common layers: (1) mechanical enforcement (loop CLI, agentic runner, VS Code extension runtime, pre-commit hook) and (2) this `applyTo: '**'` instruction set plus the protocol doc.
- **Minimum 5 Iterations (MANDATORY, NO SKIP)**: EVERY agent and EVERY task class (standard, complex-delivery, auto-fix-review, agent-x) requires at least 5 quality iterations before `loop complete` is allowed. This is enforced in `agentx-cli.ps1`, `agentic-runner.ps1`, `loopStateChecker.ts`, and the pre-commit hook -- no per-agent text needed. Report each iteration with `loop iterate -s "..." -e <evidence>`, then summarize in the Delivery Report before `loop complete`.
- **Quality Loop (MANDATORY, NO SKIP)**: Run `.agentx/agentx.ps1 loop start -p "<task>"` as the ABSOLUTE FIRST tool call before any file edit for code or docs changes. Close with `loop complete -s "<summary>"` only after at least one history iteration summary contains the word "review" (subagent review pass). The pre-commit hook enforces this; the loop iteration gate has no skip token (the `AGENTX_SKIP_LOOP_GATE` emergency bypass has been removed).
- **Compound Capture**: APPROVED review staged -> matching `docs/artifacts/learnings/LEARNING-<issue>.md` MUST also be staged, or commit msg tagged `[skip-capture]`. Pre-commit hook hard-fails otherwise.
- **Model Council (MANDATORY, NO SKIP)**: New `docs/artifacts/adr/ADR-*.md` staged -> matching `docs/artifacts/adr/COUNCIL-*.md` MUST also be staged (3 diverse models + Synthesis). Mandatory for Product Manager (prd-scope), Architect (adr-options), and any complex task; also Data Scientist (ai-design), Reviewer (code-review), Consulting Research. The pre-commit hook hard-fails when the COUNCIL file is missing; there is no skip token.
- **Execution Plan**: Commits changing >= 8 code files MUST stage a matching `docs/execution/plans/EXEC-PLAN-*.md`, or commit msg tagged `[skip-plan]`. Pre-commit hook hard-fails otherwise.
- **Brainstorm (Engineer)**: `Research -> Brainstorm -> Plan -> ...` pipeline is mandatory; Brainstorm step is satisfied by a `brainstorm` ledger entry or `## Alternatives Considered` in the execution plan **before** Plan. Reviewer-enforced (no missing-file hook).
- **Honesty**: If asked about any gate state, run `.agentx/agentx.ps1 loop status`, inspect staged files, and report the actual state. Do not claim completion unless the corresponding artifact is staged or the skip token is in the commit message.
- **Karpathy Guidelines (MANDATORY, NO SKIP)**: Every coding, refactor, review, and pipeline phase MUST apply the four Karpathy guidelines -- Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution. Load and follow `.github/skills/development/karpathy-guidelines/SKILL.md`. This is NON-optional with no exemption: complete the "Self-Check Before Handoff" checklist before any handoff, including trivial changes.
- **Scrub (MANDATORY, NO SKIP)**: Every AgentX run that changes files MUST pass through a deslop scrub before review/handoff. Run `pwsh scripts/scrub.ps1 -Path <changed-area>` and apply safe fixes; behavior MUST NOT change. Scrub is part of the canonical workflow (`... -> implement -> scrub -> test -> review -> ship`), not an opt-in step. `ship.ps1` runs scrub unconditionally; `-SkipScrub` is deprecated and ignored. The pre-commit hook hard-fails on HIGH-severity scrub findings in staged files; there is no skip token.
- **Agent-Browser Default Testing**: For any UI-bearing or HTML-rendering change, the DEFAULT test surface is the agent browser (Playwright MCP via `.github/skills/development/browser-automation/SKILL.md`): render the running build, capture a snapshot/screenshot per primary route, run an axe-core a11y scan, and drive at least one scripted interaction per primary user task. Fall back to non-browser testing only when no UI surface exists or the Playwright MCP server is unavailable (report the missing prerequisite; do not silently skip).
- **Model frontmatter is advisory**: The `model:` field in `.github/agents/*.agent.md` frontmatter (e.g. `Claude Opus 4.7 (copilot)`) is a RECOMMENDED default the VS Code Copilot harness selects when available -- NOT a hard requirement of the role. Every agent role and every skill is model-agnostic: the natural-language instructions are written to be fulfilled by any sufficiently capable LLM. Model names that appear in agent bodies (e.g. Model Council members `openai/gpt-5.4`, `anthropic/claude-opus-4.7`, `google/gemini-3.1-pro`) are illustrative diversity slots, not mandated models -- substitute any 3 diverse, capable models. Do NOT hardcode behavior to a single model family.
- **Zero-copy runtime**: Never copy `.github/agentx/`, `.github/agents/`, `.github/skills/`, `.github/templates/`, `.github/instructions/`, `docs/guides/`, or `prompts/` from the extension install into the user workspace. For setup, invoke `agentx.initializeLocalRuntime` (palette: "AgentX: Initialize Local Runtime").

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
- Loop rules placed only in agent frontmatter are routinely ignored by runtime models -- body prose carries more weight. Every agent definition under `.github/agents/` MUST front-load two clauses near the top of its `## Iterative Quality Loop (MANDATORY)` section: (1) a **Pre-edit gate (NON-SKIPPABLE)** requiring `.agentx/agentx.ps1 loop start -p "<task>" -i <issue>` as the ABSOLUTE FIRST tool call before any file edit (reading task/artifacts allowed; editing/creating/deleting before `loop start` succeeds is a contract violation), and (2) an **Honesty rule** requiring `.agentx/agentx.ps1 loop status` before answering any question about loop state, and forbidding claims of completion unless `loop complete` succeeded in the current session. Frontmatter-only enforcement is insufficient.

## Architecture Decisions

For formal architecture decisions, see `docs/artifacts/adr/`.

This file captures **informal** conventions that emerged from implementation --
not formal design choices.

