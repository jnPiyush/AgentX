---
description: 'Execution plan for the AgentX 8.7.1 patch release.'
---

<!-- Inputs: 8.7.1 patch release, 2026-08-08, GitHub Copilot, AgentX Auto -->

# Execution Plan: AgentX 8.7.1 Patch Release

**Author**: GitHub Copilot
**Date**: 2026-08-08
**Status**: In Progress

## Purpose / Big Picture

Publish an immutable `8.7.1` patch release containing only the release recovery,
provenance, and packaging fixes merged after `8.7.0`. Success means the source is
merged through review, GitHub publishes attested artifacts from that source, the
downloaded VSIX matches its manifest and provenance, and Marketplace publication
uses those exact bytes.

## Progress

- [x] Release issue 409 created and classified
- [x] Post-8.7.0 commits and release scope reviewed
- [x] Patch version stamped across canonical and bundled release surfaces
- [x] Windows CRLF package-lock stamping regression fixed and tested
- [x] Local 8.7.1 release-candidate VSIX packaged
- [x] Full source, extension, MCP, audit, and scoped scrub gates pass
- [x] Independent subagent re-review reports zero technical HIGH/MEDIUM findings
- [ ] Pull request passes CI and is merged
- [ ] GitHub release artifacts and attestations are verified
- [ ] Marketplace publication succeeds or an external credential blocker is recorded

## Surprises & Discoveries

- Observation: the first canonical patch stamp failed on the Windows checkout.
  Evidence: `updatePackageLock()` required LF-only separators while the lockfile
  used CRLF. The operation changed two files before failing.
- Observation: the stamper custom output option requires explicit packaging.
  Evidence: `--vsix-output` is rejected unless `--package-vsix` is also supplied.
- Observation: independent review found that wildcard Marketplace artifact selection
  and linear-only version detection weakened release guarantees.
  Evidence: review required an exact filename plus embedded identity/version check,
  and merge-parent-aware `git diff-tree` detection.

## Decision Log

- Decision: publish `8.7.1` as a patch release.
  Options Considered: reuse `8.7.0`; publish `8.8.0`; publish `8.7.1`.
  Chosen: `8.7.1`.
  Rationale: released bytes are immutable and the changes are backward-compatible
  release-pipeline fixes, so SemVer requires a patch increment.
  Date/Author: 2026-08-08 / GitHub Copilot.
- Decision: fix the CRLF defect instead of editing the lockfile manually.
  Options Considered: normalize the worktree to LF; manually stamp the lockfile;
  make the stamper EOL-neutral.
  Chosen: EOL-neutral stamper with LF and CRLF regression coverage.
  Rationale: release tooling must work deterministically on supported Windows and
  Linux environments without relying on checkout-specific line endings.
  Date/Author: 2026-08-08 / GitHub Copilot.

## Context and Orientation

The canonical version is in `version.json`. `scripts/stamp-version.js` synchronizes
the extension, MCP package, pack manifests, installer URLs, public docs, landing
page, and bundled extension assets. `.github/workflows/auto-release.yml` creates a
release when the stamped version commit reaches `master`, packages the VSIX and MCP
archive, generates SBOMs, and creates attestations. The Marketplace workflow then
downloads and verifies the release VSIX before publishing it.

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked; `v8.7.0` exists and `v8.7.1` does not
- [x] Release, version-control, testing, review, verification, scrub, documentation,
  iterative-loop, and Karpathy guidance loaded
- [x] Complexity assessed as multi-phase release work

## Plan of Work

Stamp the patch version with the canonical tool, preserve a focused changelog,
validate generated and hand-edited surfaces, complete the five-pass quality loop,
review through a pull request, merge only after CI, then verify the immutable
release artifact before dispatching Marketplace publication.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Establish release scope and issue | GitHub Copilot | Complete | Issue 409 |
| 2 | Stamp and package 8.7.1 | GitHub Copilot | Complete | Candidate under build/ |
| 3 | Run release validation | GitHub Copilot | Complete | Source, extension, MCP, audit |
| 4 | Independent review and PR | GitHub Copilot | In Progress | Technical re-review approved; loop close and PR pending |
| 5 | Verify release and publish | GitHub Copilot | Not Started | Exact attested VSIX |

## Concrete Steps

1. Run the focused stamp regression and framework suite.
2. Run extension coverage and production dependency audit.
3. Run MCP tests and runtime audit.
4. Run frontmatter, reference, PSScriptAnalyzer, and production scrub gates.
5. Inspect package version and candidate hash.
6. Complete the quality loop, commit, push, open and merge a PR after CI.
7. Wait for the GitHub release, download it, verify provenance and manifest.
8. Dispatch Marketplace publication and verify its workflow result.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Marketplace PAT may still be expired | Marketplace upload cannot complete | Attempt only after artifact verification; report external credential failure without exposing or requesting the secret in chat | Open |

## Release-Owner Waivers

- Production scrub reports legacy `duplicate-logic` findings in
  `scripts/stamp-version.js` and `tests/test-framework.ps1`. Review of the diff
  confirms none intersect the EOL-neutral regex change or the new test invocation.
  Refactoring those declarative update/check lists would expand this patch release
  without changing its acceptance criteria. The new regression fixture was
  simplified until its production scrub result reached zero findings.

## Validation and Acceptance

- [ ] Canonical and bundled version surfaces report `8.7.1`
- [ ] Full source and extension gates pass on the release commit
- [ ] GitHub release artifact provenance and manifest verify
- [ ] Marketplace workflow succeeds, or its external credential failure is recorded accurately

## Idempotence and Recovery

Version stamping is rerunnable with `--set 8.7.1`. Release creation checks whether
the tag already exists. Marketplace publication downloads the existing release
artifact and must not rebuild it. If any gate fails before merge, fix on the release
branch and rerun. If release packaging fails after merge, use the fixed-source
recovery workflow against the immutable tag.

## Rollback Plan

Do not alter or delete `v8.7.0`. Before merge, abandon the release branch if needed.
After publishing `v8.7.1`, correct any defect in a new `8.7.2` release rather than
mutating the tag or release assets.

## Artifacts and Notes

- Local candidate: `build/release-candidate/agentx-8.7.1.vsix`
- GitHub issue: `https://github.com/jnPiyush/AgentX/issues/409`

## Outcomes & Retrospective

Pending release validation and publication.
