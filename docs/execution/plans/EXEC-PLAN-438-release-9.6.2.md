---
title: Frontier 9.6.2 Release Assembly
description: Commit the approved work, package the exact source, and prepare a manual-publishing candidate without bypassing protected approval.
---

**Author**: Frontier DevOps
**Date**: 2026-09-28
**Status**: In Progress; public release blocked on required review

## Purpose / Big Picture

Deliver the accumulated minimal-initialization, README-rendering, post-loop
test-consent and advisory-lint changes as a committed 9.6.2 candidate. The user
requested a commit, push, VSIX and GitHub release for manual Marketplace upload.
Tracking uses issue #438 and PR #439, which already carries the preceding
duplicate-agent correction.

## Progress

- [x] Repo and existing release workflow inspected.
- [x] Current Marketplace version and absent 9.6.2 tag checked.
- [x] Prior local 9.6.2 candidate preserved outside the source tree.
- [x] Validation scope and protected-approval boundary established.
- [x] Latest 9.6.2 package built, with all 200 contributions and both consent policies.
- [x] Build, 635 schema checks, 307-entry manifest and dependency thresholds checked.
- [ ] Final package/source review and Git transport completed.

GitHub PR/release state and the delivery commit are authoritative for transport
and publication status; a checked-in plan is not proof of a successful push.

## Surprises & Discoveries

- PR #439 is still open with `REVIEW_REQUIRED`. The currently successful checks
  belong to its older head, not these pending changes.
- New README diagram URLs remain unavailable on `master` until reviewed source
  is merged. A package containing images does not publish their GitHub URLs.
- A canonical draft `v9.6.2` could collide with the existing automatic release
  creation step. Use a separate draft candidate tag while approval is pending.

## Alternatives Considered

- Directly publish `v9.6.2` from the feature branch: rejected because it would
  avoid the protected source/release path.
- Stop without committing or packaging: rejected because local preparation and
  a normal feature-branch push are explicitly authorized.
- Commit/push the existing PR branch and attach the VSIX to a draft
  `v9.6.2-rc.1` candidate: selected. The VSIX itself remains version 9.6.2.

## Decision Log

- Preserve all earlier local package bytes as historical candidates.
- Use existing stamping/packaging and Git hooks, not bypass flags.
- Do not run local suites inside the loop/review or apply lint cleanup.
  Offer suites afterward; independent CI and commit rules remain in force.
- Marketplace upload and installation are not authorized by this request.

## Context and Orientation

- Canonical version: `version.json`; packaging: `scripts/stamp-version.js`.
- Extension package and README: `vscode-extension/`.
- Runtime/policy changes: `.frontier/runtime/`, `scripts/scrub.ps1`,
  `.github/AGENT-PROTOCOL.md`, agents, skills, registries and review rubrics.
- Branch: `chore/pending-agent-names-and-docs-428`.

## Pre-Conditions

- [x] Existing issue and PR identified.
- [x] Prior independent reviews exist for the constituent changes.
- [x] Required tooling and existing dependencies available.
- [x] Multi-file commit requires this execution record.
- [ ] Required code-owner approval for protected merge.

## Plan of Work

Consolidate release notes, synchronize bundled assets and create a fresh local
VSIX. Use non-test checks, dependency metadata/audits and source/archive
inspection. Obtain a current aggregate review before committing. Push normally,
update PR #439 and observe its new CI results. Create a draft candidate with the
exact package/checksum and clearly disclose remaining publication gates.

## Steps

| Step | Owner | State | Acceptance |
| --- | --- | --- | --- |
| Release notes and version consistency | DevOps | Complete | Current first-party metadata and notes say 9.6.2 |
| Local build and package inspection | DevOps | Complete | Identity, 200 contributions, 160 cores and 127 compiled files verified |
| Independent review and loop completion | Reviewer / owner | Pending | Current approval and honest unrun-suite status |
| Commit and push | DevOps | Pending | Hooks pass; remote branch matches commit |
| Candidate and protected publication | DevOps / code owner | Blocked for public release | Draft assets available; canonical release waits for approval and CI |

## Concrete Steps

Use `node scripts/stamp-version.js --package-vsix --vsix-output <path>` for the
new artifact. Verify hashes, manifests, bundled contributions and README URLs.
Use ordinary `git add`, `git commit` and `git push`, preserving all hooks.
Use `gh pr edit 439` and `gh release create ... --draft --prerelease --target
<exact-commit>` for the candidate. Do not force-push or override review protection.

## Blockers

| Blocker | Impact | Resolution |
| --- | --- | --- |
| Required review on PR #439 | No protected merge or canonical public release | Obtain legitimate code-owner approval |
| Source images not yet on master | Marketplace README images would remain broken | Merge reviewed assets before Marketplace upload |
| No current CI for the new commit yet | No release certification claim | Observe the checks triggered by the normal push |

## Validation and Acceptance

- [x] New VSIX identifies `jnPiyush.agentx@9.6.2` and matches the reviewed worktree.
- [x] Previous local candidate remains preserved.
- [x] No local suite execution or cosmetic cleanup during preparation.
- [ ] Commit and remote head agree.
- [ ] Draft candidate has the verified VSIX/checksum and accurate limitations.
- [ ] Public release waits for required approval and CI.

## Idempotence and Recovery

Check tag/release existence before creation. Never replace a published artifact.
Inspect existing draft assets and their digests before retrying uploads. A failed
push or hook is investigated without disabling safeguards.

## Rollback Plan

No installation occurs. Retain the former local VSIX for comparison. After a
push, use a reviewed corrective commit rather than rewriting remote history.
Do not delete a draft/release without confirming its exact identity and scope.

## Artifacts and Notes

The local output is `dist/vsix/agentx-9.6.2.vsix` with a checksum and publishing
handoff. Detailed command logs, source hashes and review reports are retained in
the session's `publish-9.6.2` evidence directory. Existing learning captures cover
minimal initialization, README rendering, test consent and lint cleanup consent.

## Outcomes & Retrospective

Source assembly is authorized; publication is not inferred from local checks.
Read the final GitHub PR/draft and delivery summary for actual completed steps
and remaining gates.

The extension production audit reports no vulnerabilities. The separate MCP
dependency graph reports one existing MODERATE `ip-address` advisory and no
HIGH/CRITICAL findings; the configured high-severity audit gate passes. This is
not cosmetic lint, is not reclassified as LOW, and is not silently upgraded in
this release assembly. Behavioral suites remain unrun locally at this point.
