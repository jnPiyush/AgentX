---
description: 'Execution plan for enforcement profiles, bounded session summary sync, research-first mode, and deterministic harness audit.'
---

# Execution Plan: Harness Controls And Research-First Runtime

**Issue**: Local task
**Author**: AgentX Auto
**Date**: 2026-03-22
**Status**: Validation Complete

---

## Purpose / Big Picture

Implement four related workflow/runtime controls in AgentX: configurable enforcement profiles with per-check disables, bounded session summary synchronization at session start/stop, a research-first execution mode, and a deterministic harness audit command. Success means the CLI can evaluate harness state with explicit policy controls, the runner persists bounded summary state for resumable sessions, and research-first mode can be enabled without relying only on prompt wording.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The repo already has deterministic harness evaluation logic in the VS Code extension and a separate PowerShell compliance script, but no single CLI audit command or shared profile/disable contract.
  Evidence: `vscode-extension/src/eval/harnessEvaluatorInternals.ts`, `scripts/check-harness-compliance.ps1`
- Observation: Session persistence currently stores full message history plus metadata, but no bounded session summary artifact for resumable context.
  Evidence: `.agentx/agentic-runner.ps1` `Save-Session` / `Read-Session`
- Observation: The audit command must run the compliance script from the audited workspace and capture its stdout/stderr, otherwise JSON mode inherits unrelated repo diff state and host output.
  Evidence: `.agentx/agentx-cli.ps1` `Invoke-HarnessComplianceReport`, `tests/harness-audit-behavior.ps1`

## Decision Log

- Decision: Implement the enforcement profile and disabled-check contract in `.agentx/config.json` first, then consume it from both the audit surface and the extension evaluator.
  Options Considered: CLI-only profile handling; separate CLI and extension settings; shared config contract.
  Chosen: Shared config contract.
  Rationale: The same policy needs to influence deterministic evaluation across repo surfaces.
  Date/Author: 2026-03-22 / AgentX Auto
- Decision: Execute `scripts/check-harness-compliance.ps1` through a redirected child `pwsh` process rooted at the audited workspace instead of invoking it inline.
  Options Considered: Inline invocation with `2>&1`; redirected child process.
  Chosen: Redirected child process.
  Rationale: This keeps audit JSON deterministic and prevents `Write-Host` output from polluting machine-readable responses.
  Date/Author: 2026-03-22 / AgentX Auto

## Context and Orientation

Key files:

- `.agentx/agentx-cli.ps1`: CLI config handling, loop commands, and `run` entrypoint.
- `.agentx/agentic-runner.ps1`: session persistence, compaction summaries, self-review loop, tool execution.
- `scripts/check-harness-compliance.ps1`: current plan-gate compliance logic for CI.
- `vscode-extension/src/eval/harnessEvaluatorInternals.ts`: deterministic harness evaluation checks.
- `vscode-extension/src/utils/loopStateChecker.ts`: loop-gate logic used by the extension.

Constraints:

- Preserve ASCII-only files.
- Keep CLI config backward compatible.
- Avoid large refactors across unrelated command surfaces.
- Keep extension/public facades stable where possible.

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Define a small shared policy contract in AgentX config for harness enforcement, then use it to build a deterministic CLI audit command and to extend the extension-side evaluator/loop gate. After that, add bounded session-summary persistence in the runner so start/resume/stop paths carry compact state instead of relying only on raw message replay. Finally, enforce research-first behavior in the runner with deterministic gating around mutating tool usage and validate the combined behavior with targeted PowerShell and TypeScript tests.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Add plan and progress artifacts | AgentX Auto | Done | Required for complex task compliance |
| 2 | Define config contract for harness profiles and disabled checks | AgentX Auto | Done | Supports flat and nested config keys |
| 3 | Implement deterministic harness audit command | AgentX Auto | Done | JSON-safe output plus profile/disable controls |
| 4 | Add bounded session summary sync | AgentX Auto | Done | Runner writes bounded summary metadata at start and stop |
| 5 | Add research-first mode and tests | AgentX Auto | Done | Enforced mode blocks edits until exploration threshold |

## Concrete Steps

- Read current CLI config and run entrypoint behavior.
- Inspect existing harness evaluator and compliance script.
- Add/update tests in `tests/*.ps1` and `vscode-extension/src/test/**`.
- Run `pwsh -NoProfile -File tests/test-framework.ps1`.
- Run extension tests or targeted diagnostics if impacted.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No formal issue for this task | Traceability only | Use local-task plan/progress artifacts and `[skip-issue]` if needed | Accepted |

## Validation and Acceptance

- [x] CLI exposes deterministic harness audit output with configurable enforcement profile and disabled checks.
- [x] Session persistence writes and resumes bounded summary state without unbounded growth.
- [x] Research-first mode blocks premature write/edit operations until repo exploration occurs.
- [x] Tests cover the new behavior and pass end-to-end validation.

## Idempotence and Recovery

Config additions must default safely when keys are absent. Session summary writes must be recomputable from current runtime state. Audit command output should be deterministic for the same workspace state.

## Rollback Plan

Revert the new config keys, audit command wiring, and session-summary metadata additions if any runtime path regresses. The changes are file-local and can be backed out without schema migration.

## Artifacts and Notes

- Validation command: `pwsh -NoProfile -File tests/harness-audit-behavior.ps1`
- Validation command: `pwsh -NoProfile -File tests/agentic-runner-behavior.ps1`
- Validation command: `pwsh -NoProfile -File tests/test-framework.ps1`
- Evidence: Targeted PowerShell suites pass after fixing strict-mode optional property handling and deterministic subprocess execution.
- Evidence: `get_errors` reports no diagnostics in the modified PowerShell and TypeScript files.
- Evidence: `tests/test-framework.ps1` now passes with 125/125 checks green after updating the engineer agent contract wording expected by the framework.

## Outcomes & Retrospective

Implemented enforcement profiles with disabled checks, bounded session summary persistence, research-first gating, and deterministic audit plumbing across CLI and extension surfaces. Targeted validation passed, and the full framework now passes after aligning the engineer agent contract wording with the framework expectations.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../.github/templates/EXEC-PLAN-TEMPLATE.md)