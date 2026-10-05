---
description: 'Release CI lessons from preparing Frontier 9.8.0 on a long-lived branch.'
id: LEARNING-411
title: Learning 411 - Release CI Gates Fail In Sequence On Long-Lived Branches
confidence: 0.5
observations: 1
status: draft
category: workflow-contract
subcategory: release-readiness
phases: implementation,review,release
validation: reviewed
evidence: high
mode: shared
keywords: release,ci,fixture,token-budget,codeql,install-manifest,line-endings
sources: PR #439,71ceb880,2d745425,84583638,ee29ff2a,832c0792,de201165,355cc131,228301b5,e7271d17
---

**Date**: 2026-10-05
**Issue**: #411
**Category**: workflow-contract
**Confidence**: 0.5  (auto-promote at >= 0.8)
**Observations**: 1

## Summary

The 9.8.0 candidate passed local review and commit gates, but PR CI had been
red for many branch commits. Each fix exposed the next gate, because an early
failing step stopped the job before later steps ran. After the candidate
commit, eight fix commits (nine CI runs in total) were needed. In order, they
fixed: build parser dependency, lint ratchets, a stale loop fixture and plan
sections; new CodeQL alerts; token budgets; install-manifest line endings; the
always-on context budget; skill score and prompt counts; a stale stage-gate
fixture; and extension unit tests that had never run in CI.

## Guidance

- Before declaring a branch release-ready, read the latest PR CI run. A green
  local commit gate does not imply green CI.
- When a job fails early, list its remaining steps and pre-check the static
  ones locally (doc counts, reference links, token reports, skill scores) to
  avoid one-failure-per-round cycles.
- Test fixtures that copy only `frontier-cli.ps1` into an "installed runtime"
  break when the CLI loads sibling modules. Mirror the runtime directory and
  omit only the artifact under test.
- Fixing a build that never compiled in CI (CodeQL) can surface new alerts.
  Compare PR alerts with `master` alerts; fix the new ones and document false
  positives instead of silencing them.
- Restore token budgets by moving detail into topic guides or skill
  `references/`, not by deleting guidance or raising limits.
- Install-manifest hashes follow the Windows checkout. Hash files after a fresh
  `git checkout` (CRLF), not LF working copies written by scripts.

## Evidence

- PR #439 CI runs on the commits listed in `sources`; final run on `e7271d17`
  passed every check except the informational CodeQL alert result, whose only
  branch-new alerts are two documented false positives.
- Each fix was approved by an independent reviewer in a Frontier quality loop.

## Use When

- Preparing a release from a branch with many commits since its last green CI.
- Changing CLI startup dependencies, always-on instructions or skill text.

## Avoid

- Treating an unanswered test-consent prompt as approval to run suites, or
  treating unrun suites as passed.
- Updating ratchet baselines or budgets to make a gate pass.

## Promotion Path

When confidence reaches >= 0.8 with at least 3 observations, this learning is
auto-promoted to `memories/conventions.md` and may be referenced in
`.github/instructions/project-conventions.instructions.md`.

## Related

- Plan: `docs/execution/plans/EXEC-PLAN-release-9.8.0.md`
- Other LEARNING(s): `LEARNING-428-loop-cost.md`
