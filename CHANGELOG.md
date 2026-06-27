# Changelog

## [8.6.0](https://github.com/jnPiyush/AgentX/compare/v8.5.0...v8.6.0) (2026-06-27)


### Features

* add 11 AI-systems skills + standalone arch-doc review (93 skills total) [skip-issue] ([4f38ce8](https://github.com/jnPiyush/AgentX/commit/4f38ce817a8b5d19e36299c0583e5328af1f1144))
* add agentx dream command for memory consolidation [skip-issue] ([19da115](https://github.com/jnPiyush/AgentX/commit/19da1153110cd71189b5c0846095cfa4a04d81af))
* add AgentX MCP server (19 tools) and copilot-cli user installers [skip-issue] ([fc1690a](https://github.com/jnPiyush/AgentX/commit/fc1690a36d3b422e1b52ce42deef3178195dce7b))
* add agentx-power-platform-builder MVP pack (1 agent, 4 skills, 2 templates, working issue-tracker example) [skip-issue] ([98d6b1c](https://github.com/jnPiyush/AgentX/commit/98d6b1cae2e1789d70d2b5b2ffa02ce64b091fd3))
* add BACKLOG-TEMPLATE.md and upgrade all templates with rich content + Mermaid diagrams [skip-issue] ([6264b1b](https://github.com/jnPiyush/AgentX/commit/6264b1b7504cc7a25915ef550036a7de21b9c9e9))
* add clean-room pdf/docx/pptx skills under .github/skills/document/ ([03418a3](https://github.com/jnPiyush/AgentX/commit/03418a397dfd9d009f995f3a52a14209df34d0b8))
* add convert-slides plugin and wire plugin awareness into agents [skip-issue] ([9f84f5e](https://github.com/jnPiyush/AgentX/commit/9f84f5ef790234d49c5d669a061a64bc03dea798))
* add Cursor editor adapter (.cursor rules, mcp.json, commands) [skip-issue] ([03a7063](https://github.com/jnPiyush/AgentX/commit/03a7063eb7838448b6278ecca8a4b971e51a5d11))
* add experimentation-loop skill and agentx doctor command [skip-issue] ([21e2bfe](https://github.com/jnPiyush/AgentX/commit/21e2bfe220756e298cdbb85fc480514d53585119))
* add inbound reader plugins (read-docs, read-slides, read-pdf) and wire 5-plugin block into all 23 agents [skip-issue] ([118df3d](https://github.com/jnPiyush/AgentX/commit/118df3d6809eeafce732aeb4400a5a3a40132f37))
* add initialize cli symlink mode and tests [skip-issue] ([80f21f7](https://github.com/jnPiyush/AgentX/commit/80f21f7e9afd28f629afeb9e72e6e0419fc77bc4))
* add JSON sidecar registries for deterministic harness lookups [skip-plan] [skip-capture] [skip-issue] ([0adbef0](https://github.com/jnPiyush/AgentX/commit/0adbef0c48208bed59f46f2cbd6d1e63d60a04c2))
* add low-code-vs-pro-code architecture review skill [skip-issue] ([93c25b4](https://github.com/jnPiyush/AgentX/commit/93c25b412f991898aaf8b484deef0fff1fb1ba99))
* add mandatory delivery report section to all agent files ([ef76508](https://github.com/jnPiyush/AgentX/commit/ef7650898aef3f15d4a2e7f1a483caad845ccfab))
* add Remotion video-studio scaffold and v2.html tabbed landing preview [skip-issue] [skip-capture] [skip-council] [skip-plan] ([f79685d](https://github.com/jnPiyush/AgentX/commit/f79685d69ee41830a6037a7a19c1fb254936c063))
* add scrub dead-code and duplicate-logic checks ([#369](https://github.com/jnPiyush/AgentX/issues/369)) ([97b85b6](https://github.com/jnPiyush/AgentX/commit/97b85b627605543beb3906134a9bb9b74bfeec66))
* add Tier-2 + Tier-3 Power Platform coverage to power-platform-builder pack [skip-issue] ([0022792](https://github.com/jnPiyush/AgentX/commit/00227927f739976c9603e8324728f6637ea39eed))
* ADO provider now MCP-first with az CLI fallback (Option B) [skip-issue] ([e79c937](https://github.com/jnPiyush/AgentX/commit/e79c9371f45c08090decba6a12c3235ab15021ad))
* adopt design workflow upgrades and prune stale artifacts [skip-issue] ([4703a79](https://github.com/jnPiyush/AgentX/commit/4703a79218b513fd8c18a925b57dd1430129eff4))
* adopt hyperspaceai/agi [#1](https://github.com/jnPiyush/AgentX/issues/1) per-attempt artifact triad + EXEC-PLAN for [#3](https://github.com/jnPiyush/AgentX/issues/3) MCP CLI wrapper [skip-plan] [skip-capture] [skip-issue] ([c9b598a](https://github.com/jnPiyush/AgentX/commit/c9b598a98f27664bb93ceda6c851aa7703da5745))
* adopt superpowers patterns - two-stage reviewer + finishing-branch and parallel-dispatch skills [skip-plan] [skip-capture] [skip-issue] ([3686a4a](https://github.com/jnPiyush/AgentX/commit/3686a4a9e58195914525f73728c69cc085f6a838))
* **agents:** wire scrub/learn/promote/patterns/ship into Engineer, Reviewer, Agent X [skip-issue] ([b6ab2d1](https://github.com/jnPiyush/AgentX/commit/b6ab2d1ba9bdf8940853791993a7c7e11fea1288))
* bundle .agentx/plugins in VSIX and upgrade convert-slides/convert-docs to v1.1.0 with Mermaid rendering [skip-issue] ([94f883d](https://github.com/jnPiyush/AgentX/commit/94f883d7969c42dfbd93c378edde2fc39d713b0b))
* **chat:** add NL intents for scrub, research, learn, promote, patterns, ship [skip-issue] ([95efb69](https://github.com/jnPiyush/AgentX/commit/95efb6919107ffb60a5b92a79caf83b7826c133c))
* **chat:** LM-classifier path for NL intent router with regex fallback [skip-issue] ([8432755](https://github.com/jnPiyush/AgentX/commit/843275546208a2ba7b9522e6feb6a1d1b7dc2ef5))
* **cli:** add unslop scanner, autoresearch loop, ship orchestrator, install manifest, and learn/evolve/instincts aliases ([9dcd085](https://github.com/jnPiyush/AgentX/commit/9dcd085662cd22383b8ba28a6077426238739d98))
* **companions:** WhatsApp companion bot with voice and push [skip-issue] ([5555c20](https://github.com/jnPiyush/AgentX/commit/5555c20fe7e1a9cd0cf8d63c306136a2572a4378))
* deepen Model Council into persona+purpose-specific deliberation and add multi-topic support [skip-issue] ([c79e100](https://github.com/jnPiyush/AgentX/commit/c79e100dfd218e0fcdf3a565f79a24dee7a6d25f))
* **extension:** seed Copilot CLI assets during Initialize Local Runtime by default [skip-issue] ([d5db343](https://github.com/jnPiyush/AgentX/commit/d5db343f85ee099fea3e5727b3d429a19766ff6d))
* **governance:** front-load 4 workflow Hard Rules in routers + add pre-commit gates [skip-issue] ([8fc694f](https://github.com/jnPiyush/AgentX/commit/8fc694f793a907b5624b1f72ec0060f509964598))
* harden agentx doctor and experimentation-loop revert guidance [skip-issue] ([1c1ff57](https://github.com/jnPiyush/AgentX/commit/1c1ff577e214a49153462bf36bd3f1928dc055b3))
* loop rollback command + NL intent router + task class improvements [skip-issue] ([af5aa31](https://github.com/jnPiyush/AgentX/commit/af5aa31316f684e0c4757b810e9c240fe016e794))
* opt agentx into agents window on activation (refs [#400](https://github.com/jnPiyush/AgentX/issues/400)) ([fb4c01a](https://github.com/jnPiyush/AgentX/commit/fb4c01aa0d22c2c897712209079fd7e9f0a4547f))
* rename sidebar 'ADO Provider' to 'ADO MCP' (v8.4.40) [skip-issue] ([53f14d9](https://github.com/jnPiyush/AgentX/commit/53f14d93cff1d0c89a73d0424add41b18a28c2d3))
* require pro-code vs low-code analysis in arch review for AI solutions [skip-issue] ([7f726cf](https://github.com/jnPiyush/AgentX/commit/7f726cf3cf7f7ade00ce7ce134a012b9055a904d))
* ship ECC adoption items - iterative-retrieval, strategic-compaction skills, scan/stocktake/model-route CLI, dashboard webview [skip-issue] ([6c28d61](https://github.com/jnPiyush/AgentX/commit/6c28d61825a6c837c37060a73a16d84b84d5b328))
* **skills:** UI prototype adoption pack -- accessibility, working-prototype-app, prototype-audit, theme presets, animation recipes, prototype-auditor sub-agent, deploy-prototype plugin [skip-issue] ([ca8ed6a](https://github.com/jnPiyush/AgentX/commit/ca8ed6a1fc99fcfe7cec803cea3d4be817b10796))
* **ux:** add usability-heuristics, content-design, visual-regression skills + tighten UX Designer contract [skip-issue] ([173370f](https://github.com/jnPiyush/AgentX/commit/173370f84777da8e6e4082ef45a517ea8db4b761))
* **vscode-extension:** wire skill+template tree providers to JSON registries [skip-plan] [skip-capture] [skip-issue] ([d44b7d1](https://github.com/jnPiyush/AgentX/commit/d44b7d1f12356ee89caea929ca9788a256952b25))


### Bug Fixes

* agentx issue list under StrictMode + sidebar empty-CLI fallback (v8.4.42) [skip-issue] ([f55151c](https://github.com/jnPiyush/AgentX/commit/f55151c6a477c05c4db48ee23b219080960acafb))
* bundled launcher honors workspace root so loop works in zero-copy workspaces [skip-issue] ([8cd68eb](https://github.com/jnPiyush/AgentX/commit/8cd68ebd028cb2f4a669bfee2920775cc6d47b86))
* **deploy-prototype:** cleanup removes directories, copy preserves dotfiles [skip-issue] ([5c63679](https://github.com/jnPiyush/AgentX/commit/5c636795f315dc8b88efd8743be3f52b529fce1b))
* **extension:** use VS Code-native scaffolders for addAgent and addSkill [skip-issue] ([551385f](https://github.com/jnPiyush/AgentX/commit/551385f25aaec8c91530acb256786ba65895286d))
* harden AgentX workflow gates [skip-issue] ([55f7137](https://github.com/jnPiyush/AgentX/commit/55f713750b0d77948b1df830d2e78924161c9c1a))
* honor pre-set AGENTX_WORKSPACE_ROOT in CLI wrappers [skip-issue] ([6882e5b](https://github.com/jnPiyush/AgentX/commit/6882e5b2977d24aadfb56107a20ed1f9d53f6fc8))
* **loop:** auto-reset on loop start, never block on healthy loop [skip-issue] ([406f63c](https://github.com/jnPiyush/AgentX/commit/406f63c89217ffff7d6a1511edf7eddf2005f416))
* loopConsumed blank after loop complete; pre-commit eagerly marks consumed; bump 8.4.58 [skip-issue] ([05a7b5c](https://github.com/jnPiyush/AgentX/commit/05a7b5ca0d18888a49e806cb9e72a8fe7926bf13))
* **plugins:** resolve 3 code-review findings in inbound reader plugins [skip-issue] ([b007ad3](https://github.com/jnPiyush/AgentX/commit/b007ad327c1cbcb02a0d425fc62eb0574ccc5445))
* preserve user Cursor config during install [skip-issue] ([b0b0fd7](https://github.com/jnPiyush/AgentX/commit/b0b0fd71fcdbb5ffa434562dd98ba91d40316cf7))
* reset iteration counter to 0 on loop start to prevent stale counter ([6eb67fa](https://github.com/jnPiyush/AgentX/commit/6eb67fa57d15f16cb62be0843af48ceac14bd1d0))
* restore extension-only runtime wrappers ([#368](https://github.com/jnPiyush/AgentX/issues/368)) ([5f7d6fe](https://github.com/jnPiyush/AgentX/commit/5f7d6fe0fde9f2952d3096b0d5ac35068adc207a))
* **reviewer:** enforce ARCH-REVIEW-TEMPLATE.md and REVIEW-TEMPLATE.md as hard rules [skip-issue] ([c0bdab7](https://github.com/jnPiyush/AgentX/commit/c0bdab7cc59f35a6fa4fe7aeb9e31502f4efd2dc))
* route model-council through agentx CLI and honor workspace root in zero-copy workspaces [skip-issue] ([fe4fedd](https://github.com/jnPiyush/AgentX/commit/fe4feddcccda3849016719f60f6e0383f72663d3))
* route natural-language 'initialize agentx' phrasings to initializeLocalRuntime (v8.4.41) [skip-issue] ([0beafcd](https://github.com/jnPiyush/AgentX/commit/0beafcd05e2cb1d55620675fd8627fb769ead978))
* route scrub through agentx CLI so it works in zero-copy workspaces [skip-issue] ([be9fb81](https://github.com/jnPiyush/AgentX/commit/be9fb81bcd6ac87cdc9f843a8d64e1bda2c2d35e))
* **runtime:** resolve review-400 findings and loop parity ([#400](https://github.com/jnPiyush/AgentX/issues/400)) ([34acd13](https://github.com/jnPiyush/AgentX/commit/34acd13832d1b26ec4606f5100723170d76b984d))
* **skill-creator:** align init-skill.ps1 Category ValidateSet with actual 12 skill folders [skip-issue] ([3cd8cfb](https://github.com/jnPiyush/AgentX/commit/3cd8cfb446e770983e457509cea39d90b5b4518d))
* **ux:** correct prototype-auditor description to eight passes and dedupe skills-to-load [skip-issue] ([4936bdf](https://github.com/jnPiyush/AgentX/commit/4936bdffe0634dcc0dad3cdd61a63dcc777e8dd6))

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
