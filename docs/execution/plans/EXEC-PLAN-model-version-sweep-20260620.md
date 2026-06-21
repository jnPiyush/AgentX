---
description: 'Execution plan for sweeping live model-version defaults and references.'
---

<!-- Inputs: {title}, {date}, {author}, {agent} -->

# Execution Plan: Model Version Sweep

**Author**: Auto-Fix Reviewer
**Date**: 2026-06-20
**Status**: Complete

---

## Purpose / Big Picture

Update remaining live workspace references to the current GPT-5.5 and Claude Opus 4.8 defaults where older strings still represented active defaults, examples, or test expectations. Keep historical, generated, and runtime-state artifacts intact unless they are bundled source-of-truth assets.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: Remaining old-version strings are split across live source, tests, bundled extension assets, UX prototype text, historical ADR council artifacts, generated output, and ignored runtime/session files.
  Evidence: repo grep over targeted source/test/doc paths on 2026-06-20.

## Decision Log

- Decision: Limit edits to live source, active tests, bundled source-of-truth assets, and current UX/docs examples.
  Options Considered: [1] Replace every visible occurrence including runtime logs and historical artifacts. [2] Replace only live defaults and current-facing examples. [3] Replace source only and leave tests/docs stale.
  Chosen: [2] Replace live defaults, active examples, and tests that assert those defaults.
  Rationale: This is the smallest safe sweep. It avoids corrupting historical records and generated files while still making current behavior and shipped assets consistent.
  Date/Author: 2026-06-20 / Auto-Fix Reviewer

## Context and Orientation

Key live surfaces:

- `.agentx/agentic-runner.ps1` contains model capability/default mappings.
- `vscode-extension/src/chat/adapterSetup.ts` and `vscode-extension/src/commands/llmAdaptersCommandInternals.ts` contain extension-side LLM defaults.
- `tests/agentic-runner-behavior.ps1`, `vscode-extension/src/test/commands/llmAdapters.test.ts`, and `vscode-extension/src/test/chat/chatParticipant.test.ts` assert those defaults.
- `vscode-extension/src/test/commands/runCouncil.test.ts` and `tests/council-validation/COUNCIL-urlshort-create-endpoint.md` contain active council fixtures.
- `docs/ux/prototypes/landing/index.html` exposed an outdated Claude model label in current-facing prototype text and required an in-place content update.
- Bundled extension assets under `vscode-extension/.github/agentx/` must stay aligned with root source-of-truth files.

Out-of-scope surfaces unless required by source-of-truth packaging:

- `.agentx/state/**`
- `.agentx/sessions/**`
- `vscode-extension/out/**`
- `vscode-extension/coverage/**`
- historical change-log wording that intentionally describes the migration
- historical review/council artifacts under `docs/artifacts/**` unless they are current fixtures used by tests

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

Note: no issue was provided for this workspace-local sweep.

## Plan of Work

First update the root live defaults and mirrored bundled copies. Then align tests and current-facing fixtures with the new defaults. After edits, run narrow behavior tests for the touched runner and extension LLM/council surfaces. If bundled assets need regeneration, use the repo-approved sync path instead of hand-editing generated outputs.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Update live root runner and extension defaults | Auto-Fix Reviewer | Complete | Root source updated first |
| 2 | Update active tests and council fixtures | Auto-Fix Reviewer | Complete | Historical docs left out of scope |
| 3 | Align bundled extension source-of-truth copies | Auto-Fix Reviewer | Complete | Synced via copy-assets.js |
| 4 | Run narrow validations | Auto-Fix Reviewer | Complete | PowerShell + targeted extension tests passed |
| 5 | Record evidence and close loop | Auto-Fix Reviewer | Complete | Review follow-up added curated-learning behavior coverage |

## Concrete Steps

- Search targeted paths for live references.
- Edit live defaults and tests with `apply_patch`.
- Validate PowerShell runner behavior.
- Validate targeted extension tests.
- Sync bundled asset copies if required.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| None currently | None | N/A | Open |

## Validation and Acceptance

- [x] Live defaults no longer point to superseded GPT or Claude model ids in active source files.
- [x] Touched tests and active fixtures reflect the updated defaults and still pass.
- [x] Historical, generated, and ignored runtime/session artifacts are left unchanged unless they are bundled source-of-truth assets.

## Idempotence and Recovery

Edits are string-level replacements in a bounded file set. If a validation fails, revert only the affected file region and rerun the same narrow check before expanding scope.

## Rollback Plan

Use the patch diff to revert the touched regions in the edited files only. Do not touch ignored runtime/session artifacts.

## Artifacts and Notes

- Initial grep confirmed partial migration state on 2026-06-20.
- `pwsh -NoProfile -File tests/agentic-runner-behavior.ps1` passed after the runner/default updates.
- `node vscode-extension/scripts/copy-assets.js` refreshed bundled extension assets from root source.
- `npm test -- out/test/commands/llmAdapters.test.js out/test/chat/chatParticipant.test.js out/test/commands/runCouncil.test.js` passed in `vscode-extension`.
- `pwsh -NoProfile -File tests/agentic-runner-behavior.ps1` passed with focused curated-learning coverage added for bullet parsing, category/date metadata, ranking, limits, filtering, and no-match behavior.

## Outcomes & Retrospective

Live defaults, active council fixtures, current-facing prototype/model examples, and curated-learning behavior tests now point at GPT-5.5 and Claude Opus 4.8. Remaining older model strings are confined to intentional historical artifacts under `docs/artifacts/adr/` and ignored runtime/session state.
