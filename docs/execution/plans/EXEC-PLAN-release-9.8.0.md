---
title: Frontier 9.8.0 Release Preparation
description: Stamp, document, package and validate the 9.8.0 candidate without publishing it.
---

**Issue**: #411
**Date**: 2026-10-05
**Status**: Candidate prepared; publication waits for protected review and CI

## Purpose / Big Picture

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
| CI blocker fixes | In progress | Target: ESLint, PSScriptAnalyzer, CodeQL build, loop case and plan check green in PR CI |

## Progress

- [x] Candidate stamped, packaged, reviewed and pushed as `71ceb880`.
- [x] CI failures on `71ceb880` triaged to five causes.
- [x] CI blocker fixes pushed as `2d745425`; CodeQL build, PSScriptAnalyzer and
      both Quality Loop jobs passed. The other jobs were cancelled while still
      queued (runner capacity) and never ran; Dependency Scan Summary then
      failed because its scan inputs were cancelled. They need a rerun.
- [ ] New CodeQL alert fixes reviewed, pushed and re-analyzed on PR #439.
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

## Validation and Acceptance

- [x] Final independent review approves the candidate scope (96/100).
- [x] Commit-time gate passes on the delivered revision (`71ceb880`).
- [ ] Release preflight suites (extension coverage, MCP tests) pass, or their
      unrun/failed state is recorded and blocks a release claim. Local runs
      were not approved; PR CI and the `master` preflight are the record.
- [ ] Protected review and CI on `master` remain required before `v9.8.0`.

## Artifacts and Notes

- Evidence: candidate commit `71ceb880` and CI runs on PR #439.
- Local VSIX `dist/vsix/agentx-9.8.0.vsix` (gitignored) is superseded by any
  later commit and must be repackaged from the final revision.

## Rollback

Retain v9.6.0 (latest public release) as the published rollback target. The
local 9.7.0 VSIX is a development artifact, not a qualified rollback.
