---
description: 'Execution plan for replacing AgentX local JSON issues with a provider-backed local task system while preserving AgentX workflow semantics.'
---

# Execution Plan: Backlog Local Provider Replacement

**Issue**: #N/A
**Author**: AgentX Engineer
**Date**: 2026-03-24
**Status**: In Progress

---

## Purpose / Big Picture

Replace the current AgentX local JSON issue store with a provider-backed local task system that can later be implemented with Backlog.md, without breaking AgentX workflow behavior. Success means local work tracking is no longer hard-coded to `.agentx/issues/*.json`, while loop state, execution plans, progress logs, handoff, learning capture, memory, GitHub, and ADO behaviors remain intact.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded
- [x] Backlog-backed local provider implemented behind the seam
- [x] Backlog-backed regression validation passed

## Surprises & Discoveries

- Observation: The current local-mode implementation mixes provider resolution with local JSON persistence inside the same CLI file.
	Evidence: `.agentx/agentx-cli.ps1` contains both provider resolution and local JSON CRUD/listing logic.
- Observation: Local dependency semantics are currently derived from structured text inside issue bodies rather than first-class fields.
	Evidence: `Get-IssueDeps` parses a `## Dependencies` section from issue body text.
- Observation: Compound capture, learning, memory, and loop state already live outside the local issue store.
	Evidence: Durable artifacts live under `docs/artifacts/`, `docs/execution/`, `memories/`, and `.agentx/state/`.

## Decision Log

- Decision: Keep AgentX as the workflow control plane and replace only the local work-item backend.
	Options Considered: Full replacement with Backlog.md as workflow owner; local-backend replacement only.
	Chosen: Local-backend replacement only.
	Rationale: Workflow state, loop gating, learning capture, handoff, and multi-provider parity must stay provider-neutral.
	Date/Author: 2026-03-24 / AgentX Engineer
- Decision: First implementation slice is a provider-dispatch seam, not Backlog.md integration itself.
	Options Considered: Direct Backlog.md cutover; seam-first refactor.
	Chosen: Seam-first refactor.
	Rationale: It reduces risk and lets local/GitHub/ADO behavior stay testable while enabling later backend replacement.
	Date/Author: 2026-03-24 / AgentX Engineer
- Decision: Implement the Backlog-backed local provider as a direct file-backed adapter inside AgentX rather than shelling out to the external `backlog` CLI.
	Options Considered: External CLI dependency; direct markdown/task-file adapter.
	Chosen: Direct markdown/task-file adapter.
	Rationale: It keeps local-mode behavior deterministic in tests and avoids introducing a new runtime dependency for validation, CI, and initialized workspaces.
	Date/Author: 2026-03-24 / AgentX Engineer

## Context and Orientation

The current provider logic lives in `.agentx/agentx-cli.ps1`. Local mode stores issues in `.agentx/issues/*.json`. GitHub and ADO providers already exist and are selected through `.agentx/config.json`. AgentX workflow semantics are documented in `docs/WORKFLOW.md` and `docs/GUIDE.md`, while loop state and harness evidence live outside the issue store. The core constraint is that local storage may change, but AgentX must continue to drive issue-first routing, loop gating, review, compound capture, and learning flows across all providers.

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Introduce an explicit provider boundary for work-item operations inside the CLI, preserving all current behavior. Once that seam exists, move local JSON behavior behind a local provider implementation. After parity is stable, introduce a Backlog.md-backed local provider and switch local mode to use it. Keep all AgentX artifacts, loop state, execution plans, review outputs, learning captures, and memory files outside the provider backend.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Add execution plan and capture current constraints | AgentX Engineer | Complete | This file is the durable plan anchor |
| 2 | Introduce provider-dispatch helpers for work-item CRUD/listing | AgentX Engineer | Complete | Added local/provider helper seam in `.agentx/agentx-cli.ps1` |
| 3 | Re-route existing `issue` commands and ready/list flows through the seam | AgentX Engineer | Complete | `issue get/update/close/comment` and `Get-AllIssues` now dispatch through shared helpers |
| 4 | Validate local, GitHub, and ADO behavior against existing tests/commands | AgentX Engineer | Complete | `tests/provider-behavior.ps1` and `tests/test-framework.ps1` are green after the Backlog slice |
| 5 | Follow-on slice: implement Backlog.md local provider behind the seam | AgentX Engineer | Complete | Added markdown-backed local adapter, numbering/dependency/priority mapping, and comment round-tripping |
| 6 | Decide whether to expose the new local backend more explicitly in docs/config surfaces | AgentX Engineer | In Progress | Runtime is working; documentation and operator guidance still need a follow-on pass |

## Concrete Steps

- Read current provider resolution and local issue functions in `.agentx/agentx-cli.ps1`
- Add provider dispatch helpers for create/get/list/update/close/comment
- Update existing command handlers to call the dispatch helpers
- Run `pwsh -NoProfile -File .\tests\test-framework.ps1`
- Run targeted CLI smoke checks for `issue list`, `ready`, and `deps`
- Implement Backlog markdown parsing/serialization and local backend detection behind the seam
- Add a Backlog-backed provider regression to `tests/provider-behavior.ps1`
- Fix runtime edge cases discovered during validation (`[ ]` wildcard filename handling and empty-result probing)

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No dedicated issue number for this architectural migration | Prevents strict issue-first traceability | Use a durable execution plan and keep commit-level traceability separate | Accepted |

## Validation and Acceptance

- [x] Work-item provider dispatch exists as an explicit seam inside `.agentx/agentx-cli.ps1`
- [x] Existing local, GitHub, and ADO CLI behaviors remain unchanged for current commands in the current regression slice
- [x] Loop, memory, learning, compound capture, and handoff artifacts remain independent of provider storage
- [x] Existing PowerShell framework tests remain green
- [x] Backlog-backed local mode can create, update, comment, list, and close tasks via markdown storage

## Idempotence and Recovery

This change is safe to retry because the first slice only refactors dispatch paths and keeps current provider implementations intact. If a dispatch helper introduces regressions, callers can be pointed back to the prior inlined logic or the helper implementation can be corrected without data migration.

## Rollback Plan

Revert the provider-dispatch slice in `.agentx/agentx-cli.ps1` and keep the current local JSON implementation in place. No external data conversion should occur in this first slice.

## Artifacts and Notes

- Provider selection: `.agentx/agentx-cli.ps1`
- Local JSON storage: `.agentx/issues/*.json`
- Workflow contract: `docs/WORKFLOW.md`
- Local mode docs: `docs/GUIDE.md`
- Learning capture examples: `docs/artifacts/learnings/`
- Validation evidence:
	- `pwsh -NoProfile -File .\tests\test-framework.ps1` -> passed
	- `pwsh -NoProfile -File .\tests\provider-behavior.ps1` -> passed (49/49)
	- `pwsh -NoProfile -File .\tests\test-framework.ps1` -> passed (125/125)
	- `.\.agentx\agentx.ps1 issue list` -> completed without runtime error in current workspace

## Outcomes & Retrospective

- Added a first-class provider seam for work-item CRUD/listing without changing the existing command surface.
- Local JSON persistence is now encapsulated behind dedicated local helper functions, which reduces coupling between provider selection and local storage implementation.
- Added a Backlog-backed local adapter that reads and writes `backlog/tasks/*.md` and `backlog/completed/*.md` while keeping GitHub, ADO, loop state, learning, memory, and handoff behavior outside provider storage.
- Validation exposed two real adapter edge cases: empty-result probing during backend detection and PowerShell wildcard handling for filenames containing `[` and `]`. Both were fixed before the regression suites were re-run.
- The next slice is no longer core runtime integration. It is operator-facing cleanup: docs, config guidance, and any explicit backend-selection surface that should exist on top of the now-working adapter.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../.github/templates/EXEC-PLAN-TEMPLATE.md)