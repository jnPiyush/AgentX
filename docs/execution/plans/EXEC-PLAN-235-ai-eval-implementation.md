<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: AgentX AI Evaluation Contract Implementation

**Issue**: #235
**Author**: AgentX Auto
**Date**: 2026-03-20
**Status**: In Progress

---

## Purpose / Big Picture

Implement the contract-first phase of the AI evaluation architecture defined in ADR-235 and SPEC-235. Success means the extension can load and validate the repo-local AI evaluation manifest, baseline, and normalized report artifacts, and can resolve the declared runner strategy without touching Quality sidebar UI work in this slice.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded
- [x] Runner groundwork added
- [x] Normalized report persistence added
- [x] Lightweight prompt/eval starter pack added
- [x] Lightweight runnable sample path added

## Surprises & Discoveries

- Observation:
	The current extension already has an `eval/` seam, but it is limited to deterministic harness maturity scoring. That makes the new AI evaluation contract a clean additive module rather than a refactor of the existing harness evaluator.
	Evidence: `vscode-extension/src/eval/harnessEvaluator.ts`, `vscode-extension/src/eval/harnessEvaluatorInternals.ts`
- Observation:
	The extension did not have a YAML parser dependency, so manifest loading needs one explicit runtime dependency rather than an ad hoc parser.
	Evidence: `vscode-extension/package.json`
- Observation:
	The extension already exposes a reusable shell execution helper, which lets runner groundwork use injected adapters and shell-backed runners without adding a second subprocess abstraction.
	Evidence: `vscode-extension/src/utils/shell.ts`
- Observation:
	The repo contract already expected root-level `prompts/` and `evaluation/` assets, but the workspace did not actually ship a starter set for teams to adopt.
	Evidence: `.github/agents/engineer.agent.md`, `.github/agents/data-scientist.agent.md`, `docs/artifacts/specs/SPEC-235.md`
- Observation:
	A starter pack is more useful when it can fail meaningfully before customization. A tiny sample runner that detects placeholder prompt and dataset content makes the scaffold runnable without pretending it is a production evaluator.
	Evidence: `scripts/run-ai-eval-sample.ps1`, `evaluation/frontier.eval.yaml`
- Observation:
	A concrete example is easier to reason about than a generic scaffold. Converting the starter assets into an issue-classification prompt plus deterministic local baseline makes the workflow legible without depending on a live model endpoint.
	Evidence: `prompts/assistant-v1.md`, `evaluation/datasets/regression.jsonl`, `scripts/run-ai-eval-sample.ps1`

## Decision Log

- Decision:
	Implement phase 1 as a validation and workspace-loading layer first, not as runner execution or sidebar rendering.
	Options Considered:
	- Start with Quality sidebar integration
	- Start with runner adapters
	- Start with contract loading, validation, and runner-selection groundwork
	Chosen:
	Start with contract loading, validation, and runner-selection groundwork
	Rationale:
	This matches the rollout plan in SPEC-235 and the user's explicit request to hold off on Quality sidebar work.
	Date/Author:
	2026-03-20 / AgentX Auto
- Decision:
	Implement runner groundwork as a sibling module that consumes validated contract state, instead of extending the contract loader.
	Options Considered:
	- Expand `aiEvaluationContractInternals.ts` to execute runners and write reports
	- Add a dedicated runner facade/internals/types module that consumes contract state
	Chosen:
	Add a dedicated runner facade/internals/types module
	Rationale:
	This keeps contract validation read-only while preserving promptfoo-compatible and Azure-compatible execution pluggability.
	Date/Author:
	2026-03-20 / AgentX Auto
- Decision:
	Add a lightweight repo-local starter pack for prompts, datasets, rubrics, and baselines without copying promptfoo's configuration surface.
	Options Considered:
	- Continue deepening runner-specific integration first
	- Add only documentation with no starter artifacts
	- Add a small guide plus starter repo files for prompt and evaluation practice
	Chosen:
	Add a small guide plus starter repo files for prompt and evaluation practice
	Rationale:
	The user clarified that the goal is best-practice adoption for DS and AI engineering, not promptfoo integration. A lightweight starter pack matches that intent and makes the existing repo contract usable immediately.
	Date/Author:
	2026-03-20 / AgentX Auto

## Context and Orientation

Relevant repo-local context:

- `docs/artifacts/specs/SPEC-235.md` defines phase 1 as manifest, baseline, report, and runner-selection validation.
- `vscode-extension/src/eval/` currently contains only harness-quality evaluation code.
- `vscode-extension/src/test/eval/` already contains focused Mocha tests for eval modules.
- Existing repo guidance favors facade-plus-internals patterns for extension modules.

Constraints for this slice:

- No Quality sidebar UI changes
- No runner execution yet
- Keep implementation ASCII-only and strictly typed

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Add a new AI evaluation contract module under `vscode-extension/src/eval/` with a stable facade, a sibling internals module, and a types module. The internals layer will load `evaluation/frontier.eval.yaml`, `evaluation/baseline.json`, and the latest normalized report under `.copilot-tracking/eval-reports/`, validate their required sections, and resolve runner selection. Focused tests will cover valid and invalid workspaces plus facade summaries.

Extend the implementation with a sibling runner module that plans execution from the validated contract, executes injected runner adapters, normalizes raw outputs into the AgentX report shape, and persists normalized reports without touching Quality sidebar consumers.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Add implementation plan and progress artifacts | AgentX Auto | Complete | Required for complex implementation slice |
| 2 | Install YAML dependency for manifest parsing | AgentX Auto | Complete | Keeps manifest parsing explicit and maintainable |
| 3 | Implement contract facade, internals, and types | AgentX Auto | Complete | Added stable facade plus deterministic internals and types |
| 4 | Add targeted eval tests | AgentX Auto | Complete | Added internals and facade coverage for valid and invalid workspaces |
| 5 | Compile and run targeted tests | AgentX Auto | Complete | Extension compile passed and the new eval tests passed |
| 6 | Implement runner facade, internals, and types | AgentX Auto | Complete | Added execution planning, normalization, persistence, and shell-adapter groundwork |
| 7 | Add targeted runner tests | AgentX Auto | Complete | Added internals and facade coverage for execution and persistence |
| 8 | Recompile and run targeted eval test suite | AgentX Auto | Complete | Contract and runner suites both passed |
| 9 | Add a runnable starter sample path | AgentX Auto | Complete | Wired starter manifest to a sample local script that fails until placeholders are replaced |
| 10 | Convert the starter into a concrete example workflow | AgentX Auto | Complete | Replaced placeholders with an issue-classification prompt, dataset, and deterministic baseline runner |

## Concrete Steps

- Add `vscode-extension/src/eval/aiEvaluationContract.ts`
- Add `vscode-extension/src/eval/aiEvaluationContractInternals.ts`
- Add `vscode-extension/src/eval/aiEvaluationContractTypes.ts`
- Add `vscode-extension/src/eval/aiEvaluationRunner.ts`
- Add `vscode-extension/src/eval/aiEvaluationRunnerInternals.ts`
- Add `vscode-extension/src/eval/aiEvaluationRunnerTypes.ts`
- Add tests in `vscode-extension/src/test/eval/`
- Run extension compile and targeted test files
- Add a lightweight guide under `docs/guides/`
- Add starter `prompts/` and `evaluation/` assets at the repo root
- Add a sample repo-local runner script so the starter manifest can execute end to end
- Replace placeholder prompt and dataset content with one real AgentX example workflow

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| None currently | None | N/A | Clear |

## Validation and Acceptance

- [x] Extension can load and validate `evaluation/frontier.eval.yaml`
- [x] Extension can load and validate `evaluation/baseline.json`
- [x] Extension can validate normalized report files when present without requiring sidebar wiring
- [x] Runner selection is resolved from manifest declarations for promptfoo-compatible and Azure-compatible paths
- [x] Targeted compile/tests pass for the new eval module
- [x] Execution planning blocks incomplete contracts before runner invocation
- [x] Injected adapters can produce normalized reports and persisted evidence files
- [x] Raw output retention is controlled by manifest reporting policy

## Idempotence and Recovery

The implementation is file-based and read-only with respect to evaluation artifacts. If parsing or validation fails, the module should return structured issues instead of throwing, so the workspace can be revalidated after artifact fixes without cleanup steps.

## Rollback Plan

Remove the added eval contract module and tests, and remove the YAML dependency from `vscode-extension/package.json` and lockfile if the approach is rejected.

## Artifacts and Notes

- ADR: `docs/artifacts/adr/ADR-235.md`
- Spec: `docs/artifacts/specs/SPEC-235.md`
- Current implementation target: `vscode-extension/src/eval/`
- Lightweight starter guide: `docs/guides/AI-EVALUATION-LIGHTWEIGHT.md`
- Starter prompt and evaluation assets: `prompts/`, `evaluation/`
- Validation:
	- `npm run compile`
	- `mocha "out/test/eval/aiEvaluationContract*.js" "out/test/eval/aiEvaluationRunner*.js"`

## Outcomes & Retrospective

- Completed the contract-first implementation slice for issue `#235`.
- Added a repo-local AI evaluation contract loader/validator with promptfoo-compatible and Azure-compatible runner selection groundwork.
- Added runner execution groundwork with injected adapters, normalized report generation, and persisted evidence files under `.copilot-tracking/eval-reports/`.
- Added a lightweight prompt/evaluation starter pack so teams can adopt prompt versioning, datasets, rubrics, and baselines without copying promptfoo's config model.
- Added a tiny repo-local sample runner so the starter contract can execute and produce meaningful failures until placeholder assets are replaced.
- Converted the starter into a concrete issue-classification example so the repo ships one small but real evaluation workflow instead of only placeholders.
- Left Quality sidebar work untouched, as requested.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)