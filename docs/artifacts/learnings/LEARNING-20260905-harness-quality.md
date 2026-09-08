---
description: 'Evidence-first tokenomics and coding-harness quality improvements.'
confidence: 0.6
observations: 1
status: draft
category: harness-quality
---

# LEARNING-20260905-harness-quality: Measure the enforced boundary

**Date**: 2026-09-05
**Issue**: Local-mode user request; no remote issue created.

## Context

AgentX already had file budgets, model tier recommendations, a scrub scanner and
a weighted code-review rubric. Their existence did not guarantee correct
coverage, high-risk routing or truthful cost estimates.

## Learning

- Test glob coverage with nested fixtures. Expanding a globstar and then replacing
  every star again can corrupt the generated regex and produce false budget passes.
- Keep file-size estimates, context capacity and billing separate. Use the same
  estimator for before/after comparisons; label unknown costs, rates and limits.
- A configured cap with incomplete totals cannot prove affordability. Known
  subtotals can prove an overrun but cannot prove a complete total fits.
- Urgency is not a reason to route high-risk tasks to a less-capable tier.
- Judge accuracy comes from execution and calibration, not brand or verbosity.
- Compact skill bodies without losing discoverability, failure handling,
  task routing or the repository's required section contracts.
- Validate executable scripts embedded in workflow YAML, not only YAML syntax.
- PowerShell console output bypasses in-process success-stream capture. Execute
  real CI step bodies and use native child-process argument binding for arrays
  of named CLI parameters.
- Collect unknown usage independently of record ordering; a later known credit
  count must not implicitly price earlier unknown calls at zero.
- Generate fresh evidence by re-running checks; changing a timestamp is not
  fresh verification.
- A package manager's offline switch does not constrain a tool's own downloader.
  For Impeccable, pin a target-local native engine by version and SHA256, verify
  its handshake, and run bounded filesystem checks without the npm shim.
- Separate zero primary findings from complete coverage. Preserve advisories,
  diagnostics and unknown scanned counts; never waive an operational failure.
  Product initialization does not imply visual-token authoring is complete.
- Mirror every pinned engine project boundary and design-document fallback.
  An empty nested `.impeccable` or `.git` can suppress inherited token checks
  without a native error; regress this against the official engine, not only mocks.

## Evidence

- [Research and council](../../guides/HARNESS-RESEARCH-20260905.md)
- Retired execution detail:
  `git show 7fd090a4:docs/execution/plans/EXEC-PLAN-20260905-harness-quality.md`.
  Current operations: [Coding harness](../../guides/CODING-HARNESS.md).
- Token/routing baseline defects reproduced and covered by
  `tests/token-budget-behavior.ps1` and `tests/model-route-behavior.ps1`.
- Budget invalid numbers, cache subsets, unknown caps and capability mismatch
  covered by `tests/budget-behavior.ps1`.
- Zero-copy and standalone budget wiring covered by
  `tests/harness-distribution-behavior.ps1`.
- Impeccable native `0.1.3` produced PASS, BLOCKED and DEGRADED in an isolated
  target fixture on 2026-09-07. Behavioral and distribution regressions cover
  pins, output schemas, failures and installed launchers. Operational contract:
  [target-only setup](../../../.github/skills/design/impeccable-integration/references/details-design-language-setup.md).

## Why It Matters

Optimizing an incomplete measurement or an uncalibrated grader makes a harness
look efficient while reducing correctness. Quality-qualified alternatives can
be compared on cost; unverified alternatives must not win merely by being cheap.

## Promotion Path

Keep this learning in draft until repeated independent project runs confirm it.
No production savings or latest-model benchmark result is inferred from fixtures.
