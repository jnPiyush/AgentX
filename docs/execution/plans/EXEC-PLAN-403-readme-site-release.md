---
description: 'Execution plan for the AgentX README, public landing page, Vercel deployment, and 8.7.0 publication.'
---

<!-- Inputs: 403, README and website release refresh, 2026-08-08, GitHub Copilot -->

# Execution Plan: AgentX README, Website, and 8.7.0 Release

**Author**: GitHub Copilot
**Date**: 2026-08-08
**Status**: In Progress

## Purpose / Big Picture

Present AgentX clearly to a first-time evaluator, make the public landing page match the
verified 8.7.0 product surface, and publish the complete release through the repository's
normal attested release path. Success means the README and website agree, the Vercel
production URL is verified in a browser, the release commit passes repository and extension
gates, and GitHub publishes `v8.7.0` with the validated VSIX.

## Progress

- [x] Issue 403 created and moved to In Progress
- [x] Orbit access boundary documented
- [x] Current README, landing page, release workflow, and Vercel target reviewed
- [x] README information architecture updated
- [x] Landing page implemented and locally browser-audited
- [ ] Release artifacts rebuilt and validated
- [x] Vercel production deployment verified
- [ ] Pull request merged and v8.7.0 published

## Surprises & Discoveries

- Observation: Orbit exposes only an authenticated entry page to the agent browser.
  Evidence: The provided URL redirects to Microsoft/GitHub sign-in; no internal product
  content is publicly readable.
- Observation: The current landing page still advertises v8.4.58, 21 agents, and 111 skills.
  Evidence: `docs/ux/prototypes/landing/index.html`.
- Observation: AgentX 8.7.0 is stamped and packaged locally but is not tagged or published.
  Evidence: `version.json` reports 8.7.0 while the latest GitHub release is v8.6.1.
- Observation: The feature branch already contains the complete 8.7 work for issues 400,
  401, and 402, including uncommitted issue 402 changes.
  Evidence: branch history and working-tree status on `feature/400-cost-infra-governance`.
- Observation: Independent review found a duplicated README tail, temporary drafts, a
  non-canonical token estimate, an unlocked pitch scaffold, private-feed lockfile URLs,
  a check/use race, and missing CSP/keyboard fallbacks.
  Evidence: AgentX Reviewer findings and local gate failures before remediation.

## Alternatives Considered

1. Infer Orbit's authenticated content and copy its product narrative.
   Rejected because the content cannot be inspected and invented claims would be misleading.
2. Patch stale counts and copy in the existing landing page.
   Rejected because the page also has performance, accessibility, mobile-navigation, and
   anti-slop debt.
3. Rewrite the static landing page with verified facts and progressive disclosure.
   Chosen because it keeps Vercel deployment simple while improving speed, clarity, and
   accessibility.
4. Bump to 8.7.1 before publishing.
   Rejected because 8.7.0 has never been tagged or released; the website refresh belongs in
   that pending release.

## Decision Log

- Decision: Use Orbit only as a cue for concise positioning and a focused entry path.
  Rationale: The authenticated product body is unavailable, so AgentX claims must come from
  repository evidence.
  Date/Author: 2026-08-08 / GitHub Copilot
- Decision: Keep version 8.7.0 and publish it through a squash-merged pull request.
  Rationale: A squash merge includes the version change in the master commit, allowing the
  attested auto-release workflow to create and package the release.
  Date/Author: 2026-08-08 / GitHub Copilot
- Decision: Replace Tailwind CDN and remote fonts with self-contained semantic HTML/CSS/JS.
  Rationale: The public static page needs deterministic rendering, lower dependency risk,
  better performance, and stronger CSP readiness.
  Date/Author: 2026-08-08 / GitHub Copilot

## Context and Orientation

- Main product narrative: `README.md`
- Public Vercel output: `docs/ux/prototypes/landing/`
- Vercel project: `agentx` (`prj_fzVWsWMwdCmo0yb6NNnKdomb7e98`)
- Release version source: `version.json`
- Version synchronizer and VSIX packager: `scripts/stamp-version.js`
- Release automation: `.github/workflows/auto-release.yml`
- Marketplace publication: `.github/workflows/publish-marketplace.yml`

## Plan of Work

1. Rewrite the README around product promise, proof, workflow, specialist roles, platform
   support, security, installation, and contributor navigation.
2. Replace the public landing page with a workflow-led page using verified release facts,
   accessible navigation, a clear installation path, and no invented metrics.
3. Update the landing UX specification and release notes to match the implementation.
4. Run browser checks at mobile and desktop widths, keyboard interaction, axe, route/link,
   console, content, and anti-slop checks.
5. Rebuild extension assets and the 8.7.0 VSIX, then run release, installer, security, and
   framework validation.
6. Deploy the static output to Vercel production and verify the production URL.
7. Commit and push the branch, open and squash-merge a pull request, verify automated tag,
   GitHub release, attestations, VSIX upload, and Marketplace publication.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | README restructure | GitHub Copilot | Complete | Verified repository facts only |
| 2 | Landing page implementation | GitHub Copilot | Complete | Same-origin static assets, responsive, accessible |
| 3 | Browser and content audit | GitHub Copilot | Complete | Desktop, mobile, keyboard, axe; rerun after review fixes |
| 4 | Release validation and package | GitHub Copilot | In Progress | v8.7.0 remains canonical |
| 5 | Vercel production deployment | GitHub Copilot | Complete | `https://agentx-silk.vercel.app` |
| 6 | Independent review | AgentX Reviewer | Complete | APPROVED: 0 HIGH, 0 MEDIUM, 0 LOW |
| 7 | Commit, merge, and publish | GitHub Copilot | Not Started | Attested automation path |

## Validation and Acceptance

- [x] README has a clear 60-second evaluation path and current feature matrix
- [x] Landing page contains only verified claims and no stale release counts
- [x] Landing page has skip link, landmarks, focus states, mobile navigation, and reduced motion
- [x] No serious/critical axe findings and no browser console errors in local validation
- [x] Primary links and copy interaction work in local validation
- [ ] Repository, extension, installer, skill, and dependency gates pass
- [x] Vercel production URL serves the new content
- [ ] v8.7.0 GitHub release contains the final VSIX and evidence artifacts

## Idempotence and Recovery

The site is a static directory and can be redeployed safely. Vercel retains prior deployments
for rollback. The release automation targets a version tag exactly once; do not recreate or
move `v8.7.0` after publication. If release automation fails before tag creation, repair and
rerun on the same commit. If it fails after tag creation, repair the workflow and rerun the
failed package job without changing the tagged source.

## Rollback Plan

- Vercel: promote the prior production deployment through the Vercel dashboard/CLI.
- README/site: revert the release commit and redeploy.
- GitHub release: never move the tag; publish a patch release if a defect is found after
  v8.7.0 becomes public.

## Artifacts and Notes

- Orbit review boundary: authenticated entry page only; no internal features inferred.
- Existing 8.7.0 VSIX will be replaced by a package built after the README/site refresh.
- Reviewer blockers remediated locally: canonical token gate, production-only dependency
  classification, portable lock regeneration, direct read/catch stamping, canonical README,
  temporary-file cleanup, CSP, Escape focus restoration, and real selection fallback.
- Fresh live-surface verification: axe-core 4.12.1 reported 0 violations; viewport checks
  at 360, 640, 1024, 1440, and 1920 CSS pixels reported no horizontal overflow; keyboard
  Enter/Escape toggled the mobile menu and restored focus; clipboard success announced the
  copy, while simulated clipboard denial selected the exact install command for manual copy.
- Production deployment verification: `https://agentx-silk.vercel.app` returns HTTP 200,
  serves AgentX 8.7.0 plus `site.js` and `site.css`, applies the same-origin CSP and frame
  denial headers, redirects `/v2` to `/`, passes axe-core with 0 violations, and preserves
  responsive layout, Escape focus restoration, and clipboard selection fallback.
- Final independent source review: APPROVED with 0 HIGH, 0 MEDIUM, and 0 LOW findings after
  reproducing current README count checks, public-registry lock URLs, canonical README end,
  whitespace checks, and final-LF checks across all 56 changed or untracked text files.

## Outcomes & Retrospective

The README and public landing now present one verified 8.7.0 narrative, the canonical Vercel
site is live with strict security headers and accessible interactions, and independent review
closed with no findings. Release publication remains a post-merge automation step; source
readiness and production-site readiness are complete without claiming unpublished artifacts.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
