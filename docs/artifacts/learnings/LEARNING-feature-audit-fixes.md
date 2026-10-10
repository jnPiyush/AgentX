---
id: LEARNING-feature-audit-fixes
title: Bind approval to current execution and delivery inputs
description: Reusable failure modes from the d1074854 feature implementation audit.
category: validation
phases: planning,review
validation: draft
evidence: medium
sources: docs/execution/plans/EXEC-PLAN-feature-audit-fixes.md
---

## Summary

An implemented happy path does not establish approval continuity, provider
identity, complete dependencies or artifact availability at later boundaries.
The feature audit found these failures in otherwise reachable capabilities.

## Guidance

- Fail an authentication error instead of transferring an approved plan to a
  different provider. Check actual execution identity before dispatching effects.
- Revalidate source and review hashes at delivery, not only at loop completion.
  Run cheap checks fresh when their full dependency identity is unknown.
- Treat missing dependency records as unresolved. Fetching a page of work does
  not prove older blockers are closed.
- Keep temporary artifacts alive until the last consumer finishes. Prefer
  installed compatible plugin sources to changing old release metadata.
- Exercise a real template as retrieval input; hand-built fixtures can conceal
  a mismatch between artifact creation and consumption.

## Use When

- Reviewing stateful approvals, provider fallbacks, installation lifetimes or
  generated artifact contracts.

## Avoid

- Claiming a source fix is a published release, an executed suite, or live
  integration certification. Current loop and post-loop evidence remain separate.
