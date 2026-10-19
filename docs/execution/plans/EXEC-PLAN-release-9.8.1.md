---
title: Frontier 9.8.1 Release
description: Repair verified PR 439 release blockers without weakening protected delivery gates.
status: in-progress
---

## Purpose / Big Picture

Prepare version 9.8.1 on the existing PR #439 branch, merge into master through
normal protection, and let the release workflow create v9.8.1 after preflight.
The user approved repairs to CI, audited dependencies and version metadata.
Preserve the unrelated untracked ARIA assessment documents and installed assets.

## Decision Log

* Prefer scoped source fixes over relaxing the ESLint baseline, plan validator,
  dependency thresholds or branch protection.
* Use the existing version stamper after repairing its stale guide assumptions.
  Do not tag 9.8.0 bytes as 9.8.1 or create a tag before release preflight.
* Select patched dependency versions from actual audit evidence; avoid forceful
  bulk upgrades. Reuse lockfiles and existing version/packaging scripts.
* Local tests need separate post-loop consent; automated CI and release tests
  remain mandatory. Master requires one code-owner approval.

## Plan of Work

1. Repair execution-plan headings, version-stamping ownership and six lint errors.
2. Update only audited vulnerable runtime dependencies and relevant lockfiles.
3. Stamp 9.8.1, update release notes, regenerate bundle and inventory.
4. Validate syntax, lint, audit, version and packaging contracts; obtain final
   independent approval and complete the local loop.
5. Offer focused tests, commit/push, update PR 439 and inspect its new CI results.
6. Merge only when required checks and code-owner approval are satisfied; verify
   release preflight and v9.8.1 target without bypassing blocked gates.

## Validation and Acceptance

Validation command: `pwsh scripts/check-harness-compliance.ps1 -BaseRef master`

The ESLint ratchet must show no new findings. Version stamping must finish and
preserve installer verification. Runtime audits must show zero high/critical
findings. Versioned surfaces and packaged assets must agree on 9.8.1; strict
inventory verification must pass. CI results must apply to the final PR head.
Do not claim merge, tag creation or test passes without observed evidence.

## Progress

* Baseline: 137886fa; PR 439 is blocked and master remains fc39b297.
* Confirmed failures: plan schema, six curly findings, guide preflight in the
  stamper, and two high/two critical runtime audit findings across three projects.
* Required master protection: one code-owner approval, stale approvals dismissed.
* Repaired plan schema and obsolete stamper assumptions; the current-version
  stamper completes. README publication history and guide safety text are intact.
* Fixed six curly findings. ESLint ratchet passes without baseline updates;
  extension typechecking passes with the patched SDK.
* SDK 1.32.0 and proxy-addr 2.0.8 resolve all three runtime audits to zero findings.
  New lock entries retain their downloaded integrity hashes with canonical public
  URLs; direct public-registry access hit local TLS failure, so CI must confirm
  clean installation. No TLS bypass or global npm settings change was made.
* Stamped source and bundled package versions to 9.8.1. Final inventory, security
  checks, independent review, new CI and code-owner approval remain pending.
* Harness compliance against master now passes. Full runtime audit found an
  additional optional WhatsApp brace-expansion finding; updated its existing
  2.x override to 2.1.7 and verified that manifest's audit is clean.
* PR 450 merged at 629e83d7 after all checks passed on 8bb11d3f. Release run
  38060260841 then stopped before tagging: its MCP fixture omitted the required
  workspace-state.ps1 module (28 passed, 1 failed).
* Recovery adds the fixture dependency and runs the MCP suite/audit in PR CI.
  An absent source-version tag retries the same release preflight on the next
  master push; existing tags stay immutable and publication still needs success.

## Artifacts and Notes

Evidence: PR 439 checks on 137886fa; runs 37995035783 (quality), 37995035810
(SAST) and 37995035687 (dependencies). Earlier passing CI is not evidence for
the final release revision. Release tag v9.8.1 was absent when work began.
Evidence: `build/release-9.8.1-blockers.json` and
`build/release-9.8.1-audits.json` record local checks, not suite execution.