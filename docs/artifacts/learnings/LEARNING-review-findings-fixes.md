---
title: Recovery paths and failure isolation matter as much as fail-closed gates
description: Lessons from fixing the post-delivery review of guided interaction, repository graph, workspace state and Cursor integration.
---

## Context

Issue #411. A read-only review of the pushed work (commits `b07ee1fe` and
`a00a2813`) found no security-boundary failures but several dead ends and scaling
defects. Source: the review findings recorded in
`docs/execution/plans/EXEC-PLAN-review-findings-fixes.md` and this task's
independent review evidence in the quality loop.

## Reusable guidance

- Every fail-closed marker needs an owner record and a recovery path. A lock file
  that only the crashed process could remove becomes a permanent outage. Record
  the owner pid and creation time; treat exited owners or reused pids as stale;
  remove stale markers only while holding the exclusive lease that creates them.
- Pid reuse must fail toward blocking. When liveness is uncertain (inaccessible
  process, unparseable record that may be mid-write), keep the marker and offer an
  explicit recover command instead of guessing.
- Sanitizers run on untrusted text, so their regexes must be linear. Truncate
  before matching and avoid overlapping alternatives such as
  `(?:\\.|(?!\1).)*?`; use `[^"\\]|\\.` style classes.
- Batch work needs per-item failure isolation with a bounded retry budget. One
  bad input must degrade only its own result, not the whole publication.
- Replace nested `Where-Object` pipelines over edges with single-pass
  dictionaries; verify the rewrite by comparing serialized output on a real graph.
- Hardening one regex can silently weaken another: a "safer" secret pattern that
  excluded backslashes stopped blocking escaped quotes. Review every pattern change
  for detection coverage, not only for performance.
- Per-tool-call hooks should not start PowerShell. Cache the resolved runtime in
  ignored state, invalidate it when the launcher changes, and start the policy
  engine only for tools that need policy.
- Migrate previous hook commands when changing a host hook entry, or the old and
  new hooks both run.
- User-facing hints must round-trip through the parser that consumes them; a
  quoted example (`continue "approve"`) was silently treated as a revision.
- Catalogs should skip unsupported entries with a warning instead of failing the
  whole listing, while explicit installs still surface the specific error.
- Package-manager updates on machines with private feeds can rewrite `resolved`
  URLs; normalize lockfiles to the public registry before committing.

## Evidence boundary

Bounded probes and static checks were run. Test suites and the held-out graph
evaluation were not run during the loop; they require explicit user consent.
