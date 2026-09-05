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

## Evidence

- [Research and council](../../guides/HARNESS-RESEARCH-20260905.md)
- [Execution plan](../../execution/plans/EXEC-PLAN-20260905-harness-quality.md)
- Token/routing baseline defects reproduced and covered by
  `tests/token-budget-behavior.ps1` and `tests/model-route-behavior.ps1`.
- Budget invalid numbers, cache subsets, unknown caps and capability mismatch
  covered by `tests/budget-behavior.ps1`.
- Zero-copy and standalone budget wiring covered by
  `tests/harness-distribution-behavior.ps1`.

## Why It Matters

Optimizing an incomplete measurement or an uncalibrated grader makes a harness
look efficient while reducing correctness. Quality-qualified alternatives can
be compared on cost; unverified alternatives must not win merely by being cheap.

## Promotion Path

Keep this learning in draft until repeated independent project runs confirm it.
No production savings or latest-model benchmark result is inferred from fixtures.
