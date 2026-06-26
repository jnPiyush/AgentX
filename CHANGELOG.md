# Changelog

## 8.5.1

### Changes

- **Cursor adapter added**: AgentX now ships Cursor-native workspace files, including `.cursor/rules/*.mdc`, `.cursor/mcp.json`, and `.cursor/commands/*.md` thin wrappers over the canonical AgentX agent definitions.

### Fixes

- **Cursor installs preserve user configuration**: installers now avoid treating the whole `.cursor/` directory as AgentX-managed, so user-owned Cursor rules, commands, and MCP settings are not removed during upgrades or hidden by the managed `.gitignore` block.
- **Zero-copy runtime hardening**: includes the scrub and Model Council zero-copy fixes from the 8.4.70 release line so extension-only initialized workspaces can route scrub and council operations through the AgentX CLI.

### Validation

- Packaged `vscode-extension/agentx-8.5.1.vsix` successfully.
- VS Code extension prepublish completed: asset sync, chat contribution generation, clean build, and TypeScript compilation.

## 8.4.70

### Fixes

- **Scrub works in zero-copy workspaces**: `agentx scrub` is now routed through the agentx CLI so it resolves the bundled scanner when a workspace was initialized only through **AgentX: Initialize Local Runtime**. Agent definitions, the AGENT-PROTOCOL, the engineer agent, and project-convention guidance were updated to invoke `pwsh .agentx/agentx.ps1 scrub` instead of a literal `scripts/scrub.ps1` path that does not exist in zero-copy workspaces.
- **Model Council works in zero-copy workspaces**: added `council` / `model-council` CLI commands and made `model-council.ps1` honor `AGENTX_WORKSPACE_ROOT` so COUNCIL files land in the user's workspace instead of the read-only extension bundle. The script is now included in the bundled extension asset list, and 11 documentation references were normalized from `pwsh scripts/model-council.ps1` to `pwsh .agentx/agentx.ps1 council`.

### Validation

- Scrub clean (0 findings) across all changed areas for both fixes.
- `agentx council` validated as dispatching into `model-council.ps1`.
- Both fixes delivered under completed 5-iteration quality loops with subagent review passes.

## 8.4.69

### Fixes

- **Quality loop works in zero-copy workspaces**: the bundled launcher (`<ext>/.github/agentx/.agentx/agentx.ps1`) now detects that it is the extension-bundled launcher by checking that its parent directory leaf is `.github`, and in that case honors the `AGENTX_WORKSPACE_ROOT` supplied by the thin workspace wrapper. Previously the marker check never matched the bundled launcher's own path, so it overwrote the valid workspace root with the extension directory and wrote `loop-state.json` under the extension instead of `<workspace>/.agentx/state/`. As a result `loop start`/`loop status` appeared broken ("No active loop") in workspaces initialized via **AgentX: Initialize Local Runtime**. The repo-root launcher still forces its own root for leak isolation, and a workspace literally named `agentx` is unaffected because the parent-leaf must be `.github`.

### Validation

- Branch-decision unit check: bundled+env honors workspace root; bundled+no-env falls back to launcher dir; repo+env forces repo root.
- End-to-end repro through the real bundled launcher + thin wrapper: `loop-state.json` lands in the user workspace `.agentx/state/` with no leak into the extension directory.

## 8.4.68

### Changes

- **Claude defaults moved to Opus 4.8**: AgentX runtime defaults, provider model maps, VS Code adapter setup, agent frontmatter, model pickers, and runner behavior tests now use Claude Opus 4.8 instead of Sonnet.
- **Workspace launcher isolation restored**: `.agentx/agentx.ps1` now writes loop state to the workspace-local launcher root even when a leaked `AGENTX_WORKSPACE_ROOT` points elsewhere, while preserving extension-bundle runtime support for explicit workspace roots.
- **Release hygiene**: scrub HIGH/MEDIUM findings in the changed skill assets were cleaned up and bundled VS Code extension assets were regenerated.

### Validation

- VS Code extension tests: 913 passing.
- Provider behavior tests: 97/97 passing.
- Framework self-tests: 134/134 passing.
- Agentic runner behavior tests: 163/163 passing.

## 8.4.67

### Fixes

- **Extension-only runtime script wrappers restored**: `agentx scrub` and sibling script-wrapper commands now resolve workflow scripts from the bundled extension runtime when a workspace was initialized only through **AgentX: Initialize Local Runtime**. This preserves the zero-copy runtime model without copying `scripts/` into user workspaces.
- **Scrub scans the user workspace**: the PowerShell launcher now respects a caller-provided `AGENTX_WORKSPACE_ROOT`, matching the bash launcher behavior and preventing bundled CLI invocations from scanning the read-only extension bundle.
- **Bundled workflow scripts**: the VS Code extension asset build now includes the repo-root `scripts/` tree so bundled CLI fallbacks work for `scrub`, `dream`, `research`, `ship`, `takeoff`, `land`, `ghcp-review-resolve`, `install-manifest`, `scan`, `stocktake`, and `route`.

## 8.4.66

### Fixes

- **Marketplace publish unblocked**: bumped the `undici` override in `vscode-extension/package.json` from `7.24.4` to `7.28.0` and regenerated the lockfile. This clears the high-severity advisories (GHSA-vmh5-mc38-953g, GHSA-pr7r-676h-xcf6; vulnerable range 7.0.0 - 7.27.2) that were failing the `npm audit --audit-level=high` quality gate in the marketplace publish workflow.

## 8.4.65

### Cross-Cutting Agent Protocol Centralization

- **Shared agent rules consolidated into a single source of truth** at `.github/AGENT-PROTOCOL.md`. The quality loop, minimum-5-iterations rule, subagent review, per-iteration reporting, Karpathy guidelines, Model Council, Scrub, Brainstorm, Plan, and Research concerns are now documented once. Every `.github/agents/*.agent.md` definition keeps only the front-loaded Pre-edit gate and Honesty rule stubs and points to the protocol doc, eliminating drift across 24 agent files.
- Router surfaces (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `Skills.md`, `.github/instructions/project-conventions.instructions.md`) updated to reference the centralized protocol.

### Documentation Cleanup

- Replaced the stale "max 3-4 skills (~20K tokens)" guidance with progressive-disclosure wording ("load only the skills relevant to the task and active phase") across the skill index, pitch deck generator (`docs/pitch/build_deck.py`), and the landing prototype.

### Version

- Bumped to 8.4.65 and synced bundled VS Code extension assets.

## 8.4.64

### Engineer Agent: Mandatory Scrub + Reuse-First Enforcement

- **AI-slop scrub is now mandatory** in the Engineer pipeline. A dedicated Phase 5b runs `scripts/scrub.ps1` over the changed area before review/handoff, with matching entries in the frontmatter checklist, Quick Phase table, self-review, Done Criteria, and Pre-Handoff gate. Behavior must not change; the scrub only removes machine-authorship tells.
- **Reuse-first / DRY is now an explicit gate.** The Engineer must take a reuse inventory of existing shared modules, APIs, and stored procedures before writing new code, record a reuse decision during planning, and confirm no duplication during implementation and self-review. New duplicated helpers require a documented justification.

### Model Council: Persona + Purpose Deliberation

- **Model Council deepened** from a flat three-perspective brief (Analyst, Strategist, Skeptic) into persona+purpose-specific deliberation. Each council member now reasons from a distinct persona lens calibrated to the deliberation purpose -- PRD scope, ADR options, AI design, code review, and research -- producing sharper, less redundant perspectives before synthesis.
- **Multi-topic support**: a single council run can weigh several decision points in one pass and synthesize across them, instead of being limited to one topic per invocation.
- **Persona model defaults refreshed** to the current frontier tier (Opus 4.7 -> 4.8, GPT 5.4 -> 5.5). Model names remain advisory diversity slots, not hard requirements; substitute any 3 diverse, capable models.

### VS Code Agents Window Opt-In (SPEC-400)

- The extension now **opts into the VS Code Agents Window on activation** as a user-side setting, so AgentX's 24 agents, 127 skills, workflow gates, and quality-loop CLI surface inside the new agent-first window without forcing users to abandon the editor-window experience.
- Corrected SPEC-400 to document the opt-in as a user-side setting and hardened a shell test flake.

### Runtime Hardening

- Resolved the review-400 findings and restored quality-loop parity across the extension runtime.

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
