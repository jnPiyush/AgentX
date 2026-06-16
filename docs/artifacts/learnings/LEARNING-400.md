# LEARNING-400: integrating AgentX with VS Code Agents Window via declarative-imperative hybrid

**Date**: 2026-06-01
**Issue**: #400
**Category**: Architecture / Workflow
**Status**: Curated

## Context

VS Code shipped Agents Window Preview (May 2026) with a new declarative customization surface (`.agent.md` schema, `tools:['agent']` allowlists, 8 hook events, `extensions.supportAgentsWindow` opt-in). AgentX already owned a mature Hub-and-Spoke runtime (24 agents, quality loop CLI, pre-commit hook gates, Compound Capture). The architecture question was how to map AgentX onto the new surface without losing enforcement or duplicating runtime state.

## Learning

The best-fit pattern for integrating an existing agent runtime with a host-provided agent surface is **declarative-imperative hybrid with a CLI bridge and thin extension**:

- map AgentX agent definitions one-for-one to host `.agent.md` files (declarative)
- keep the quality loop, gate enforcement, and Compound Capture inside the existing CLI (imperative)
- expose hooks (session-start, pre-tool, post-tool, session-end) as the bridge between host events and CLI calls
- keep the extension thin: command palette wiring and tree views; never reimplement gates

This avoids two failure modes: (1) reimplementing enforcement in extension TypeScript (drift from CLI source of truth), and (2) deferring everything to the CLI and losing host-native UX.

## Why It Matters

- Preserves the CLI as the single source of truth for gates (quality loop, Compound Capture, scrub, Council).
- Lets the host render agents natively (frontmatter-driven), so users get OS-level discoverability without extra UI code.
- Hooks let enforcement run at the host event boundary, so violations surface immediately instead of at commit time only.
- Falls back gracefully: if the host Agents Window is unavailable, the CLI still enforces everything.

## Reuse Guidance

- **Hybrid surface rubric**: when a host provides a declarative slot AND your runtime owns enforcement, map the static shape (agent name, tools, model hints) to declarative and keep dynamic gates (loop state, evidence, council) in imperative CLI. Document the boundary explicitly so reviewers can audit which fields live where.
- **Customizations API Preview risk pattern**: when integrating with a Preview API, pin the schema version, document the field-by-field consumption map, and capture the fallback behavior in a phased rollout plan (Phase 1 = opt-in, Phase 2 = default after promotion criterion is met).
- **Council fallback-runner-up pattern**: when Model Council Synthesis converges on Option C but the Skeptic raises Customizations-API churn as a real risk, record the runner-up (Option A "pure CLI") explicitly in ADR Consequences so a future maintainer can flip back without re-running the council.
- **Hook-driven loop enforcement**: any host that emits session lifecycle events can be wrapped without the runtime knowing it -- map session-start to `loop start`, pre-tool to gate check, post-tool to iterate, session-end to `loop status` reminder. Keep the hook scripts under 50 lines each.
- **Architecture-driven feature with no PM phase**: when a feature is self-initiated by Architect (no user-facing PRD), record the rationale in ADR Context and mark PRD-required gates N/A in the Architecture Reviewer pre-review gates table with explicit rationale, rather than skipping silently.

## Supporting Artifacts

- `docs/artifacts/adr/ADR-400.md` (Option C decision, 3+ options evaluated, weighted matrix C=4.30 vs A=2.95)
- `docs/artifacts/adr/COUNCIL-400.md` (3-model deliberation, Synthesis converged Option C, Skeptic risks promoted to SPEC §11)
- `docs/artifacts/specs/SPEC-400.md` (13 sections, hybrid surfaces in §4, hooks in §5, NFRs in §7, rollout in §10, observability in §12)
- `docs/artifacts/reviews/ARCH-REVIEW-400.md` (APPROVED WITH MINOR FINDINGS: 0 Critical / 0 High / 3 Medium / 4 Low)

---

## Addendum (2026-06-10): Phase 2 implementation -- re-verify Preview APIs at edit time

**Date**: 2026-06-10
**Slice**: CONTRACT-400-agents-window-slice2 (extension opt-in)
**Trigger**: Engineer-phase re-verification of the `extensions.supportAgentsWindow` opt-in before writing code.

### What happened

SPEC-400 section 1.1 and section 10 described `extensions.supportAgentsWindow` as an author-side opt-in the AgentX extension would declare (implying a `package.json` manifest field). At implementation time, the bounded work contract's mandatory pre-edit re-verification step checked the live VS Code Agents Window docs and found it is actually a **user-side `settings.json` setting** -- an object map keyed by extension id, written with `ConfigurationTarget.Global`. There is no author-side manifest field. The contract's Recovery Path fired: code edits were blocked, the discrepancy was logged, and three remediation options were surfaced before any code was touched.

### Learnings

- **Re-verify Preview/external API names against live docs at the moment of implementation, not just at spec time.** A spec written even ~2 weeks earlier can misstate a fast-moving Preview surface. The "version source / verified on" column in the spec's tech-stack table is necessary but not sufficient -- the Engineer must re-open the cited URL before touching code, exactly as the spec's own precondition demanded.
- **User-side vs author-side opt-in is a load-bearing distinction.** "The extension opts in" and "the extension prompts the user to opt in" are different contracts with different surfaces (manifest field vs `settings.json` write), different scopes (per-extension vs per-user), and different reversibility. Name the side explicitly in specs.
- **Prompt-on-first-run + per-major-upgrade is the right pattern for a user-side capability opt-in.** Modeled on Copilot/Pylance: a one-time `showInformationMessage` with Enable / Not now / Don't ask again, gated on `globalState` (permanent decline + last-prompted-major), recording the major *before* awaiting the prompt to avoid concurrent duplicate prompts, and an idempotent spread-merge that preserves other publishers in the shared global map. A manual command and a repo `.vscode/settings.json` courtesy entry round out the three enablement paths.
- **A bounded work contract's Recovery Path is the mechanism that converts a discovery into a controlled pause.** Because the contract pre-declared what to do when the opt-in mechanism differed from the spec, the Engineer paused and re-confirmed scope instead of silently coding against a wrong assumption.

### Reuse guidance

- When a spec cites a Preview API field name, add a Recovery Path clause to the implementation contract: "if the live docs reveal a different mechanism, pause, update the contract, re-confirm before coding."
- When opting into a host capability, determine the *side* (author manifest vs user setting) first; it dictates whether you ship a manifest change or a runtime prompt + idempotent settings merge.
- For user-side settings merges, always read-modify-write the existing map and spread it; never overwrite the whole object.

### Supporting artifacts

- `docs/execution/contracts/CONTRACT-400-agents-window-slice2.md` (bounded contract + Recovery Path that fired)
- `vscode-extension/src/utils/agentsWindowOptIn.ts` (A2 prompt + idempotent merge)
- `vscode-extension/src/test/utils/agentsWindowOptIn.test.ts` (9 regression cases incl. concurrent-prompt guard)
- `docs/artifacts/specs/SPEC-400.md` Erratum E-1 (correction recorded inline)

