---
description: 'Execution plan for SPEC-400 Phase 1 Agents Window integration.'
---

# Execution Plan: SPEC-400 Phase 1 Agents Window Integration

**Author**: AgentX Engineer
**Date**: 2026-06-01
**Status**: In Progress

---

## Purpose / Big Picture

Implement the first bounded slice of SPEC-400: make AgentX agent frontmatter consumable by the VS Code Agents Window, add the hook bundle layout expected by the spec, and extend local validation so drift is caught before packaging.

Success means the repository has a concrete Phase 1 artifact set: compatible `.agent.md` frontmatter, `.agentx/hooks/` PS1+SH pairs, validation coverage for those contracts, and passing targeted checks.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The 24 agent files already have substantial role frontmatter and worker allowlists, but none of the visible agents currently declare `user-invocable`, and internal agents rely on `visibility: internal` instead of the Agents Window-facing `user-invocable: false` contract.
  Evidence: Frontmatter inventory from `Get-ChildItem .github/agents -Recurse -Filter *.agent.md`.
- Observation: `.agentx/hooks/` does not exist yet.
  Evidence: `file_search` and directory listing found no hook files.
- Observation: `vscode-extension/package.json` already contributes bundled `chatAgents`, but does not declare Agents Window opt-in settings.
  Evidence: `package.json` scan found `chatParticipants` and `chatAgents`, no `supportAgentsWindow`.
- Observation: Extension packaging initially did not include `.agentx/hooks/`, even after root hook files were created.
  Evidence: `npm run copy:assets` initially copied 497 files and no hook bundle; after updating `vscode-extension/scripts/copy-assets.js`, it copied `.agentx\hooks/ (8 files)` and 505 files total.
- Observation: `scripts/check-harness-compliance.ps1` ignored untracked execution plans and could leak parent-worktree diffs in temp fixtures.
  Evidence: Initial harness check failed with `Complex work detected but no execution plan file was updated in this change set`; after anchoring git queries to the script workspace top-level and including untracked files, workspace compliance passed and harness audit behavior tests passed 10/10.

## Decision Log

- Decision: Implement SPEC-400 as Phase 1, not a big-bang all-phase rewrite.
  Options Considered: All phases at once; Phase 1 bounded slice; docs-only update.
  Chosen: Phase 1 bounded slice.
  Rationale: SPEC-400 rollout is explicitly phased, and Phase 1 has concrete implementation artifacts with manageable blast radius.
  Date/Author: 2026-06-01 / AgentX Engineer
- Decision: Preserve existing role names and worker allowlists; add missing compatibility fields rather than renaming agents.
  Options Considered: Rename to VS Code-native names; preserve AgentX names.
  Chosen: Preserve AgentX names.
  Rationale: Existing extension and docs use these names; SPEC-400 requires compatibility, not rebranding.
  Date/Author: 2026-06-01 / AgentX Engineer

## Context and Orientation

- Spec: `docs/artifacts/specs/SPEC-400.md`
- ADR: `docs/artifacts/adr/ADR-400.md`
- Amendment: `docs/artifacts/specs/SPEC-401.md`
- Agent source: `.github/agents/**/*.agent.md`
- Hook destination: `.agentx/hooks/`
- Validation: `scripts/validate-frontmatter.ps1`, `scripts/check-harness-compliance.ps1`
- Extension manifest: `vscode-extension/package.json`

## Pre-Conditions

- [x] Issue exists and is classified: #400
- [x] Dependencies checked: ADR-400, SPEC-400, ARCH-REVIEW-400, LEARNING-400 read
- [x] Required skills identified: Karpathy, iterative-loop, testing, core-principles, TypeScript instructions
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Implement the smallest complete Phase 1 slice. First, align frontmatter for all 24 agents with the Agents Window contract without altering role bodies. Second, add hook wrapper pairs under `.agentx/hooks/` that delegate to existing AgentX entrypoints and record trace output. Third, extend validation scripts to catch missing frontmatter fields and hook pair drift. Finally, run targeted validation, scrub, type-check where relevant, and record loop evidence.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Align visible and internal agent frontmatter | Engineer | Complete | Added `user-invocable`; internal + auto-fix safety fields |
| 2 | Add hook wrapper pair files | Engineer | Complete | Added session-start, pre-tool, post-tool, session-end for PS1 and SH |
| 3 | Extend validation scripts for SPEC-400 contracts | Engineer | Complete | Added agent frontmatter + hook pair checks |
| 4 | Add targeted tests or validation commands | Engineer | Complete | Reused frontmatter, harness, hook smoke, compile, and framework tests |
| 5 | Run scrub, validation, and loop iterations | Engineer | In Progress | Scrub and validation complete; loop evidence recording remains |

## Concrete Steps

- Run `pwsh scripts/validate-frontmatter.ps1`.
- Run `pwsh scripts/check-harness-compliance.ps1 -ReportOnly`.
- Run `pwsh scripts/scrub.ps1 -Path .github/agents`, `.agentx/hooks`, and modified scripts.
- Run relevant extension/package validation if manifest changes.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Preview Agents Window APIs may change | Could require future manifest changes | Keep Phase 1 file-based and validation-backed | Open |

## Validation and Acceptance

- [x] All visible agents declare `user-invocable: true`.
- [x] All internal agents declare `user-invocable: false` and `disable-model-invocation: true`.
- [x] Agents with non-empty `agents:` allowlists include the VS Code `agent` tool.
- [x] `.agentx/hooks/` contains PS1+SH pairs for `session-start`, `pre-tool`, `post-tool`, and `session-end`.
- [x] Validation scripts detect the frontmatter and hook-pair contracts.

## Idempotence and Recovery

All edits are file-local. If validation fails, revert only the failing frontmatter or hook script and rerun the same validation commands. Hook scripts are wrappers and do not own gate logic, so rollback is deleting or reverting `.agentx/hooks/*` and validation additions.

## Rollback Plan

Revert this plan, frontmatter additions, hook files, and validation changes. Existing editor-window extension behavior remains intact because Phase 1 does not remove current contributions.

## Artifacts and Notes

Evidence:
- [PASS] `pwsh scripts/validate-frontmatter.ps1 | Select-Object -Last 8` returned `Results: 475 passed, 0 warnings, 0 errors (of 475 checks)`.
- [PASS] `pwsh scripts/check-harness-compliance.ps1` returned `Harness compliance checks passed for complex work`.
- [PASS] `Push-Location vscode-extension; npm run compile; Pop-Location` completed successfully and copied `.agentx\hooks/ (8 files)` into the bundled extension assets.
- [PASS] `pwsh tests/harness-audit-behavior.ps1` returned `Results: 10/10 passed` after the harness compliance top-level guard fix.
- [PASS] `pwsh tests/test-framework.ps1` returned `Results: 134/134 passed`.
- [PASS] `pwsh scripts/scrub.ps1` reported 0 findings across `.github/agents`, `.agentx/hooks`, `scripts`, and this execution plan.
- [PASS] PowerShell and shell hook smoke tests completed with no session environment variables and exited successfully.

## Outcomes & Retrospective

Phase 1 implementation and validation are complete. Remaining work is quality-loop evidence recording and final loop completion for issue #400.

---

**Template**: [.github/templates/EXEC-PLAN-TEMPLATE.md](../../.github/templates/EXEC-PLAN-TEMPLATE.md)