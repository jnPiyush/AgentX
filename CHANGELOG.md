# Changelog

## 8.4.54

### Loop Start Auto-Reset (Agent Confusion Fix)

- **`loop start` now always resets the iteration counter to 1** and archives the prior loop history to `.agentx/state/loop-history/loop-<timestamp>.json`. Previously a healthy active loop blocked `loop start` with "Cancel it first", which caused Engineer and other AgentX agents to keep reading stale iteration counts and history entries from earlier tasks via `loop status`.
- **Implementation now matches the comment that has been in the code all along**: "Any loop start is always a clean reset." Cancelled loops are still archived for audit.
- **No behavior change for `loop iterate` / `loop complete` / pre-commit Check 9**: the per-commit loop gate still operates against the current active loop. Starting a new loop is the explicit signal that prior task context must not leak forward.

## 8.4.53

### Workflow Determinism Hardening

- **Quality Loop Hard Rule** front-loaded as body prose into `.github/copilot-instructions.md`, `CLAUDE.md`, `.github/instructions/ai.instructions.md`, and `.github/instructions/project-conventions.instructions.md`. Frontmatter-only enforcement was being routinely ignored by runtime models; body prose carries decisively more weight.
- **Pre-edit gate** (`loop start` as ABSOLUTE FIRST tool call before any file edit) and **Honesty rule** (run `loop status` before claiming completion) added near the top of every agent definition's Iterative Quality Loop section.
- **Four Mandatory Workflow Gates** added to router surfaces with matching mechanical enforcement in `.github/hooks/pre-commit`:
  - **Compound Capture (Check 11)** — APPROVED review staged -> matching `LEARNING-<issue>.md` required, or `[skip-capture]` token in commit message.
  - **Model Council (Check 13)** — New `ADR-*.md` staged -> matching `COUNCIL-*.md` required (3 diverse models + Synthesis), or `[skip-council]` token.
  - **Execution Plan (Check 14)** — Commits changing >= 8 code files require a matching `EXEC-PLAN-*.md` under `docs/execution/plans/`, or `[skip-plan]` token.
  - **Brainstorm (reviewer-enforced)** — Engineer pipeline requires a `brainstorm` ledger entry or `## Alternatives Considered` block in the execution plan before Plan is written.
- New project convention: loop-honesty pitfall captured in `memories/conventions.md` and `docs/artifacts/learnings/LEARNING-loop-honesty.md`.

### ECC Adoption

- Shipped `iterative-retrieval` and `strategic-compaction` skills.
- Added `scan`, `stocktake`, and `model-route` CLI subcommands plus dashboard webview.

## [8.5.0](https://github.com/jnPiyush/AgentX/compare/v8.4.36...v8.5.0) (2026-04-24)


### Features

* enhance cosmos-db skill with correctness fixes and index entry … ([b2dda19](https://github.com/jnPiyush/AgentX/commit/b2dda190a0d7c97ab0f93d38bfa9e1c7c0a7e6b5))
* enhance cosmos-db skill with correctness fixes and index entry [skip-issue] ([df039b4](https://github.com/jnPiyush/AgentX/commit/df039b4b067484f20c158f0e7051eff706b5e3da))
