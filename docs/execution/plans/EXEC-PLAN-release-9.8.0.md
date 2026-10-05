---
title: Frontier 9.8.0 Release Preparation
description: Stamp, document, package and validate the 9.8.0 candidate without publishing it.
---

**Issue**: #411
**Date**: 2026-10-05
**Status**: Candidate prepared; publication waits for protected review and CI

## Purpose

Prepare the accumulated guided-execution, graph v2, automatic-workspace,
loop-optimization, companion and audit-correction work as a releasable 9.8.0
candidate. Publication, tagging, Marketplace upload and merging PR #439 are
not part of this task.

## Decisions

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

## Steps

| Step | State | Acceptance |
| --- | --- | --- |
| Review-risk fixes and regression cases | Complete | Probe and syntax checks pass |
| Version stamp and release notes | Complete | All stamped surfaces report 9.8.0 |
| VSIX package and inspection | Complete | `jnPiyush.agentx@9.8.0`; bundled runtime matches source |
| Dependency audits | Complete | Extension and MCP runtime audits report 0 vulnerabilities |
| Independent review and loop completion | Loop evidence | Zero HIGH/MEDIUM required |
| Release validation suites | Post-loop | Run only with explicit approval; results recorded |
| Commit, push and PR update | Pending | Normal hooks; no merge, tag or publication |

## Validation and Acceptance

- [ ] Final independent review approves the current scope.
- [ ] Commit-time gate passes on the delivered revision.
- [ ] Release preflight suites (extension coverage, MCP tests) pass, or their
      unrun/failed state is recorded and blocks a release claim.
- [ ] Protected review and CI on `master` remain required before `v9.8.0`.

## Rollback

Retain v9.6.0 (latest public release) as the published rollback target. The
local 9.7.0 VSIX is a development artifact, not a qualified rollback.
