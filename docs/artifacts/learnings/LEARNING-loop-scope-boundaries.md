---
description: 'Verified lessons from hardening artifact-scoped engineering loop applicability.'
confidence: 0.5
observations: 2
status: draft
category: workflow-safety
---

# LEARNING-loop-scope-boundaries: Test Exemptions as Mutation Boundaries

**Date**: 2026-10-09
**Issue**: Local execution plan; no remote issue created
**Category**: workflow-safety
**Confidence**: 0.5
**Observations**: 2 independent preliminary technical reviews

## Context

Narrowing engineering loops to PRD, TechSpec, code and unit-test mutations touches
runtime writes, handoffs, staged Git contents, instructions and packaged hosts.
Initial positive applicability tests missed several exemption bypasses.

## Learning

An exemption is a mutation boundary, not a role label. Resolve aliases, classify
workspace-relative artifacts and require evidence when scope is unknown. Use the
same negative fixtures across adapters. Dedicated integration cases MUST NOT
exempt production integration code, shared helpers or protected executable tools.

## Evidence

- Independent reviews found unknown-extension defaults, hardlink aliases,
  missing handoff snapshots and workspace-location-dependent classification.
- Repairs passed 193 lifecycle parity and 455 runner checks. The runner fixture
  places a workspace beneath a scripts directory and distinguishes an exempt
  integration case from a covered shared helper.
- 175 hook checks include production hardlink write negatives. A real Git
  symlink blob/mode comparison passes; executable-bit validation remains skipped
  on Windows and requires a Unix host.
- Exact staged scope and successful acceptance consumption have dedicated tests.
  Approval remains pending; these observations are not council evidence.

## Why It Matters

Incorrect N/A decisions can silently remove pre-edit or handoff protections.
Passing happy-path suites is not enough; test the paths by which ordinary-looking
documents can mutate covered code or reuse unrelated approval.

## Promotion Path

Keep this draft below promotion confidence until final approval and independent
consumer-host confirmation. Do not promote unverified Unix behavior or claim
latency improvements without workload measurements.

## Repository Update Lessons

- The newest declared version can live on a development branch rather than the
  default branch or latest release tag. On 2026-10-09, remote `master` was 9.6.0
  while `chore/pending-agent-names-and-docs-428` declared 9.8.0. Inspect branches
  and version metadata before claiming a checkout is the newest product version.
- When gate contracts acquire bound baselines/preflight evidence, fixture
  approvals SHOULD use the real CLI lifecycle in an isolated workspace. Include
  staged executable helpers in review scope and keep temporary hook copies under
  `.git` so they cannot scan themselves as application changes.
- The 9.8 merge has syntax/type/frontmatter evidence, not fresh suite results.
  Pre-update passing counts MUST NOT be represented as validation of the merge.
- On 2026-10-12, reconciling the policy delta onto remote master 9.8.1 avoided
  duplicating development history already published through a squash merge.
  Keep the original branch, an exact backup and the unapplied stash available.
- Legacy active loops can lack newly required scope bindings even when their
  historical evidence is intact. Obtain a supported baseline transition rather
  than fabricating approval fields or rewriting historical hashes.
- Commit-only exemption needs adversarial argument inspection: no-verify flags,
  short clusters, stop-parsing tokens, composition and persistent verification
  overrides can bypass a naive command-prefix exemption. New cases are authored
  but are not claimed as executed validation.
- Independent review and actual council calls on 2026-10-12 found that raw
  PowerShell AST Extent.Text is not a semantic token value. Backtick escapes
  and stop-parsing tokens can evade raw-text Git guards. Protect the Git control
  plane and inspect semantic values; do not claim approval after syntax passes.
- Fresh digest-bound migration evidence establishes integrity, not independent
  user authority. This owner's additive adoption preserved the actual history
  and baseline hashes; general trusted-host authorization remains unresolved.
- A live provider catalog and successful independent calls are separate checks.
  GitHub Models returned plain OK, while Copilot SDK discovery worked. Three
  successful distinct selections ultimately requested changes; retain the failed
  attempt and shared-provider limitation instead of presenting execution as
  approval or assuming inference cost was zero.

## Related

- Plan: docs/execution/plans/EXEC-PLAN-loop-scope-latency-2026-10-09.md
- Evidence: .frontier/state/lp-iteration-3.md