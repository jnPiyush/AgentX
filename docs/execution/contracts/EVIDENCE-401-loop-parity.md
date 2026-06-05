# EVIDENCE-401: Loop Parity Baseline

**Issue**: #401
**Date**: 2026-06-01
**Owner**: AgentX Engineer
**Status**: Complete for Phase 0

---

## Purpose

This evidence record tracks SPEC-401 section 7.2, the golden-file parity suite required before the TypeScript loop writer is introduced.

## Implementation Evidence

- Added `tests/loop-parity-behavior.ps1` as the first executable parity baseline.
- The test invokes the real `.agentx/agentx-cli.ps1` in isolated temp workspaces through `AGENTX_WORKSPACE_ROOT`.
- The test normalizes volatile timestamps and paths before comparing `loop-state.json` to a golden fixture.
- Added a PowerShell `loop complete` review-history gate so the current writer matches the documented AgentX completion contract.
- Integrated the parity behavior script into `tests/test-framework.ps1`.
- Updated the existing rollback behavior test so standard-task guidance asserts the current generic five-iteration protocol.

## Verification Evidence

All focused checks passed on 2026-06-01.

| Command | Result |
|---------|--------|
| `pwsh -NoProfile -File tests/loop-parity-behavior.ps1` | 27/27 passed |
| `pwsh -NoProfile -File tests/loop-rollback-behavior.ps1` | 32/32 passed |
| `pwsh -NoProfile -File tests/test-framework.ps1` | 134/134 passed |

First parity run exposed an unstable expected JSON fixture caused by unordered PowerShell hashtables. The fixture was changed to ordered hashtables and re-run successfully.

## Runtime Evidence

The parity script uses fresh temp workspaces under the system temp directory and sets `AGENTX_WORKSPACE_ROOT` for each isolated CLI process. Its cleanup paths remove the temp workspace in `finally` blocks, so the active repository loop state is not mutated by the parity scenarios.

Runtime scenarios covered:

- Golden happy path: start, baseline, five iterations with evidence, complete, normalized `loop-state.json` fixture match.
- Too-early completion: `loop complete` blocks before minimum iterations and keeps the loop active.
- Missing review completion: `loop complete` blocks after five iterations when no subagent review iteration exists.
- Stale/stuck health: status reports stale or stuck state, and a new start auto-resets stale prior state.

## Acceptance Trace

| SPEC-401 AC | Evidence |
|-------------|----------|
| cli.mjs post-mortem exists | `docs/execution/contracts/POSTMORTEM-401-cli-mjs.md` |
| Golden-file parity suite exists | `tests/loop-parity-behavior.ps1` |
| Min-5 gate preserved | parity fixture 2 |
| Review-history gate preserved | parity fixture 3 |
| Stale/stuck fixture exists | parity fixture 4 |
| PowerShell tooling remains available | existing `.agentx/agentx-cli.ps1` path retained |