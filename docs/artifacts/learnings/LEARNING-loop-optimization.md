---
title: Reuse verification evidence without reusing approval
description: Preserve complete-input fingerprints and independent final review while reducing repeated loop work.
---

## Context

Issue #411 approved non-test loop preflight, review preparation, timing and
conservative reuse. The implementation extends existing CLI process handling,
scrub manifests, verification feedback and review scoring. The source contract is
[the execution plan](../../execution/plans/EXEC-PLAN-loop-optimization.md).

## Reusable guidance

- Hash both file bytes and membership. A deletion, new configuration file,
  changed checker or dependency lock can invalidate a result even if the originally
  edited file is unchanged. Unknown semantic dependency closure means execute
  fresh, not guess that a cached check remains valid.
- Keep successful check receipts immutable. A reused result retains its original
  execution time and digest. A fresh failure invalidates an older passing cache.
  Never use this cache for mutation authorization or independent approval.
- Publish cache eligibility after snapshot validation, not while individual
  checks are still running. Otherwise an aborted concurrent-edit run can leave a
  passing receipt for source bytes the checker never accepted.
- JavaScript parsing mode depends on package metadata, including ancestor
  package files. Manifest changes must invalidate receipts and select affected
  unchanged scripts, not only files already present in the implementation diff.
  Compare ancestor context to loop start, not the latest attempt: a failed check
  must not turn its changed dependency into the next retry's accepted baseline.
- Composite TypeScript projects require incremental support. Keep semantic
  verification fresh with a unique private build-info path instead of disabling
  a compiler option the project requires.
- Verify each installed helper's own dependencies. Standalone scoring helpers
  were copied to the trusted runtime tree, but scrub initially remained only in
  the workspace scripts directory.
- Normalize timestamps to UTC before deriving identity. PowerShell deserializes
  timestamps into DateTime values; hashing their serialized representation without
  normalization can split one loop across different cache directories.
- Verify generated documentation through the generator's transformations.
  Byte comparison with untransformed source incorrectly rejects intentional
  installed-path link rewrites.
- Keep expensive repeated traversal out of the PowerShell provider when a bounded
  native/Node worker is available. Check file identity during hashing and directory
  identity afterward; faster collection must not follow workspace links.
- Inspect Mocha registration syntax without importing test files. String fixtures
  and ordinary variables named `context` are not Mocha calls. Node test subtests
  have different nesting semantics.
- Attribute phase wall time explicitly. Unreported intervals are not implementation
  time, and overlapping per-check durations must not be added to phase totals.
- A capability probe describes the caller, not a different subagent. Actual
  reviewer file/diff access must be established before spending its review budget.

## Evidence boundary

The loop artifacts record real non-test commands, reuse receipts, private-profile
operational checks and independent review. Authored suites and coverage remain
unexecuted until separate post-loop consent. Local timings do not establish a
general percentage speedup or release readiness.
