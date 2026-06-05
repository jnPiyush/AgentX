# Execution Plan: CLI Runtime Migration to Shared TypeScript Runtime

**Author**: AgentX Engineer
**Date**: 2026-06-01
**Status**: In Progress

---

## Purpose / Big Picture

Implement ADR-401 and SPEC-401 without bypassing the architect-approved gates. The first implementation slice is Phase 0: recover the cli.mjs post-mortem and add a golden-file parity harness around the current PowerShell loop writer before any TypeScript writer is introduced.

Success means Phase 0 produces durable evidence that answers the council skeptic's re-migration concern and gives later TypeScript work a behavior lock for `loop-state.json`.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Architect handoff reviewed: ADR-401, COUNCIL-401, SPEC-401, ARCH-REVIEW-401
- [x] Phase 0 validation approach defined
- [x] Implementation started
- [x] Phase 0 acceptance evidence recorded
- [x] Phase 1 started: extract shared TS runtime module (loop state + gate) consumed in-process by the extension
- [ ] Phase 1 acceptance: extension compiles, tests green, no behavior change

## Surprises & Discoveries

- Observation: `Invoke-LoopComplete` enforced the minimum iteration gate but not the subagent-review history gate before completion.
  Evidence: `.agentx/agentx-cli.ps1` loop complete path had no review-history check before this implementation slice.
- Observation: There is no `cli.mjs` file left in the workspace, so the post-mortem must rely on surviving source evidence, memory notes, and current architecture constraints rather than the old implementation body.
  Evidence: workspace search for `**/cli.mjs` returned no files.

## Decision Log

- Decision: Implement Phase 0 first and defer TypeScript runtime porting until its prerequisites are green.
  Options Considered: start direct TS port, implement Phase 0 only, or attempt full migration in one pass.
  Chosen: Phase 0 first.
  Rationale: SPEC-401 section 7 says the port does not start until the post-mortem and golden-file parity suite exist.
  Date/Author: 2026-06-01 / AgentX Engineer

- Decision: Use an isolated PowerShell behavior test as the first parity harness.
  Options Considered: mutate the real workspace loop state, mock PowerShell functions in-process, or invoke `agentx-cli.ps1` against a temp workspace with `AGENTX_WORKSPACE_ROOT`.
  Chosen: invoke the real CLI against a temp workspace.
  Rationale: This tests the real writer and avoids corrupting the active issue-401 quality loop.
  Date/Author: 2026-06-01 / AgentX Engineer

- Decision: For Phase 1, home the shared runtime at `vscode-extension/src/runtime/` rather than a new top-level `packages/runtime/` package.
  Options Considered: (a) new standalone `packages/runtime/` npm package wired into the extension via npm workspaces or project references; (b) `vscode-extension/src/runtime/` module compiled by the existing extension build.
  Chosen: (b) `vscode-extension/src/runtime/`.
  Rationale: SPEC-401 s.16 Open Question #1 and ADR-341 leave both homes open; the standalone-package route requires npm-workspace/packaging changes (Open Q #1/#3, owned by Architect/DevOps) that risk the extension build and `vsce package` -- exactly the cross-package friction the cli.mjs post-mortem warns about. The `src/runtime/` module compiles with the existing `tsc -p ./` pipeline (zero build-pipeline change), is consumed in-process by the extension via normal imports, and emits plain CommonJS to `out/runtime/*.js` that a future node-invoked CLI (Phase 4) can require. The canonical `packages/runtime/` relocation is deferred to a dedicated slice once the workspace/packaging design is settled.
  Date/Author: 2026-06-01 / AgentX Engineer

## Context and Orientation

Relevant artifacts:

- `docs/artifacts/adr/ADR-401.md`: selects Option D, TypeScript hot path plus retained PowerShell tooling.
- `docs/artifacts/specs/SPEC-401.md`: requires Phase 0 before porting.
- `docs/artifacts/reviews/ARCH-REVIEW-401.md`: approves implementation but explicitly says Engineer may proceed to Phase 0 first.
- `.agentx/agentx-cli.ps1`: current PowerShell loop writer and gate.
- `vscode-extension/src/utils/loopStateChecker.ts`: TypeScript reader/gate that already blocks missing subagent review.

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked: ADR/spec/review/council present
- [x] Required skills identified: Karpathy, iterative-loop, core-principles, testing, TypeScript instructions
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Phase 0 will add three durable deliverables: a post-mortem document, a parity behavior test, and evidence notes. The only production behavior change in this slice is aligning the PowerShell loop writer with the already-documented review-history completion gate so the baseline matches the contract that TypeScript must later preserve.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Read ADR-401, COUNCIL-401, SPEC-401, ARCH-REVIEW-401, and session handoff | Engineer | Done | Handoff says Phase 0 first |
| 2 | Add cli.mjs post-mortem | Engineer | Done | Durable doc under execution contracts |
| 3 | Add loop parity behavior test | Engineer | Done | Isolated temp workspace, normalized golden fixtures, stale/stuck scenario |
| 4 | Align PowerShell loop complete with review-history gate | Engineer | Done | Matches existing TypeScript gate semantics |
| 5 | Run focused validation and record loop evidence | Engineer | Done | Parity 27/27, rollback 32/32, framework 134/134 |
| 6 | Phase 1: extract `src/runtime/` loop-state model + pure gate logic (faithful, no behavior change) | Engineer | In Progress | Single source of truth for the future TS writer |
| 7 | Phase 1: refactor `utils/loopStateChecker.ts` to delegate to the runtime module, preserving all public exports | Engineer | In Progress | Consumers: extension.ts, harnessEvaluatorInternals.ts, workflowGuidance.ts, workflow.ts |
| 8 | Phase 1: add runtime unit tests; compile + run extension + parity suites | Engineer | Not Started | Exit gate: no behavior change |

## Concrete Steps

- Run `pwsh tests/loop-parity-behavior.ps1`.
- Run `pwsh tests/test-framework.ps1` after integrating the new parity test.
- Run `npm run compile` in `vscode-extension/` if TypeScript files change in a later phase.
- Record each AgentX loop iteration with a fresh evidence file under `.agentx/state/`.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No historical `cli.mjs` file in workspace | Post-mortem cannot cite old code body | Use surviving header, session memory, and current constraints; mark confidence medium | Resolved |
| TypeScript writer does not exist yet | Full parity against TS cannot run in Phase 0 | Build harness around PowerShell baseline and make it ready for the TS writer phase | Accepted |

## Validation and Acceptance

- [x] cli.mjs post-mortem exists and answers SPEC-401 section 7.1.
- [x] Golden parity suite exists and passes on the PowerShell baseline.
- [x] Review-history gate blocks `loop complete` until a review iteration exists.
- [x] Existing loop rollback and framework behavior remain green.

## Idempotence and Recovery

The parity test runs in temp workspaces and uses `AGENTX_WORKSPACE_ROOT` against `agentx-cli.ps1`, so reruns do not mutate the active repository loop state. If a test fails after creating temp files, its `finally` blocks remove the temp workspace.

## Rollback Plan

Revert the targeted changes to `.agentx/agentx-cli.ps1`, `tests/test-framework.ps1`, `tests/loop-parity-behavior.ps1`, and the Phase 0 docs. No persistent runtime migration state is introduced in this slice.

## Artifacts and Notes

- Post-mortem: `docs/execution/contracts/POSTMORTEM-401-cli-mjs.md`
- Parity evidence: `docs/execution/contracts/EVIDENCE-401-loop-parity.md`
- Test: `tests/loop-parity-behavior.ps1`
- Validation: parity 27/27 passed; rollback 32/32 passed; framework 134/134 passed.

## Outcomes & Retrospective

Phase 0 is complete. The old `cli.mjs` source was not present, so the post-mortem documents evidence confidence and constrains the next TypeScript phase rather than claiming direct forensic certainty. The parity baseline now locks the current PowerShell loop writer behavior for happy path, minimum iteration blocking, subagent review blocking, and stale/stuck reset behavior. A stale assertion in `tests/loop-rollback-behavior.ps1` was corrected to match the current standard-task five-iteration protocol.

---

**Template**: `.github/templates/EXEC-PLAN-TEMPLATE.md`