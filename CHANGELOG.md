# Changelog

## 9.3.0

### Added

- Added `agentx design-language check`, an opt-in bridge to a checksum-pinned, workspace-owned Impeccable 0.1.3 engine. It runs locally without downloads or global engine fallback.
- Distributed the gate through the extension runtime and standalone Copilot CLI pack; connected setup and result handling to UX Designer and prototype audits.

### Reliability

- Distinguish PASS, BLOCKED, and DEGRADED results; preserve advisories and flag incomplete coverage, operational failures, and nested project/design boundaries instead of reporting a false PASS.
- Bound process time, output, discovery, and input size; reject escaping paths, symlinks in scan scope, and modified engines.
- Require explicit engine setup, PRODUCT context, and DESIGN token mappings. Deterministic scans do not replace manual visual, accessibility, or semantic review.

### Validation

- Passed 82 behavior/native checks, including 13 official-engine nested-boundary regressions, 47 distribution checks, and 23 targeted prompt assertions during implementation.
- Verified actual native scans through the bundled extension runtime and Bash-installed CLI. Live Copilot/Agents-window discovery was not validated; upstream engine binaries are not bundled.

## 9.2.1

### Fixes and maintenance

- Hardened zero-copy initialization, runtime discovery, bundled assets, and compatibility with GitHub Copilot CLI and the VS Code Agents window.
- Improved harness budget controls, evidence validation, subprocess handling, YAML parsing, and installed-runtime parity.
- Made documentation-drift review mandatory for features, stories, bugs, and configuration changes.
- Streamlined agent and skill prompts and all 15 templates while preserving required contracts; resolved extension lint findings.
- Retired obsolete execution records while preserving active plans, durable decisions, and historical validation outcomes.
- Kept same-major upgrade protection correct after version bumps and excluded development-only files from the manual-publish VSIX.

## 9.2.0

### Changed

- Added the MIT-licensed `no-ai-slop` skill for editing or auditing general prose without flattening the writer's voice. The skill is distinct from visual anti-slop and code scrub workflows, includes a pinned upstream attribution and bundled license, and is distributed through AgentX packs and the VS Code extension.
- Modernized AgentX customizations around native Copilot capabilities without removing public paths: internal specialists remain hidden but are parent-invocable, primary lifecycle agents expose user-controlled handoffs, and background policy skills no longer compete with prompts in the slash menu.
- Replaced universal internal-agent tools with least-privilege profiles. GitHub Ops retains remote GitHub tools; other internal specialists do not, and analytical reviewers return findings to their parent instead of writing artifacts directly.
- Rebalanced the skill-quality rubric to reserve 10 points for differentiated value through skill rationale, progressive references, and reusable scripts or assets. Existing hard blockers and trusted-base no-regression behavior remain unchanged.
- Replaced fixed model, price, context-window, and preview-package tables in core AI guidance with capability-class selection and runtime provider discovery.
- Added a mandatory 100-point implementation rubric with explicit blocking scores for requirement fit, design conformance, logic, tests, security, and reliability. Code-bearing loops snapshot pre-existing dirty files, bind independent review to final SHA-256 values, and require an 80+ score with all blocking floors met before `loop complete`; docs-only and test-only work skips the gate.
- Replaced the absolute five-iteration floor introduced in 9.0.0 with risk-based minimums: standard `1`, auto-fix `2`, complex delivery and AgentX `3`, high-risk `5`. High-risk classification covers security, authentication, credentials, cryptography, payments, migrations, production, releases, deployments, infrastructure, RBAC, compliance, and privacy work. The structured reviewer verdict on the final work iteration remains mandatory for every class, and a stored higher minimum is never lowered.
- Reduced the agentic runner's internal self-review from a 5-iteration minimum and 15-iteration ceiling to a 1-iteration minimum and 3-iteration ceiling. Internal self-review is recorded under `selfReview` and still does not satisfy the independent review gate.
- Scoped the adversarial review loop in the iterative-loop skill to high-risk work, with a changed-surface table replacing the blanket requirement.

### Performance

- Cut the dominant cost of a typical AgentX run. Repeated LLM review passes, not repository size or script execution, drove end-to-end latency: a generated Engineer prompt measures roughly 1,700 tokens and builds in 34 ms, and `loop status` runs in 42-68 ms warm, while a single zero-tool refusal consumed 57.1 s across three forced review iterations.

### Fixes

- Corrected internal-agent frontmatter that combined `user-invocable: false` with `disable-model-invocation: true`, making documented specialist subagents unreachable to parent agents.
- Added a zero-copy `policy-hook` bridge and agent-scoped `PreToolUse` hooks that block direct remote file mutation and require an active AgentX loop for edits when runtime state exists, without replacing CLI or git-hook enforcement.
- Restored task-class parity across the CLI, the agentic runner, and the TypeScript runtime. All three now share a byte-identical high-risk pattern and a 25-token complex-delivery vocabulary, so agent-related work no longer classifies as `standard` in the CLI while classifying as `complex-delivery` elsewhere.
- Corrected `loop status` and the commit gate to recompute the effective minimum from the inferred task class instead of trusting a stale persisted value.
- Fixed agent frontmatter list parsing, which used a greedy dot-all pattern that ran past the intended block and failed on CRLF input.
- Isolated durable retry accounting so an agentic run's internal retries advance the external iteration counter by at most one.
- Added `AGENT-PROTOCOL.md` to the bundled extension assets; bundled agent definitions linked to a file that was not shipped.
- Exported `DEFAULT_HIGH_RISK_MIN_ITERATIONS` from the extension runtime barrel, the only tier constant previously omitted.
- Fixed zero-copy implementation-rubric lookup, generated Python scaffold indentation, placeholder model-identity detection, POSIX read-only policy commands, and generated .NET model setup guidance.
- Bound loop baselines and every archived iteration artifact to trusted SHA-256 values, blocked workspace scorer shadowing and external Git diff helpers, pruned non-Git traversal, and added explicit resumed-task scope recovery.
- Protected gate state against hardlink aliases, removed ambient Git from direct terminal read allowances, and installed rubric assets under the standalone pack's trusted hidden runtime.
- Prevented duplicate AgentX entries in the source workspace's native agent picker by disabling repository-agent discovery there while retaining all 26 extension contributions and portable Copilot CLI assets.
- Blocked active-loop protected-state writes through opaque runtimes, including inline code, option-assigned paths, and unresolved dynamic arguments, while preserving normal Node, Python, and .NET commands.
- Blocked direct opaque runtime execution during active-loop terminal authorization because script files cannot prove their write set. Harmless runtime version probes remain available, and the exact trusted `agentx loop start` lifecycle command is allowed to open the next loop from completed state.
- Blocked Windows command-shell `/c` and `/k` execution during active-loop terminal authorization so nested redirections cannot overwrite gate-bearing state.
- Pinned `fast-uri` to patched upstream commit `412e40a` through HTTPS and added extension coverage/audit plus MCP clean-install, smoke, and audit preflights before automated release creation.
- Added root `LICENSE` and `NOTICE` to both primary installers and to MCP release archives; the MCP package now declares Apache-2.0 consistently with AgentX.
- Added `LICENSE` and `NOTICE` to primary installers, standalone workspace packs, user-level Copilot CLI installs, and MCP release archives. Workspace installs place AgentX legal files under `.agentx/legal`, global installs use `~/.copilot/agentx-legal`, host-project root legal files remain untouched, and the MCP package declares Apache-2.0 consistently with AgentX.
- Excluded source-workspace `.vscode/settings.json` from portable installs so repositories without the extension retain native `.github/agents` discovery.
- Made same-major version upgrades fail before dependency setup or file mutation unless `-Force` or `--force` is explicit, preventing mixed runtime bytes from being stamped as 9.2.0.

### Validation

- Added regression coverage for customization path compatibility, hidden-but-callable subagents, least-privilege tools, native handoffs, hook behavior, curated skill visibility, differentiation scoring, and runtime-resolved model guidance.
- Added regression coverage for three-way classifier parity, effective-minimum recomputation, tier constant exports, CRLF frontmatter parsing, retry isolation, and stage telemetry.
- Added per-stage runner telemetry (`compactionMs`, `modelMs`, `selfReviewMs`) to the result object and session metadata.
- Added a registration-ownership regression that preserves all 26 contributed agents while suppressing the duplicate source-workspace registration path.

### Limitations

- `hotfix` now matches the high-risk pattern before the standard pattern, so hotfix work routes to the 5-iteration tier. The token is effectively unreachable in the standard vocabulary and needs an explicit policy decision.

## 9.0.0

### Breaking Changes

- Loop completion now fails closed. `loop complete` is rejected unless the final work iteration carries an attributable reviewer verdict of `approved` with zero HIGH and zero MEDIUM findings, so existing flows that closed loops with free-text review claims must record a structured verdict instead.
- The minimum iteration floor is absolute at five for every task class, with no skip token.
- Autonomous shell execution and Claude-native tools are disabled, so workflows that depended on autonomous terminal execution must supply an externally sandboxed adapter.
- Upgrading from any 8.x install now performs a backup and clean install rather than an in-place overwrite.

### Security

- Replaced free-text review claims with attributable structured verdicts, explicit HIGH/MEDIUM counts, final-work binding, stale-state rejection, and an absolute five-iteration floor.
- Unified commit-time review enforcement through `agentx loop gate`, installed post-commit loop consumption, and rejected staged/worktree divergence before validating commit bytes.
- Hardened autonomous workspace tools against traversal, alternate streams, credentials, protected gate paths, links, aliases, and hardlinks. Autonomous shell execution and Claude-native tools are disabled until an externally sandboxed adapter is available.

### Validation

- Added executable regression suites for the review gate, hook lifecycle, path controls, runner review exhaustion, staged/untracked harness enforcement, and VS Code evidence forwarding.

### Limitations

- Autonomous shell execution and Claude-native tools remain unavailable until an externally sandboxed adapter ships.
- Scrub still reports pre-existing MEDIUM `duplicate-logic` findings in the installers and the MCP server entry point. They are outside this release's change surface and are tracked as existing debt.

## 8.7.1

### Fixes

- Added a fixed-source release recovery workflow that validates the semantic tag, release target, source version, master reachability, and checkout SHA before executing repository lifecycle scripts.
- Added release artifact SBOMs, SLSA provenance, recovery-source attestations, and convergent release-asset uploads for recovered releases.
- Authenticated Marketplace provenance verification with the workflow-scoped GitHub token while keeping the Marketplace PAT isolated to the publish step.
- Required Marketplace publication to select the exact versioned VSIX and verify its embedded publisher, extension name, and version against the requested release tag.
- Installed extension dependencies before release stamping so bundled YAML runtime synchronization succeeds in clean CI environments.
- Made stamped-version release detection work for both linear and merge commits.
- Made package-lock version stamping work with both LF and CRLF files and added a regression test for both line-ending forms.

### Validation

- Release candidates are packaged from the stamped source and must pass extension coverage, runtime dependency audit, MCP tests, MCP runtime audit, manifest inspection, and provenance verification.
- Marketplace publication consumes the exact attested GitHub release VSIX rather than rebuilding the extension.

## 8.7.0

### Changes

- Migrated agent defaults and provider routing to Claude Opus 5 and Sonnet 5.
- Added cost optimization and infrastructure governance skills with executable checks for Terraform, Bicep, ARM, credentials, naming, diagnostic settings, and cost controls.
- Added `AgentX Fabric Engineer` as a visible agent that owns Microsoft Fabric data-platform delivery: Lakehouse and Warehouse schemas, OneLake shortcuts, Spark notebooks, Data Pipelines, medallion data products, data quality, and lineage.
- Promoted the packaged Low-Code Builder into core AgentX as `AgentX Power Platform Builder`, which generates unpacked Power Platform solution source for Dataverse, Power Apps, Power Automate, Power Pages, PCF, plugins, security roles, environment variables, and Copilot Studio.
- Raised the agent inventory to 26 total: 15 visible plus 11 internal sub-agents.
- Added `type:fabric` and `type:lowcode` classification, routing, backlog pickup, status transitions, and 7-phase pipeline contracts for both roles.
- Added canonical handoff identities and the `fabric-data-product` and `power-platform-solution` artifact types to the handoff schema and protocol.
- Registered both agents across pack manifests, VS Code chat contributions, installers, Claude and Cursor command wrappers, and the agent tree view.
- Hardened the local WhatsApp companion with read-only defaults, sender-bound single-use confirmation nonces for mutation, replay protection, transcript-first voice handling, bounded serialized CLI execution, fail-closed configuration, and resilient loop notifications.
- Replaced the legacy 40-point skill score with a deterministic 100-point rubric, stable JSON evidence, strict YAML parsing, universal blockers, and trusted-base no-regression enforcement for changed skills.
- Reorganized the main README around product evaluation, operating checkpoints, specialist roles, platform adapters, security controls, installation, and repository navigation.
- Replaced the stale Vercel landing page with a self-contained, responsive, accessible release surface using verified 8.7.0 features and no invented adoption metrics.

### Security

- Hardened supply-chain checks, SSRF defenses, and evaluation gates across the extension and MCP runtime.
- Power Platform Builder is fail-closed for terminal access. A fixed-command allowlist in the agentic runner permits only direct local `pac` version/help and `solution init/unpack/pack/check` invocations with literal arguments; everything else is blocked.
- Mirrored the same policy as an agent-scoped `PreToolUse` hook so VS Code and the Agents Window enforce the boundary, with `chat.useCustomAgentHooks` enabled by default.
- Removed `terminal_exec` from the Power Platform Builder tool schema on the `claude-code` provider; the restriction is scoped to that role only.
- The agent cannot authenticate to, import into, export from, publish to, or delete from a tenant.
- The WhatsApp companion rejects unknown configuration, keeps Chromium sandboxing enabled, strips secrets from AgentX child environments, and disables remote loop evidence mutation.

### Fixes

- Prevented the `hooks` frontmatter block from leaking a spurious entry into parsed agent `tools`, `agents`, and `boundaries` lists.
- Reordered issue-classifier precedence so feature prefixes no longer capture domain work, and mixed Fabric plus Power BI requests still route to Power BI Analyst.
- Corrected handoff validation to resolve glob deliverables recursively and to accept loop evidence only when the recorded issue matches exactly.

### Validation

- Domain agent routing, safety, and handoff suite: 114 assertions passed.
- Terminal policy and `PreToolUse` hook agreed on 15 of 15 adversarial commands, covering quote concatenation, command substitution, backticks, alias construction, nested shells, and CR/LF/tab separators.
- Frontmatter validation 623 of 623; classifier evaluation 23 of 23; VS Code extension compiled with 1013 tests passing.
- Installer regression passed across local and GitHub install modes.
- WhatsApp companion 23 of 23 tests; line, branch, and function coverage gates passed; production runtime audit found 0 vulnerabilities.
- Skill rubric behavior suite passed; 130 of 130 skills validated; Windows and POSIX clean-install scorer parity passed.
- Public landing validation includes desktop/mobile browser checks, keyboard interaction, accessibility scanning, and local route/link verification. Production Vercel smoke testing remains a release closeout gate.

### Limitations

- Agent-scoped hooks depend on the VS Code preview setting `chat.useCustomAgentHooks`; keep terminal tool approval enabled as defense in depth.
- Fabric and Power Platform agents generate and validate local source only. Environment deployment and ALM automation remain with the DevOps Engineer.
- The stdio-only MCP server retains three moderate Hono HTTP-middleware advisories that are not reachable through its transport or tool surface. The release gate remains zero HIGH/CRITICAL runtime vulnerabilities; update when patched transitive versions become available.

## 8.6.1

### Changes

- Added an atomic target rubric library for completeness, constraint adherence, evidence verification, safety and security, clarity, efficiency, and conditional originality.
- Added anchored target scoring, explicit task-profile weights, blocking and advisory floors, failure tags, and judge reliability guidance.
- Kept the executable sample contract limited to the two metrics its deterministic runner currently emits, with continuous `0-1` scoring and existing `0.8` blocking thresholds.

### Fixes

- Corrected evaluation dataset metadata from 5 rows to the actual 15 rows.
- Clarified the boundary between current deterministic evaluation behavior and future model-backed rubric judging.

### Limitations

- The seven new atomic dimensions are target rubrics only until a model-backed runner emits them.
- The accepted `1.0` baseline is not reproducible with the current deterministic classifier, which scores `0.47`; this known evaluator debt is not silently accepted in this release.

### Validation

- VS Code extension compilation and 961 tests passed after the rubric changes.
- Rubric scrub, YAML diagnostics, and ASCII validation passed.

## 8.6.0

### Changes

- Added framework-free TypeScript cores for sequential verification checks and batch benchmark scoring, with injectable execution boundaries and structured evidence conversion.
- Added unit coverage for verification parsing, aggregation, feedback, evidence conversion, benchmark task validation, scoring, filtering, and short-circuit behavior.
- Extended the version stamper to keep installer URLs, installer branch constants, and single-quoted Copilot CLI version payloads synchronized.

### Limitations

- The verification and benchmark cores are library foundations only in this release. Production edit triggers, secure command execution, agent feedback delivery, benchmark command surfaces, and harness-ledger persistence are not yet wired.

### Validation

- Version stamping completed across package metadata, installers, pack manifests, badges, and bundled extension metadata.
- VS Code extension compilation, 961 tests, targeted lint, and scrub checks passed during release review.

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
  - **Compound Capture (Check 11)** - APPROVED review staged -> matching `LEARNING-<issue>.md` required, or `[skip-capture]` token in commit message.
  - **Model Council (Check 13)** - New `ADR-*.md` staged -> matching `COUNCIL-*.md` required (3 diverse models + Synthesis), or `[skip-council]` token.
  - **Execution Plan (Check 14)** - Commits changing >= 8 code files require a matching `EXEC-PLAN-*.md` under `docs/execution/plans/`, or `[skip-plan]` token.
  - **Brainstorm (reviewer-enforced)** - Engineer pipeline requires a `brainstorm` ledger entry or `## Alternatives Considered` block in the execution plan before Plan is written.
- New project convention: loop-honesty pitfall captured in `memories/conventions.md` and `docs/artifacts/learnings/LEARNING-loop-honesty.md`.

### ECC Adoption

- Shipped `iterative-retrieval` and `strategic-compaction` skills.
- Added `scan`, `stocktake`, and `model-route` CLI subcommands plus dashboard webview.
