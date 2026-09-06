---
name: "Refactoring"
agent: "AgentX Engineer"
description: Code refactoring prompt for improving code quality
inputs:
 issue_number:
 description: "Issue number for the refactoring work"
 required: true
 default: ""
---

# Refactoring Prompt

## Context
Improve the code for Issue #{{issue_number}} while preserving its observable
behavior. If only a review or plan was requested, do not implement changes.

Read [core principles](../skills/architecture/core-principles/SKILL.md) and
[code optimization](../skills/development/code-optimization/SKILL.md). Follow the
Engineer pipeline and [shared protocol](../AGENT-PROTOCOL.md) before editing.

## Workflow

1. Define the bounded goal and baseline: inputs, outputs, public interfaces,
   side effects, user-file ownership, errors and relevant test results.
2. Trace actual callers and search for reusable helpers. Prefer a proven
   responsibility boundary or duplicate behavior over a speculative abstraction.
3. Compare alternatives before planning. Method length, nesting and parameter
   counts are signals, not mandatory extraction thresholds. Leave clear code
   alone when no concrete benefit is demonstrated.
4. Make one coherent transformation at a time. Preserve validation, permissions,
   cleanup, concurrency and compatibility. Separate a requested behavior change
   from a refactor and obtain the required approval before changing its contract.
5. Re-run targeted existing tests and compare observable outcomes with the
   baseline. For move-only extraction, preserve declaration bodies and verify
   the export/caller surface. Add boundary regression coverage where missing;
   never weaken tests or acceptance criteria.
6. Run scrub and mandatory documentation-drift review, then independent review.
   If a transformation fails verification, fix or revert only that transformation,
   preserving unrelated user work.

## Output

- Problem and chosen scope, supported by concrete code evidence.
- Changes and preserved contracts, with affected files.
- Before/after measures relevant to the goal: duplication, responsibilities,
  complexity or measured performance. Fewer lines alone do not prove improvement.
- Executed verification and documentation impact; disclose blocked checks.
- Remaining risks or justified deferrals. A recommendation to leave code
  unchanged is valid when no behavior-safe improvement is supported.
