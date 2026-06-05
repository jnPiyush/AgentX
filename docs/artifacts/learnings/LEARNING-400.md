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
