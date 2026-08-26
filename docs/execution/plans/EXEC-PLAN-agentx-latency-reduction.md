---
description: 'Execution plan for reducing AgentX implementation latency without removing the independent review gate.'
---

# Execution Plan: AgentX Latency Reduction

**Author**: GitHub Copilot
**Date**: 2026-08-26
**Status**: Complete

## Purpose / Big Picture

Reduce avoidable AgentX implementation latency while retaining evidence-backed validation and one independent final review. Success means simple work can complete after one external quality iteration, normal implementation work after three, and only explicitly high-risk work retains the five-iteration floor.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Runtime policy implemented
- [x] Agent contracts aligned
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: all task classes currently resolve to five iterations, so task classification does not create a fast path.
  Evidence: `.agentx/agentx-cli.ps1` and `vscode-extension/src/runtime/loopState.ts` defaults.
- Observation: the runner performs five same-role reviews and still requires a separate independent review.
  Evidence: `.agentx/agentic-runner.ps1` self-review loop and loop-state sync behavior.
- Observation: frontmatter list parsing consumes later YAML lists because the multiline regex is dot-all and greedy.
  Evidence: Engineer constraints parse as 50 entries instead of 22.
- Observation: task class is workspace-writable, so high-risk keywords must override an explicit lower class.
  Evidence: commit-gate and extension tests now cover `taskClass: standard` with a production authentication migration prompt.

## Alternatives Considered

1. Compress instructions only. Rejected because measured prompt construction is sub-second and model/validation repetition remains unchanged.
2. Remove independent review. Rejected because it would eliminate the attributable trust boundary used by the completion gate.
3. Enable arbitrary terminal execution in the CLI runner. Rejected because the runner has no process sandbox and the latency task does not justify widening command execution.
4. Use risk-based external iterations plus one internal self-review. Chosen because it removes duplicate approvals while preserving one independent final verdict.

## Decision Log

- Decision: use external minimums of standard `1`, auto-fix `2`, complex/AgentX `3`, and high-risk `5`.
  Options Considered: fixed five; fixed one; risk-based minimums.
  Chosen: risk-based minimums.
  Rationale: scales verification effort to blast radius while preserving a five-pass path for security, migration, release, and other high-risk work.
  Date/Author: 2026-08-26 / GitHub Copilot
- Decision: runner self-review minimum is one and does not satisfy the independent final-review gate.
  Options Considered: five same-role reviews; no self-review; one self-review.
  Chosen: one self-review.
  Rationale: catches obvious mistakes once without duplicating the independent reviewer.
  Date/Author: 2026-08-26 / GitHub Copilot

## Context and Orientation

The PowerShell CLI owns durable loop classification and completion gates. The runner owns same-role self-review. The VS Code runtime mirrors loop classification. Agent definitions and the cross-cutting protocol describe validation behavior. Extension assets are generated from canonical repository sources by `vscode-extension/scripts/copy-assets.js`.

## Pre-Conditions

- [x] Task is classified as a performance-focused implementation change
- [x] Active quality loop started
- [x] Performance, optimization, testing, AI-agent, and Karpathy guidance loaded
- [x] Complexity requires a living plan

## Plan of Work

First update runtime classification and review minimums with parity tests. Then fix frontmatter parsing with a regression test. Align Engineer and AgentX contracts so focused checks run during implementation, the full suite runs once before handoff, and adversarial checks are conditional on applicable high-risk surfaces. Finally regenerate extension assets, run targeted suites, scrub changed areas, and obtain an independent reviewer verdict.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Add risk-based loop defaults | GitHub Copilot | Complete | CLI, runner, and VS Code parity |
| 2 | Limit internal self-review to one | GitHub Copilot | Complete | Independent final reviewer remains |
| 3 | Fix frontmatter list parsing | GitHub Copilot | Complete | Exact list-count assertions added |
| 4 | Align validation contracts | GitHub Copilot | Complete | Focused checks during work; full suite once |
| 5 | Regenerate bundled assets | GitHub Copilot | Complete | 825 files synchronized |
| 6 | Validate and review | GitHub Copilot | Complete | Targeted and full runtime suites recorded |

## Concrete Steps

- Run `pwsh -NoProfile -File tests/agentic-runner-behavior.ps1`.
- Run `pwsh -NoProfile -File tests/loop-parity-behavior.ps1`.
- Run the focused VS Code loop-state tests.
- Run `node vscode-extension/scripts/copy-assets.js` after canonical sources pass.
- Run `pwsh .agentx/agentx.ps1 scrub -Path <changed-area>` before review.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Full framework suite is slow and sequential | Cannot use it after every small edit | Use targeted suites during implementation and one broader final gate | Mitigated |

## Validation and Acceptance

- [x] Standard loops default to one iteration; complex and AgentX loops default to three; high-risk loops default to five.
- [x] Runner invokes exactly one successful same-role self-review by default.
- [x] Independent structured review remains required for loop completion.
- [x] Agent frontmatter lists stop at the correct YAML key boundary.
- [x] Engineer contract requires focused checks during implementation and one full-suite pre-handoff run.
- [x] Existing targeted runtime and extension tests pass.

## Idempotence and Recovery

The changes are deterministic constants, classifiers, parser expressions, tests, and generated mirrors. Rerunning asset generation is safe. If parity fails, restore the prior tier in all three runtime implementations together rather than leaving divergent defaults.

## Rollback Plan

Revert the latency-reduction commit or restore the prior minimum constants and contract text. No persistent data migration is introduced; existing loop states retain their stored minimum and cannot be silently lowered.

## Artifacts and Notes

Diagnostic evidence is archived under `.agentx/state/loop-evidence/` and is intentionally gitignored. Final validation results include runner behavior 297/297, loop parity 110/110, real hook gate 41/41, focused extension tests 88/88, frontmatter 631/631, zero token-budget violations, reference validation 1884/1884 links, zero PowerShell parse errors, and canonical/bundled protocol hash parity.

## Outcomes & Retrospective

AgentX now applies 1/2/3/5 risk-based external loop minimums, performs one internal
self-review by default, requires one independent final verdict, scopes adversarial
checks to applicable high-risk surfaces, records per-stage runner latency, parses
frontmatter lists correctly, and keeps bundled extension assets aligned. Existing
stored higher minimums remain monotonic and high-risk prompts cannot be downgraded
by editing `taskClass`.