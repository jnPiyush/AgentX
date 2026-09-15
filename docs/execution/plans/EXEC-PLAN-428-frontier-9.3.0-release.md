---
title: Frontier 9.3.0 Manual Release Preparation
description: Validation, commit, push and manual-publish package preparation for the Frontier rebrand and collaboration companion.
---

## Purpose / Big Picture

Commit and push the intentional Frontier rebrand and Teams/GitHub companion,
prepare version 9.3.0 for manual publishing, and preserve unrelated drafts. The
Marketplace coordinate stays `jnPiyush.agentx`; no Marketplace publish command
will run. Pushing master can trigger the existing GitHub release workflow.

## Alternatives Considered

1. Reuse 9.2.0. Rejected because it is already released and immutable.
2. Commit only the companion. Rejected for this delivery because its documented
   runtime depends on the pending Frontier names and launchers.
3. Validate the complete intentional change set and prepare 9.3.0. Selected.

## Progress

- [x] Inspect current manifests, worktree and release automation
- [x] Start a release-scoped high-risk loop with existing changes included
- [x] Stamp 9.3.0 and regenerate distribution assets
- [x] Pass release tests and independent review
- [ ] Commit and push the validated source
- [x] Commit and push the primary rebrand and collaboration source as f17c505d
- [ ] Commit the immutable 9.3.1 packaging follow-up
- [x] Prepare and inspect manual-publish packages
- [ ] Record final hashes, commands and unresolved external prerequisites

## Decision Log

- User delegated routine release decisions while unavailable. Use 9.3.0 on the
  existing master branch, retain compatibility coordinates, and do not publish
  to Marketplace automatically.
- Exclude the unrelated `docs/artifacts/reviews/agentx-issues.md` and
  `prompts/ai-coding-harness-development.md` drafts and the temporary
  `scripts/migrate-frontier-brand.ps1` helper from staging and packaging.
- Do not include local runtime state, secrets, dependencies, compiler logs or
  historical build artifacts in release archives.

## Context and Orientation

Canonical version: `version.json`. Stamping and bundle generation:
`scripts/stamp-version.js`. Extension: `vscode-extension/`. Collaboration:
`companions/collaboration/`, with the existing WhatsApp runner dependency.
Issue 428 originally described HVE; the user's subsequent Frontier Corp request
and `docs/BRAND.md` supersede that product name.

## Plan of Work

Stamp the version, test the extension, framework, MCP and collaboration scopes,
inspect package contents, perform independent reviews, stage only intended
changes, complete the five-pass quality loop, commit with normal hooks, and push
without force. Keep the attested release asset preferred for manual Marketplace
publishing; label a local candidate honestly if remote automation is unavailable.

## Concrete Steps

- `node scripts/stamp-version.js --set 9.3.0`
- `npm --prefix vscode-extension run test:coverage`
- `npm --prefix companions/collaboration run test:coverage`
- `npm --prefix .agentx/mcp-server test`
- `pwsh tests/test-framework.ps1`
- Run focused migration, audit, package, scrub and source-hash checks.

## Validation and Acceptance

- New version is consistent across source and final VSIX manifests.
- All required tests pass on the final source; independent review is hash-bound.
- Source push is non-forced and remote commit identity is verified.
- Final archives have recorded SHA-256 values and no local data or secrets.
- Manual publishing instructions identify the exact package and retain the
  operator-gated Teams/GitHub live-validation limitation.

## Idempotence and Recovery

Do not overwrite released artifacts or delete unrelated user changes. Regenerate
only derived assets. Keep failed-check evidence and repair local defects before
retrying. If push diverges, stop rather than force-push. If GitHub release
automation is blocked, report the block and retain the inspected local package.

## Surprises & Discoveries

- Pending changes span canonical sources and generated Frontier assets. The
  prior collaboration-only approval is insufficient for the full release.
- Independent release review found missing-state migration, runtime ignore and
  same-major installer-force regressions. Repairs now preserve existing Frontier
  files, merge missing HVE then AgentX state, use a shared exclusive migration
  lock and promote fully copied files before recording completion. A stale
  `.frontier-migration.lock` requires checking for active migrations before
  manual recovery; retries never replace existing destination files.
- Further review removed destructive legacy uninstall cleanup entirely.
  Upgrades now require explicit force for every differing version, retain files
  absent from the release and preserve runtime data. Force still authorizes
  replacement of release-provided files; operators must back up customizations.
- Default VSIX naming remains `agentx-9.3.0.vsix` to match release attestation,
  upload and manual-publishing consumers. Product display branding is Frontier.

## Verification Results

- Extension: 1,063 tests, 82.72% lines, 75.55% branches, 80.82% functions.
- Framework: final visible run passed 250/250 after installed-pack fixes.
- Migration: 86/86, including pre-existing marker-staging aliases in both runtimes.
- Installers: 63/63, including v8/v9 refusal, real forced Bash/PowerShell
  refreshes, real pack installs with HVE config/status, and the exact documented
  `.agentx/frontier.ps1 loop start` command in both shells.
- Collaboration: 29/29, 93.35% lines, 89.74% branches, 91.01% functions.
- MCP smoke: 19 tools and successful loop-status probe.
- Runtime audits: extension and collaboration zero vulnerabilities; MCP has two
  moderate transitive advisories (hono and qs), no high/critical vulnerabilities.
  MCP is stdio-only; HTTP framework advisory exposure is not introduced here.
- PowerShell analysis: no production security findings; ratchet passes, 74
  findings against the existing 80 baseline. The baseline was not increased.
- Scrub: collaboration zero findings; extension zero HIGH, 542 advisory duplicate
  patterns. Broad duplicate refactoring is outside this identity release.
- Live Teams/GitHub delivery and Marketplace publishing remain operator-gated.
  The loop test-count baseline is unset; reported counts are executed results,
  not a claim that the optional count-regression gate ran.
- Release-wide review caught missing documented launcher wrappers and pack
  initialization masking HVE metadata. Both pack installers now call the guarded
  runtime migration before creating defaults. Existing config is preserved and
  the extension watches Frontier/HVE/AgentX config changes.

## Historical 9.3.0 Candidates

Do not publish these VSIX bytes: the remote 9.3.0 tag identifies different source.
The unchanged companion archive remains valid for the collaboration feature.

- VSIX: `build/manual-publish/agentx-9.3.0-candidate.vsix`, 4,240,366 bytes,
  SHA-256 `DCEEE9B507124C86F37605C7A6FB7272AA683D3A88F2D19D65AFCF6A03B89ABB`.
  Inspected 1,640 entries, 26 FDEs and all 200 registered contributions. This is
  a local candidate, not a GitHub-attested artifact.
- Companion: `build/manual-publish/frontier-collaboration-9.3.0.zip`, 44,872 bytes,
  SHA-256 `0C6D90D10C24F007A423DFCB1555577607FB846873366DEB3EC22DA3C80F4C38`.
  All 21 explicit source entries match source hashes; no installed dependencies
  or credentials are included. Target-workspace CLI and live provider setup are
  still required.

## Artifacts and Notes

Evidence: final framework `pwsh tests/test-framework.ps1` returned 250/250;
`build/release-9.3.0-installed-launchers-final.log` records 63/63;
`build/release-9.3.0-review-approved.json` binds 182 implementation files and
passes the code-quality validator at 84/100 (83.75 unrounded), no HIGH/MEDIUM.

Release validation logs and candidate archives live under `build/`. They are not
source-code changes and are excluded from commits.

## Outcomes & Retrospective

The initial five-pass release loop completed. The first normal commit attempt
was blocked: the renamed generated bundle had been staged because its ignore
rule still used AgentX, and policy deny-list data triggered executable-command
scanning. The bundle now remains generated and ignored, matching the prior
tracking convention. Exact Frontier policy-data exclusions retain executable
sibling checks. Canonical hooks were installed through the CLI; no hook bypass
was used. Hook behavior passes 43/43 and all six staged Python files pass
`black --check` after the hook's formatting. A fresh follow-up loop and independent
hash-bound review cover this final source. Commit and push remain pending.

## Immutable Version Follow-Up

Primary source commit `f17c505d1d3007b98a09446160aa55b82132787e` was pushed to
master. Normal hooks passed. The release workflow skipped packaging because
remote tag `v9.3.0` already points to `1c9891f122e2e4d95aa52f61a0e77436138c05b4`.
It has no matching GitHub release. Do not move that tag or publish the local
9.3.0 candidate under it. Version 9.3.1 was checked unused and selected for the
manual-publish follow-up; only stamp-controlled version surfaces change.

Evidence: normal commit/push succeeded; extension and collaboration runtime
audits pass. Remote repository-wide Dependency Scanning reports five HIGH
advisories in the separate WhatsApp companion. OpenSSF Scorecard cannot pull its
upstream image because the upstream registry requires billing. These are
disclosed, not waived or silently described as green.

## Current Manual Handoff

Version 9.3.1 local candidate: `build/manual-publish/agentx-9.3.1-candidate.vsix`,
4,240,369 bytes; SHA-256
`1944C64B046A8F4A109CD0BEAB1C384AB50464D966D499EA5962A1D1E3E4BC9A`.
Inspection validates all 200 contribution paths, 26 FDEs and 1,640 entries.
Use a verified GitHub-attested asset instead when release automation produces it.

Evidence: the 9.3.1 extension rerun passed 1,063 tests with unchanged coverage;
installer checks passed 63/63; independent version-only review approved at
92.5/100 across seven exact implementation hashes, zero HIGH/MEDIUM findings.
The companion source ZIP is unchanged from the historical package section.
No Marketplace publish command or live provider activation ran.