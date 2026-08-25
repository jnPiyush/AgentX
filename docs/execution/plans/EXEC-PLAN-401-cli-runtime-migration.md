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
- [x] Phase 1 acceptance: extension compiles, tests green, and PowerShell/TypeScript gate parity is locked
- [x] Structured reviewer records replace the free-text review-summary gate
- [x] Commit-time hook delegates to the structural `agentx loop gate` check
- [x] Agentic file tools enforce workspace containment and protect gate-bearing paths
- [x] Publish-candidate packaging and local release certification complete
- [ ] Final independent review and loop completion complete

## Surprises & Discoveries

- Observation: `Invoke-LoopComplete` enforced the minimum iteration gate but not the subagent-review history gate before completion.
  Evidence: `.agentx/agentx-cli.ps1` loop complete path had no review-history check before this implementation slice.
- Observation: There is no `cli.mjs` file left in the workspace, so the post-mortem must rely on surviving source evidence, memory notes, and current architecture constraints rather than the old implementation body.
  Evidence: workspace search for `**/cli.mjs` returned no files.
- Observation: Three independent gate implementations repeatedly diverged on malformed state, review position, count types, and completion records.
  Evidence: adversarial review found bypasses until the hook delegated to the structural CLI gate and parity tests covered the exploit shapes.
- Observation: `maxIterations` was able to clamp the mandatory minimum below five in completion and display helpers.
  Evidence: a focused regression proves `loop start --max 1` exits non-zero and writes no state; the TypeScript mirror rejects externally-written `maxIterations: 1` state at `1/5`.
- Observation: the final publish review found that stale completed state passed the delegated gate, Claude native tools bypassed AgentX path controls, runner synchronization could inflate iteration counts, blocked CLI calls exited zero, and staged changes were absent from harness detection.
  Evidence: the failed reviewer verdict was recorded with 3 HIGH and 2 MEDIUM; exploit-specific regressions now cover all five paths.

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

- Decision: Remove the free-text review fallback and require one structured reviewer record everywhere.
  Options Considered: keep a `reviewGate` compatibility marker; maintain separate legacy/new branches; remove the fallback.
  Chosen: remove the fallback.
  Rationale: `loop-state.json` is workspace-writable, so deleting an in-file compatibility marker restored the weaker contract. A marker cannot protect the file that contains it.
  Date/Author: 2026-08-23 / GitHub Copilot

- Decision: Make the commit hook delegate to `agentx loop gate` rather than parse JSON with grep/sed.
  Options Considered: harden three implementations independently; introduce a JSON parser in bash; delegate to the structural CLI gate.
  Chosen: delegate to the CLI gate and keep the TypeScript runtime as the in-process mirror.
  Rationale: text scanning could not reliably bind a review object to a history entry or remain key-order independent. Delegation removes the weakest implementation from the enforcement path.
  Date/Author: 2026-08-23 / GitHub Copilot

- Decision: Keep the Claude Code bridge text-only until native tools can route through an AgentX-guarded adapter.
  Options Considered: retain `bypassPermissions`; use Claude permission prompts; add an unverified native-tool allowlist; disable native tools.
  Chosen: `dontAsk` permission mode with an empty native-tool list.
  Rationale: Claude-native tools execute outside `Invoke-Tool`, so no permission mode can make them honor `Test-SandboxPath`, AgentX modification boundaries, or the terminal allowlist. Disabling them is the only current fail-closed option.
  Date/Author: 2026-08-24 / GitHub Copilot

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
| 6 | Phase 1: extract `src/runtime/` loop-state model + pure gate logic | Engineer | Done | Extension consumes structural gate in-process |
| 7 | Phase 1: refactor loop-state consumers to delegate to the runtime module | Engineer | Done | Public exports preserved |
| 8 | Phase 1: add runtime unit tests; compile + run extension + parity suites | Engineer | Done | PowerShell parity 63/63; extension 1,028 passing |
| 9 | Harden structured review and workspace path controls | Engineer | Done | No free-text fallback; hook delegates; protected path/link/ADS/8.3 tests |
| 10 | Validate publish candidate | Engineer | Done | Source, static, dependency, E2E, and package evidence green |
| 11 | Complete independent review and loop close | Engineer | In Progress | Final verdict must be approved with zero HIGH/MEDIUM |

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
- [x] Review gate requires an attributable structured verdict with explicit HIGH/MEDIUM counts.
- [x] Approval is bound to the final work record; only `kind: completion` records are skipped.
- [x] `maxIterations` cannot reduce the mandatory five-iteration floor.
- [x] Hook, MCP, CLI, and extension command surfaces can record and enforce the structured contract.
- [x] Local VSIX package, extension coverage, dependency audit, MCP audit, and Extension Host smoke pass.
- [ ] Final subagent review reports zero HIGH/MEDIUM and the quality loop completes.

## Idempotence and Recovery

The parity test runs in temp workspaces and uses `AGENTX_WORKSPACE_ROOT` against `agentx-cli.ps1`, so reruns do not mutate the active repository loop state. If a test fails after creating temp files, its `finally` blocks remove the temp workspace.

## Rollback Plan

Revert the targeted changes to `.agentx/agentx-cli.ps1`, `tests/test-framework.ps1`, `tests/loop-parity-behavior.ps1`, and the Phase 0 docs. No persistent runtime migration state is introduced in this slice.

## Artifacts and Notes

- Post-mortem: `docs/execution/contracts/POSTMORTEM-401-cli-mjs.md`
- Parity evidence: `docs/execution/contracts/EVIDENCE-401-loop-parity.md`
- Test: `tests/loop-parity-behavior.ps1`
- Validation: parity 27/27 passed; rollback 32/32 passed; framework 134/134 passed.
- Current focused validation: parity 76/76; harness audit 32/32; hook 39/39; runner 278/278; provider 97/97; domain routing 114/114; sprint/discover/watch 28/28; Cowork skill creator 36/36; Cowork plugin creator 110/110; skill inventory 21/21; framework 178/178; extension compile plus 1,029 tests passed.
- Release reconciliation: rebased cleanly from `e86bb20` onto `3e6a3a2` (`origin/master`) before publish validation.
- Publish validation evidence is captured under ignored `.agentx/state/publish-evidence/`; final command summaries are copied into this plan before handoff.
- Static gates: frontmatter 631/631, harness audit 22/22, references 0 broken, strict scan Grade A with 0 findings, and PSScriptAnalyzer 0 production security findings.
- Extension release gate: 1,029 tests; 82.45% statements/lines, 75.31% branches, 80.85% functions; changed-slice lint passed; production dependency audit found 0 vulnerabilities; prepublish build passed; Extension Host smoke passed 1/1 on a clean retry after one host-startup run exited before Mocha.
- MCP release gate: locked install passed; stdio smoke exposed 19 tools; runtime audit passed the HIGH/CRITICAL gate with the documented moderate Hono advisories remaining.
- Superseded VSIX (do not publish): `agentx-8.7.1-publish-ready.vsix`, SHA-256 `5998e1980064d421a07841028e2a5146675328aa38310365c2c8e721140c242d`; it predates the final Claude bridge hardening.
- Superseded post-second-review VSIX: `agentx-8.7.1-publish-ready-final.vsix`, SHA-256 `f3f2226126fcd026d4a08777e59cfbc7412404e03e9723aa5424e1737d409811`; source changed again after the third review and this archive must not be published.
- Superseded pre-seventh-review candidate: SHA-256 `1dc9668383429beaa591d8bd1405883354a7201d1957dfefb5358f826f3a4fec`; it predates the autonomous lifecycle, active-hook-path, deletion/rename, and orchestration fixes and MUST NOT be published.
- Final review candidate: `build/release-8.7.1-verify/agentx-8.7.1-publish-candidate.vsix`, 2,479,982 bytes, SHA-256 `daadb20910ba460b4e1875a4d169f1aa433760d5175b9239c30b3f252516cf65`.
- VSIX inspection: `jnPiyush.agentx@8.7.1`, 1,057 entries, all required extension/runtime files and `pre-commit`/`commit-msg`/`post-commit` hook sources present and non-empty, zero `.agentx/state`, `%SystemDrive%`, `.git`, AppData, or workspaceStorage entries, and no bundled MCP runtime (separate release archive boundary).
- Publication boundary: the `8.7.1` candidate is a local validation artifact and MUST NOT overwrite the immutable published release. Release automation must stamp and attest the next version from the approved source.
- Extension Host E2E: activation, sidebar contributions, and one read-only command passed (1/1, exit 0).
- Lint caveat: repository-wide lint has 364 pre-existing baseline issues in untouched files; changed TypeScript slice lint passes with zero findings.

## Outcomes & Retrospective

Phase 0, the Phase 1 shared-runtime extraction, structured-review hardening, workspace path hardening, and local publish certification are complete. The parity baseline locks the structural review contract, absolute five-iteration floor, review-position binding, malformed-count rejection, and stale/stuck behavior across the PowerShell and TypeScript surfaces. Final independent review and quality-loop completion remain before handoff.

---

**Template**: `.github/templates/EXEC-PLAN-TEMPLATE.md`