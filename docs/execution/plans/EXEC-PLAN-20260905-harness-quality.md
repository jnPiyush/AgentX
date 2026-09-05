# Execution Plan: Evidence-first coding harness and tokenomics

**Date**: 2026-09-05
**Status**: Complete
**Mode**: Local; issue creation optional. Existing compatibility work is preserved.

## Purpose / Big Picture

Improve AgentX's existing coding harness without replacing its provider runtime.
Quality, requirement completeness and data preservation precede cost savings.
Measure resource use; never equate unknown usage with free execution.

## Research and Context

Primary-source research and local design reviews informed this plan. References
and council decisions are recorded in
[HARNESS-RESEARCH-20260905.md](../../guides/HARNESS-RESEARCH-20260905.md).

Observed before implementation:

- `token-counter report` claims skills pass despite narrow glob coverage;
  its generated regex modifies its own globstar expansion.
- `model-route -Task "quick fix for authentication bypass"` returns `fast`.
- Scrub finds only within-file clones and emits many overlapping windows.
- The v2 quality evaluator binds exact implementation hashes and floors but
  needs stricter report shape/evidence validation, not a competing score system.
- Existing token skill limits disagree with `.token-limits.json`.
- Always-loaded AI instructions repeat shared workflow gates and contain a
  fabricated dated-model example. Prompt guidance mandates chain-of-thought
  and a fixed finding count; neither is an appropriate portable quality rule.

## Alternatives Considered

1. Documentation only: cheap, but cannot repair false budget passes or routing.
2. Extend existing deterministic tools: selected. Add an offline budget
   preflight, fix file-budget coverage, improve scrub and evidence validation.
   Preserve provider selection and runtime permissions.
3. Rewrite the runner with autonomous paid-model routing: rejected for this
   scope. Adds billing uncertainty and a second orchestration authority.

## Design and Decision Log

- Architect (GPT-5.4) and Data Scientist (Gemini 3.7 Flash) support option 2.
  Research perspective (Claude Sonnet 5) supports progressive disclosure,
  executable verification and bounded delegation.
- Override the Data Scientist's illustrative subscription `$0` suggestion:
  subscription/credit accounting is separate; unknown dollar cost remains null.
  Do not copy its sample model names or prices into production.
- A caller-provided request supplies capability limits, usage and rate metadata.
  The budget command reports estimates and incomplete evidence. It does NOT
  authorize spend, claim invoice totals, call providers or change deployments.
- Keep the v2 ten-dimension rubric and threshold. Strengthen input validation
  and anchors; do not raise scores to conceal failures or change evidence dates.
- Reuse the existing scrub tool. Cross-file similarity is a review signal,
  not proof of a defect or authorship; do not auto-extract shared logic.
- Use existing skills rather than create another overlapping instruction tree.
- Do not repair unrelated pre-existing worktree defects or rewrite all skills
  simply to satisfy newly visible file-budget violations.

## Plan of Work

| Slice | Owner | Acceptance |
|-------|-------|------------|
| File token budget coverage + model routing | Parent | Nested paths covered, escaped globs, explicit estimates/JSON; risk cannot be overridden by urgency |
| Offline tokenomics | Budget implementer | Context/output reserves, cache accounting, retries/delegation, unknown rates, separate credits, strict input validation |
| Scrub duplicate detection | Scrub implementer | Cross-file evidence, deterministic output, collapsed overlap, no logic auto-fixes |
| Review rubric | Quality implementer | Malformed/null report fields and fabricated placeholders rejected; original valid v2 reports remain valid |
| Instructions/skills | Parent | Compact guidance, no latest-model catalog, progressive disclosure, no fixed finding quotas or forced reasoning transcript |
| Runtime distribution | Parent | CLI/help, VSIX, seed, both standalone installers and existing CI tests include new tool |
| Final verification | Independent reviewer | Exact final hashes, anchored scores, no unresolved HIGH/MEDIUM |

## Validation and Acceptance

- Existing baseline: scrub 20/20; code-quality rubric 33/33.
- New tests must reproduce failing cases before fixes and invoke shipping code.
- Budget tests use synthetic prices labelled as fixtures, no paid calls.
- Compare selected instruction sizes before/after with the same estimator.
  Do not claim billing savings from character-count reductions.
- Execute affected suites together, then installed-runtime and packaging smoke
  checks. Record pre-existing full-repository budget violations separately.
- New tools must report invalid input explicitly, preserve file ownership,
  avoid secrets/prompts in telemetry and not install new test frameworks.
- Risk-aware independent review includes negative tests for evidence tampering
  and boundary arithmetic. Future reviewer timestamps are not freshness proof.

## Progress

- [x] Research and local baseline
- [x] Alternatives and design alignment before implementation
- [x] Token coverage and routing regression fixes (19 + 6 assertions)
- [x] Core guidance optimized and skill rubric checked (90/92/96)
- [x] Budget, scrub and review-gate implementation integrated
- [x] Distribution and instruction measurements
- [x] Independent review and learning capture (95/100; 0 HIGH, 0 MEDIUM)
- [x] Final quality-loop completion (4 iterations; minimum 3)

## Idempotence and Recovery

Read-only budgeting and scans should not mutate a workspace. Regenerate bundled
assets using existing tooling after source changes. Preserve the current dirty
baseline and never restore unrelated user changes. Fix verification errors
through real new checks, not timestamp edits.

## Outcomes & Retrospective

Implemented and independently approved at 95/100. Paid-model quality benchmarks and live
billing savings are not claimed by offline fixture tests.

Initial measurement (same LF-normalized characters/4 estimator; HEAD vs current):
global Copilot router, AI instructions, prompt-engineering, ai-evaluation and
token-optimizer total 9,111 -> 6,019 estimated tokens (33.9% reduction).
Token-optimizer grew to cover cost accounting; the other reductions more than
offset it. This is not a measured reduction in provider usage or invoices.

The corrected matcher exposes inherited budget debt (over 100 documents).
Default full checks remain strict; PR mode compares new/growing overages to the
base revision using the same policy and publishes all remaining debt.

Final component checks before independent review:

| Check | Result |
|-------|--------|
| Budget arithmetic, unknown caps and invalid input | 82 passed |
| Token coverage, baseline debt and empty workspace | 22 passed |
| Executed CI report/check steps (push/PR/regression) | 10 passed |
| Risk-aware model tier recommendation | 6 passed |
| Scrub, cross-file clones and incomplete scans | 48 passed |
| Review schema, hashes and loop evidence integration | 47 passed |
| Customization modernization | 236 passed |
| Installed budget command / policy wiring | 13 passed |
| Diagnose / generated bundle references | 68 passed |
| Extension suite | 1,053 passed |
| Frontmatter | 635 passed |
| Source references | No broken references reported |
| Token no-regression gate | No new/growing overages; 101 inherited/current overages |

During integration, an empty-workspace sum and a bundled tokenomics reference
failed and were fixed with regression coverage. An unreadable nested scan now
fails instead of reporting partial success; PowerShell data records no longer
masquerade as duplicate logic. Preserve the same honest failure reporting in
future optimizations.

Independent review found a CI success-stream capture defect and order-dependent
credit completeness. Both were reproduced before correction. CI now invokes
the counter as a native child process (named-argument array splatting is not
valid for in-process script calls); direct token JSON output is also capturable.
Tests execute the real YAML step bodies, not just their syntax. Credit unknowns
are collected for every call, making partial totals independent of ordering.

Final expanded measurement: seven core files (adding code-review and scrub)
total 13,494 -> 8,534 estimated tokens, a 36.8% reduction with the same estimator.
The initial five-file comparison above is retained as an earlier measurement.

Independent approval retained seven LOW observations: residual declarative-table
clone signals, absolute paths in scanner JSON, legacy route substring hints,
the two uses of `exact` terminology, local CI-test dependency diagnostics, a
repeated CI scan, and minor command-documentation distinctions. None is
represented as fixed or as evidence of production cost savings.

The final reviewer authored `.agentx/state/harness-final-review.json`. Completion
used a newly executed validation result in
`.agentx/state/harness-completion-evidence.json`, leaving the reviewer's original
report and timestamp intact. `loop complete` succeeded with the final approval.
