---
title: Frontier 9.8.0 Release Preparation
description: Stamp, document, package and validate the 9.8.0 candidate without publishing it.
---

**Issue**: #411
**Date**: 2026-10-05
**Status**: Marketplace 9.8.0 published; GitHub v9.8.0 tag/release and PR #439 merge remain pending

## Purpose / Big Picture

The results below describe the October 5 package, recorded at `d9f9b4f4`, not
later branch commits. The [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jnPiyush.agentx)
published 9.8.0 at 2026-10-06T00:42Z; its VSIX matches the retained local package.
Blueprint changes in `ba376c5b` remain Unreleased and need a new version for
Marketplace delivery. Do not rebuild later source as a replacement for the
already published 9.8.0 package.

Prepare the accumulated guided-execution, graph v2, automatic-workspace,
loop-optimization, companion and audit-correction work as a releasable 9.8.0
candidate. Publication, tagging, Marketplace upload and merging PR #439 are
not part of this task.

## Decision Log

- Version 9.8.0. 9.7.0 was packaged and installed locally but never tagged, so
  reusing it would make two different builds share one version. Strict SemVer
  could justify 10.0.0 for the removed AgentX/HVE aliases. 9.8.0 was chosen
  because the extension ID and repository coordinate are unchanged, the
  supported upgrade path is documented, and bundled plugins declare
  `<10.0.0`. The alias removal is recorded as an upgrade note.
- Close the review's model-deadline risk with one finite 600-second constant for
  Anthropic and Claude Code calls. The pre-existing Copilot/OpenAI 120-second
  request deadline is unchanged.
- Parse GitHub JSON reads from stdout records only, because the shared GitHub
  wrapper merges stderr.
- Use the existing `scripts/stamp-version.js` stamping and packaging path.
- Install-manifest membership is unchanged; its version and hashes are refreshed
  and strictly verified. Packaging also regenerated the extension's chat prompt
  contribution list, adding the committed `guided-interaction.prompt.md` entry
  that the previous commit's generated `package.json` omitted.
- A successful `gh` exit with no stdout JSON is an explicit read failure, not an
  empty backlog or blank issue.
- CI on the pushed candidate exposed five pre-existing branch blockers; each is
  fixed at its cause instead of by raising a baseline:
  - The extension build requires the managed graph parser, but clean CI
    checkouts never installed it. An extension `postinstall` now runs a locked
    `npm ci --ignore-scripts` for the parser, so every workflow that installs
    the extension builds it.
  - New ESLint `no-control-regex` findings: the ASCII path test uses
    `\p{ASCII}` with the same semantics.
  - New PSScriptAnalyzer findings: automatic-variable names were renamed; the
    two ordinal (case-sensitive) manifest tables keep their comparer with a
    justified suppression.
  - The missing-evaluator loop case failed because `loop complete` ran its
    preflight before looking for the evaluator; the tool fingerprint cannot
    match an install without it. `loop complete` now reports a missing
    evaluator first, and the fixture mirrors an installed runtime that lacks
    only the evaluator.
  - Branch execution plans now use the canonical harness sections.
- With the build fixed, CodeQL analyzed the branch for the first time and
  reported 8 alerts absent from `master` (63 older alerts there are out of
  scope). Six are addressed in code, and the next CodeQL analysis on PR #439
  must confirm closure: three size-bounded reads now use one descriptor
  (`readBoundedUtf8`), the agent status file is created with `wx`, the plugin
  catalog warning logs a single-line reason, and a dead assignment is removed.
  The two `js/remote-property-injection` alerts in the collaboration service
  are false positives: every key is `JSON.stringify([scope, actor, id])`,
  which starts with `[` and cannot name a prototype property. Changing the key
  format would invalidate persisted delivery deduplication, so they are
  documented rather than changed.

## Plan of Work

| Step | State | Acceptance |
| --- | --- | --- |
| Review-risk fixes and regression cases | Complete | Probe and syntax checks pass |
| Version stamp and release notes | Complete | All stamped surfaces report 9.8.0 |
| VSIX package and inspection | Complete | `jnPiyush.agentx@9.8.0`; bundled runtime matches source |
| Dependency audits | Complete | Extension and MCP runtime audits report 0 vulnerabilities |
| Independent review and loop completion | Complete | Approved 96/100, zero HIGH/MEDIUM |
| Release validation suites | Not run | Post-loop consent unanswered; CI is authoritative |
| Commit, push and PR update | Complete | `71ceb880`; PR #439 retitled for 9.8.0 |
| CI blocker fixes | Complete | Every PR #439 job passes on `e7271d17`; CodeQL alert result lists two documented false positives |

## Progress

- [x] Candidate stamped, packaged, reviewed and pushed as `71ceb880`.
- [x] CI failures on `71ceb880` triaged to five causes.
- [x] CI blocker fixes pushed as `2d745425`; CodeQL build, PSScriptAnalyzer and
      both Quality Loop jobs passed. The other jobs were cancelled while still
      queued (runner capacity) and never ran; Dependency Scan Summary then
      failed because its scan inputs were cancelled. They need a rerun.
- [x] New CodeQL alert fixes pushed as `84583638`; re-analysis marked alerts 190-193,
      196 and 197 fixed. Only 194/195 (documented false positives) remain new.
- [x] `84583638` exposed a token-budget no-regression failure: 8 documents grew
      past their budgets on this branch. Branch-added GUIDE sections moved to
      `docs/guides/` topic guides, detailed skill sections moved to skill
      `references/`, and reviewer agent and one skill line were reworded more
      tightly. No guidance was dropped; moved lines exist verbatim in their
      new files.
- [x] The always-on context budget (router plus applyTo-all instructions)
      measured 4165 > 4000 tokens. `AGENTS.md` working-contract bullets were
      condensed and two `.github/copilot-instructions.md` paragraphs that
      repeated `AGENTS.md` now point to it; it measures 3963.
- [x] Skill validation: `tool-use-and-function-calling` dropped 60 -> 58
      because the word "requires" triggered the external-requirements check;
      reworded to "needs". Local static pre-check of later CI steps found the
      documented prompt count stale (23 vs 24 after the guided-interaction
      prompt); README, the Copilot CLI pack and the count test now say 24.
- [x] `228301b5`: the stage-gate missing-catalog fixture mirrors the installed
      runtime (the CLI loads sibling modules at startup).
- [x] `e7271d17`: extension unit fixtures updated for automatic workspaces and
      Frontier-only names (9 failures that had never run in CI). Quality Gates,
      SAST, dependency scanning and issue routing all pass on this commit.

## Validation and Acceptance

- [x] Final independent review approves the candidate scope (96/100).
- [x] Commit-time gate passes on the delivered revision (`71ceb880`).
- [x] Extension `npm run test:coverage` (with E2E and audit) passed in PR CI on
      `e7271d17`. Local suite runs were not approved and were not run.
- [ ] MCP server `npm test` and `audit:runtime` run only in the `master`
      release preflight; they have not run on this branch. A failure there
      stops release creation.
- [ ] Protected review and CI on `master` remain required for the GitHub
      `v9.8.0` tag/release; Marketplace publication does not satisfy this step.

## Artifacts and Notes

- Evidence: final commit `e7271d17` and its PR #439 CI runs (Quality Gates
  37388586752, SAST 37388587168).
- Local VSIX `dist/vsix/agentx-9.8.0.vsix` (gitignored) is the published
  Marketplace package, SHA-256
  `12C3BD29DFB71264AB87731793CEC3F68B690AF081F7F6A17BE4517597BF579F`.
  Retain it and its checksum; later source needs a new version and validation,
  not a same-version Marketplace replacement.

## Rollback

Rollback choices are channel-specific. The prior Marketplace version is 9.6.2;
v9.6.0 is the latest GitHub standalone release, not a Marketplace version.
Verify workspace compatibility before downgrading through either channel.
The former local 9.7.0 VSIX was a development artifact, not a qualified rollback.
