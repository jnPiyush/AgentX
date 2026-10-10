# Changelog

## Unreleased

### Changed

- Agent hooks resolve the loaded Frontier runtime and skip PowerShell for known
  read-only tools. Missing runtimes deny mutations while preserving a small
  diagnostic-read fallback; portable managed shims discover installed updates.
- Valid active loops with old evidence now request a fresh checkpoint instead
  of an age-only reset. Evidence freshness and independent-review gates remain.
- Lesson promotion is bounded, serialized and deduplicated on retry. Optional
  host-memory saves defer after a diagnosed bounded retry rather than stalling.
- `frontier graduate run` now stages generated skills under
  `.frontier/patterns/staged-skills/` instead of writing them into
  `.github/skills/`. Review a staged skill, then run
  `frontier graduate publish <name>` to make it discoverable. Invalid domain
  slugs and already staged or published skills are skipped; their patterns
  stay active. Each graduation keeps a separate archive, including runs with
  the same timestamp.
- Clarification handoffs keep the sub-agent's full final answer; the
  600-character truncation is removed.

### Added

- `frontier loop verify --result passed|failed|declined [-e <log>]` records the
  post-loop test-suite outcome (log SHA-256, commit, dirty flag) on the
  completed loop; `loop status` shows "not run" until one is recorded.
  Verification history retains earlier outcomes and logs until the next
  `loop start`. Declining a rerun does not replace the last executed result.
- Native runs append one JSON line per model call to
  `.frontier/sessions/<session>.usage.jsonl` (tokens, model, purpose, duration;
  no prompt content), so usage survives an interrupted run.

## 9.8.0 - 2026-10-05

### Upgrade notes

- AgentX/HVE compatibility aliases are removed: old `AGENTX_*`/`HVE_*`
  variables, `agentx.*` settings, `agentx-mcp`, `engines.agentx` and legacy
  `.agentx/`/`.hve/` state are no longer read. The extension ID
  `jnPiyush.agentx` and repository coordinate are unchanged. See
  [Frontier-only interfaces](docs/GUIDE.md#frontier-only-interfaces).
- Ordinary extension use no longer requires per-workspace initialization.
  Frontier creates private, workspace-isolated state on first use;
  **Initialize Repository Support** remains optional for team-visible setup.

### Added

- Extend repository context with hierarchical subsystem cards, native
  PowerShell/managed TypeScript and Tree-sitter syntax extraction, complete
  symbol ranges/signatures beyond the former64-symbol cap, and typed
  evidence-qualified relationships.
- Add exact/BM25 retrieval, bounded graph expansion, current safe source spans,
  estimated token budgets, retained-history evidence deduplication, parser
  capability reporting and a frozen offline comparison harness.
- Add shared guided interaction across Frontier roles: consequential
  clarification, high-level plan approval and milestone reporting.
- Add native versioned plan/input state, guarded execution, atomic session
  persistence and explicit resume/revision/cancellation. Preserve caller-authorized
  automation without treating it as user approval.
- Connect full plan review and live milestones to Frontier chat, and add
  host-elicited MCP continuation with explicit unsupported-host behavior.
- Add automatic private workspace state with multi-root selection,
  workspace-scoped credentials, interrupted-transition recovery and no passive
  repository scanning or scaffolding.
- Add native loop preparation: `loop preflight`, `loop review-packet`,
  `loop reviewer-check` and `loop timing`, with immutable check receipts,
  safe input-bound reuse and attributed phase timing. Suites still run only
  after loop completion and explicit approval.
- Integrate the optional WhatsApp and Teams/GitHub App companions with native
  guided sessions: owner-bound plan approval, answers, resume, read-only
  inspection and bounded runner execution.
- Preserve the Frontier feature inventory in `docs/FEATURES.md`.

### Changed

- Native runs default to guided execution. HydraFusion requires explicit
  bounded automation authorization; it does not silently use another planner.
- Document direct editor-host guidance separately from native enforcement.
- `docs/GUIDE.md` keeps short pointers; HydraFusion, guided interaction,
  Cursor, loop operations and Frontier-only interfaces now live in topic guides
  under `docs/guides/`. Detailed skill sections moved to skill `references/`.

### Fixed

- Start repository discovery from standalone installers and ship all required
  graph/guided runtime helpers in the Bash Copilot CLI package.
- Resolve all Cursor role commands through the installed canonical contracts,
  including the renamed Frontier router, and use the shared risk-based policy.
- Add explicit, user-configuration-preserving Cursor setup with native session
  context and pre-tool policy hooks. Bundle the MCP runtime dependencies for
  extension consumers; standalone setup restores its pinned lock explicitly.
- Bind MCP execution to initialized consumer wrappers and include Cursor
  configuration/commands/rules in install integrity tracking.
- An authentication failure no longer moves an approved guided plan to another
  provider; provider, model and role drift block model responses and tool effects.
- Bound the Claude Code bridge and direct Anthropic requests with a 600-second
  deadline, output limits and owned process-tree termination. Non-ASCII input
  and literal arguments reach shimmed CLIs unchanged.
- Commit, handoff and finish gates revalidate the approved review against current
  sources. Scored review and semantic checks include `.mjs`, `.cjs`, `.mts` and
  `.cts`; Git diff checks always run fresh.
- GitHub issue reads use the configured repository and ignore stderr warnings;
  ADO text-only MCP results parse; missing or unreadable dependencies block
  readiness; replacing parallel units resets reconciliation approval.
- Singleton issue responses drive workflow guidance; the registered learning
  template is ranked by retrieval and promotion uses its metadata title.
- Add Plugin keeps extracted sources until installation finishes and prefers
  compatible plugins bundled with the extension. Unverifiable 8.x registry
  releases and placeholder checksums were withdrawn; no new plugin release is
  implied.
- Parallel closeout requires every unit to be `Done`, unblocked and marked
  `Ready For Reconciliation`. Units are set by `parallel start`; re-run it with
  final unit states, which also resets prior reconciliation approval.
- Clean checkouts build the extension again: `npm ci` in `vscode-extension`
  now installs the locked managed graph parser, which asset generation needs.
- Workspace binding, pending-input and legacy session reads check size and read
  through one file descriptor, and the initial agent status file is created
  atomically, closing check-then-use races reported by CodeQL. Plugin catalog
  fallback warnings log a single-line reason.

### Release qualification

- Native execution remains the default; HydraFusion remains experimental and
  opt-in. Live provider, Linux/macOS and messaging-account qualification remain
  separate from local validation. Validation results are recorded with the
  release package; unrun checks are not represented as passes.

## 9.7.0 - 2026-10-01

### Added

- Add HydraFusion as an opt-in isolated candidate adapter for bounded read/edit tasks
  (`frontier run --engine hydrafusion`, `executionEngine` config default, MCP
  `frontier_run` `engine`, and `frontier engine` readiness). Runs delegate to
  Copilot CLI with an unpinned agent in an independent snapshot repository.
  Native policy hooks constrain reads/edits; strict events, bounded processes
  and an owner-loop ledger govern execution. Candidates require archived,
  hash-bound independent review and explicit promotion; final owner verification
  remains separate. Native stays the default and no automatic fallback occurs.
- Preserve applied-candidate audit history across every attempt; disallow
  discarding applied or partial promotions and accepting superseded candidates.
  Add identity-bound recovery for interrupted workers, byte-preserving patches,
  all-attempt no-progress checks and pending exit propagation through pipelines.

- Add a local repository graph, incremental source discovery and a Mermaid map
  with preserved curated notes as a Frontier workspace capability. Expose bounded
  queries through `frontier context`, the `frontier_context` MCP tool, native
  agents' `repository_context` tool and `Frontier: Refresh Repository Context`.
- Build the graph in the background on initialization and refresh it in a
  detached worker when stale. Session-start hooks inject a small cached primer in
  about 1.4 seconds, deduplicate per session and fingerprint, and never index
  folders where Frontier is not initialized.

### Changed

- Route the Engineer, Architect and UX Designer to GPT-6 Astra (Copilot only)
  and every other agent to Claude Opus 5.5. These preferences apply to separately
  invoked roles; CLI automatic self-review retains the author's model and effort.
  Recalibrate Opus 5.5 authoring agents to `medium` effort.
- Add frontier-model execution rules (precedence, clarify-or-proceed, turn
  endings, no reasoning transcripts, untrusted content) to `AGENTS.md` and
  `AGENT-PROTOCOL.md`; remove wall-clock timeouts and the contradictory
  "absolute first tool call" pre-edit wording from agents.
- Refresh reasoning, prompt, Claude and tool-use skills for Opus 5.5 effort,
  always-on thinking and GPT-6 Astra Responses requirements.

### Fixed

- Register `claude-opus-5.5` (Copilot) and `claude-opus-5-5` (Anthropic API,
  Claude Code) in the runner, force adaptive thinking, send its effort on the
  Anthropic API path, use a 16384-token default when no output cap is supplied,
  preserve explicit caller caps,
  replay signed thinking blocks before tool results, and omit the non-default
  `temperature` that Opus 5.5 rejects. The Opus 5.5 label downgrades to
  `gpt-4.1` on GitHub Models and `gpt-5.6-sol` on the OpenAI API.
- Tag persisted replay blocks by transport. When a resumed session switches
  transports, convert normalized text and tool calls rather than forwarding
  foreign opaque blocks. Existing untagged histories remain supported.
- Resolve renamed agent display names (Frontier TPM, Researcher, E2E SDLC,
  Auto-Fix Reviewer, Power Platform Engineer, Power BI Analyst) to runtime agent
  IDs so clarification routing reaches the intended collaborator.
- Return the standard tool-result contract from `repository_context`; a live run
  previously stopped with a StrictMode error on the first graph query.
- Add `frontier run --no-loop-sync` so smoke and diagnostic runs do not record
  iterations into the active quality loop; the live smoke test uses it.
- Rewrite the bundled/seeded GUIDE link to the extension README as a GitHub URL,
  and ignore the generated `public/` landing build output.
- Replace the temporary MCP `fast-uri` commit override with patched release
  3.1.8 and refresh the compatible `ip-address` lock to 10.7.2.
- Wait briefly for Windows process executable metadata before recording
  HydraFusion recovery identity; incomplete identities still fail closed.

### Release qualification

- Native execution remains the default. HydraFusion is an experimental,
  opt-in candidate adapter, not an automatically accepted task result.
- Local release validation includes the extension coverage suite, real Windows
  Extension Host, MCP lifecycle/smoke tests, core scripts and companion suites.
  The full run identified a process-start race and stale framework assertions;
  results for their final fixes are recorded with the release artifact.
- Live hardened-CLI qualification and Linux/macOS execution remain separate
  requirements for the experimental adapter. Historical provider probes do
  not establish current quality, cost or platform behavior.
- Local packaging does not authorize publication. Release CI and required
  source approval remain separate gates.

## 9.6.2 - 2026-09-28

### Changed

- Treat cosmetic lint/style findings as LOW advisories in local loops/reviews.
  Require explicit cleanup approval and add a read-only scrub `-Advisory` mode;
  preserve strict CI/commit/production gates and genuine defect severity.
- Remove automatic test-suite execution from quality-loop and review guidance.
  Keep non-test verification, independent review and evidence gates; ask the
  user after loop completion before a separate test run.
- Offer the configured VS Code test task only after successful completion and
  explicit approval. Decline/dismissal runs nothing; CLI/MCP output carries the
  post-loop question.
- Remove editor passing-count prompts. Legacy baselines permit omitted counts
  without inventing a pass; explicit malformed or regressed counts still fail.
  CI/release test gates remain unchanged.

### Added

- Add opt-in `frontier.initializationMode: minimal` to create workspace state
  and terminal launchers without starter memory files or empty output folders.
  Standard initialization remains the default; existing files are never deleted.
- Document how Frontier's terminal CLI uses the installed runtime without
  workspace asset seeding, and distinguish it from Copilot CLI plugin discovery.

### Fixed

- Preserve the selected workspace folder URI when resolving initialization
  settings, including remote and multi-root workspaces.
- Reject invalid initialization modes and conflicting minimal-plus-seeding
  settings before writing files. Preserve existing GitHub MCP auto-configuration.
- Correct extension README image and content URL bases for the repository's
  extension subdirectory. Use the canonical Frontier PNG in both READMEs.
- Display three workflow diagrams as portable PNGs while retaining editable
  Mermaid sources, source links, and compact layouts.

### Verification Scope

- Author filesystem-footprint, preservation, invalid-setting, remote-folder,
  GitHub adapter, and lazy-output regressions, plus a native Extension Host
  setting check.
- Author branding, vsce URL-rewriting, diagram-source/export, and workflow-edge
  checks. Inspect packaged README assets and local light/dark browser previews.
- Test- and lint-consent changes received non-test checks and independent source
  review. Their new behavioral cases are not reported as executed; suite
  execution is offered after the loop and CI remains independently required.

## 9.6.1 - 2026-09-27

### Fixed

- Add the workspace-scoped `frontier.useBundledAgents` preference to prevent
  duplicate local and extension-provided Frontier agents. Bundled discovery
  stays enabled by default; this source repository selects its local agents.
- Preserve skills, instructions, prompts, commands and sidebars when bundled
  agents are disabled.
- Align collaborator, handoff and prompt targets with the current agent display
  names while preserving instruction bodies, tools, models and boundaries.

### Tested

- Add generator/source-selection regression checks and validate the setting
  against real VS Code extension contribution filtering.

## 9.6.0 - 2026-09-27

### Changed

- Use the Frontier AI Coding Harness artwork for the Marketplace listing, chat
  avatar, themed Activity Bar, repository and extension READMEs, and landing
  header/favicon.
- Generate the website logo copies and Teams colour/white-outline icons from
  the same canonical artwork. Retire the obsolete robot icon resources.
- Align current release metadata, installer URLs, pack manifests and artifacts
  to 9.6.0 while preserving published history and dependency versions.

### Tested

- Add focused icon-path, SVG/PNG, website-copy and chat-registration checks.
- Verify Teams icon dimensions and the canonical silhouette's transparent alpha
  mask and white outline pixels.

## 9.5.0 - 2026-09-26

### Changed

- Align the extension, MCP runtime, pack metadata, installers, current
  documentation and generated distribution artifacts to version 9.5.0.
- Refresh the install-manifest version and file hashes for the current source.
- Preserve published 9.4.1 history, dependency versions and upgrade-test fixtures.
  This version alignment introduces no additional runtime behavior changes.

## 9.4.1 - 2026-09-26

### Added

- Stage gates for PRD, UX, ADR/Spec, execution plan, review and certification
  deliverables: `evaluation/rubrics/stage-gates.json`, `scripts/score-stage-gate.ps1`
  and `frontier stage-gate`. `frontier validate` runs them in advisory mode by
  default; set `stageGates` to `required` or `off` in `.frontier/config.json`
  (an unknown value enforces `required`). Reports bind to LF-normalized artifact
  hashes, so Windows and Linux checkouts validate the same committed report.
- `frontier tokens context` measures the always-on instruction closure, including
  auto-attached inline, titled and reference-style links, against the `alwaysOn`
  budget in `.token-limits.json`. CI and `diagnose` enforce it.
- The agentic runner records provider-reported usage per model call, writes
  `.frontier/sessions/<id>.usage.json` for `frontier budget`, and stops before
  the next model call (self-review, compaction and delegated runs included) at
  an optional `harness.tokenBudget`.

### Changed

- Consolidate repeated instructions in four skills without changing their
  safeguards, examples, or required outputs. Keep the remaining agent/skill
  cores unchanged by this cleanup.
- Centralize the suite-selection triggers used by Engineer, Reviewer, testing,
  and completion-verification guidance; preserve required CI and release gates.
- Always-on routers (`AGENTS.md`, `CLAUDE.md`, Copilot instructions) name deeper
  documents as plain paths, so hosts no longer attach about 75,000 tokens of
  reference docs to every request. Agent openings drop all-caps banners, and the
  Engineer agent sheds duplicated guidance.
- The ADR and SPEC templates describe contracts with tables instead of YAML and
  JSON blocks, matching the Architect's zero-code rule.
- The quality loop records test counts per suite (`--passing <suite>=<count>`,
  several as `unit=12,api=40`) and compares each suite only with its own last
  count, so a step reruns only the suites its change affects instead of the
  surface a single baseline fixed. `frontier loop affected` lists the test files
  that name code changed since loop start. An integer `loop baseline` keeps the
  previous rule.
- `loop iterate` no longer runs the harness audit for an informational score. Its
  compliance check scrubbed every changed file and could take minutes, so each
  iteration waited for the 30-second deadline. `frontier audit harness` still runs
  it on demand.
- Loop output is shorter: `loop complete` prints the code-quality result and any
  failures instead of the full report (about 24 KB here), and prompts and
  summaries are echoed in one line.

### Fixed

- Preserve folded YAML descriptions in the generated skill catalogue rather
  than publishing the `>-` marker as discovery text.
- Point the skill distribution regression test at the installed runtime
  launcher and cover folded-description generation.
- `validate <n> tester` accepts the `CERT-<n>.md` report the Tester writes.
- `score`, bundled `score-output`, `stocktake`, `validate-handoff` and `takeoff`
  resolve the user's workspace from the extension runtime; `diagnose` checks the
  renamed bundle.
- `frontier tokens <action>` forwards a single extra flag intact.
- The install manifest excludes `build/` scratch copies and carries the current
  version; root installers ship `docs/guides` and `evaluation/rubrics`.
- `research` keeps experiment state under `.frontier/`; restore corrupted
  `docs/WORKFLOW.md` steps, clone instructions and council links.
- The signal hook writes `.frontier/signals`, where `frontier discover` reads;
  handoff messages go to `.frontier/handoffs`; `takeoff` and `dream` read the
  canonical state first.
- Usage exports of OpenAI-compatible calls record zero cache writes, so
  `frontier budget` can price them once rates are added.
- Direct Anthropic API runs no longer fail on the model call after a text-only
  answer (self-review feedback, clarification or a resumed session). The same
  fix applies to `claude-code` runs.
- Inter-agent clarification runs end to end instead of failing on its first
  exchange. A token budget spent during clarification or a final self-review
  exits `token_budget` rather than `human_required` or `max_iterations`.
  Delegated clarification runs no longer write their own usage file, which
  counted their calls twice.
- Stage-gate verdicts accept only `[x]`, `[PASS]`, `[FAIL]` or `[WARN]` markers
  (`[PASS]` and `[FAIL]` must agree with the verdict). Uncertain (`?`, probably,
  draft, TBD), negated (`NOT APPROVED`, `**NOT** APPROVED`, `NOT YET APPROVED`)
  and conditional approvals (`APPROVED if ...`, `provided`, `with conditions`;
  use `CONDITIONAL PASS`) fail the check even beside a clean verdict, with the
  line and reason in the message. Headings such as `## Decision Log` no longer
  count, prose such as `Pass rate: 91%` or `- PASS: 120 tests` under a decision
  heading is not a verdict, and all verdict lines in an artifact must agree on
  approval. Long runs of emphasis characters no longer slow the check.
- The Bash Copilot CLI pack installer no longer starts `dirname` and `mkdir`
  for every copied file. A Git Bash install on Windows took 199 s instead of
  609 s in a local measurement, back within the installer test's time limit.

## 9.4.0

### Changed

- Prefer GPT-6 Astra for Architect and UX Designer, with exact Copilot model
  mapping and Responses transport support. Availability depends on the account.
- Select final verification by changed behavior, direct callers and risk while
  retaining required release gates. Delegated auditors reuse the parent loop.
- Clarify Impeccable's pinned-engine checks and the in-house UX audit's ten
  passes. Missing checks remain explicit rather than prefilled as successful.

### Fixed

- Prevent evidence-checker pipe deadlocks, bound checker execution, and reject
  nonzero checker exits. Check missing or stale evidence before costly validation.
- Forward passing-test counts from VS Code loop dialogs and preserve cancellation.
- Correct Mac launcher permissions and literal command argument handling.
- Enforce role write boundaries for resolved paths and selected-workspace
  credential handling. Preserve existing configuration during reinstall.
- Improve cancellation and shutdown handling in extension, MCP and companions;
  bound output and prevent subsequent writes after unconfirmed termination.
- Preserve learning-document bodies during promotion, remove content payloads
  from new lifecycle signals, and distinguish scanner failures from clean scans.
- Update dependency locks, regression coverage and operator guidance.

### Publishing Notes

- Existing users continue updating through `jnPiyush.agentx`.
- Live model quality, native macOS behavior, companion delivery and complete UX
  accessibility certification are not established by the local checks alone.
- Impeccable supplements the in-house design skills; no controlled evidence of
  improved generated UX is claimed.

## 9.3.1

This release packages the Frontier changes below under a new immutable version.
The existing remote `v9.3.0` tag identifies different source and is not replaced.

### Changed

- Rebrand active product surfaces as Frontier Corp and the 26 specialist agents
  as the Frontier FDE Fleet, practicing Hypervelocity Engineering.
- Introduce Frontier command, chat, state and environment namespaces while
  preserving the published `jnPiyush.agentx` Marketplace identity and documented
  AgentX compatibility paths. Keep historical release records unchanged.
- Migrate legacy mutable state to Frontier and protect canonical gate state and
  launchers across CLI, runner and Git hook boundaries.

### Added

- Add the separately operated Teams and GitHub App collaboration companion for
  authenticated progress updates and confirmed agent instructions. Include
  durable jobs, replay protection, sender/conversation isolation, scoped
  permissions, bounded provider calls and shutdown-safe execution.
- Provide a Teams app-package generator, GitHub App manifest and operator setup
  guide. Follow-up instructions run as subsequent agent turns.

### Publishing Notes

- The extension remains `jnPiyush.agentx` so existing users can update in place.
- Teams and GitHub App services are opt-in companion processes, not a service
  automatically started by installing the VSIX. Live app registration, secrets,
  HTTPS ingress and provider-delivery checks remain operator responsibilities.
- Marketplace publishing remains a manual operation after release validation.

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
