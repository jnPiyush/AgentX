# Execution Plan: Mandatory documentation drift and consolidation

**Date**: 2026-09-05
**Status**: Implementation verified; final approval is recorded in quality-loop evidence
**Mode**: Local; no remote issue created.

## Purpose / Big Picture

Every implemented feature, user story and bug must review documentation impact
before handoff. Automate verifiable drift without pretending link/count checks
prove semantic accuracy. Make current documentation easier to navigate and prune
superseded transient state, not useful architectural history.

## Research and Alternatives Considered

Baseline: 26 agents, 134 skills, 15 recursive instruction files, 15 templates,
23 prompts and 18 Claude commands. Existing reference validation passes but
ignores new untracked Markdown; CI's separate count check counts only top-level
instructions. Final code reviews already have exact-scope hash validation.

1. Reminder-only checklist: rejected; easy to skip and produces no evidence.
2. Extend existing review evidence plus deterministic drift checker: selected.
3. Separate LLM drift service/state machine: rejected; duplicate orchestration,
   cost and unverifiable approval semantics.

## Model Council and Design Alignment

- Architect / GPT-5.4: extend the existing report and completion gate, bind
  reviewed docs to hashes, cover config-only work and trusted runtime resolution.
- Policy reviewer / Gemini 3.7 Flash: structural checks cannot prove semantics;
  require meaningful no-impact rationale, preserve history and repair packaging.
- Corpus audit / Claude Sonnet 5: prune completed unreferenced execution notes and
  tracked runtime snapshots; keep ADR/PRD/spec/review/learning records.

Synthesis: add `documentationReview` to the existing ten-dimension quality
report (minor contract revision, not a second rubric). Require updated/no-impact
status, rationale and reviewed document hashes. No-impact can avoid a fabricated
doc edit, but cannot avoid review. Config/workflow changes also require review.
Existing historical reports are not rewritten to pretend they met a new gate.

The checker reuses the reference validator and an explicit active-document facts
policy. It includes new untracked Markdown and never silently ignores an invalid
policy. Generic user workspaces run link checks without AgentX-specific facts.
Role instructions and CI require it for every implementation; the quality
evaluator blocks completion if documentation evidence is missing or stale.

## Plan of Work

| Work | Owner | Acceptance |
|------|-------|------------|
| Semantic review contract | Gate implementer | Missing/rationale-free/stale-doc evidence blocks; valid no-impact and updated cases pass; config-only covered |
| Deterministic checker | Parent | Broken new-doc links, wrong counts/version and malformed policy fail; generic workspace works |
| Consolidation | Documentation implementer | Exact reviewed deletion list, updated current navigation, no dangling links, history retained |
| Workflow and delivery | Parent | Engineer/Reviewer steps, CLI, CI, bundle/seed and both pack installers aligned |
| Verification | Independent reviewer | Execute negative tests, validate final source/packaged docs, approve exact final hashes |

## Retention Policy

Delete only the audited completed plan/progress pairs for #248-253, two
superseded harness progress notes, the duplicate JSON-registry completion note,
and eight orphaned execution runtime snapshots. Review contents and preserve any
unique durable lesson in the retained guides/learning record before deletion.
Fix the contradictory status on plan #401 if its own checklist supports it.
Do not delete other historical records merely because a later release exists.
Do not edit generated extension documentation by hand; regenerate it.

## Verification and Acceptance

- Tests execute the checker and quality validator, not just search for headings.
- Missing doc assessment, stale/deleted reviewed docs and invalid paths fail.
- Code-only and config-only implementation fixtures cannot skip doc review.
- New untracked Markdown links are checked before staging.
- Active counts use recursive inventories and version.json; historical claims
  are not treated as current facts.
- CI replaces duplicated reference/count logic with the same checker.
- Surviving references, generated mirrors and installed assets remain valid.
- No unrequested user files outside this worktree are removed.

## Progress

- [x] Corpus audit, baseline and design alignment
- [x] Alternatives before implementation
- [x] Mandatory gate and regression tests
- [x] Consolidation and current-doc updates
- [x] Packaging/CI validation
- [x] Learning capture and exact removal ledger

Final independent approval and loop completion are authoritative in
`.agentx/state/doc-drift-final-review.json` and `.agentx/state/loop-state.json`.
This plan records implementation/verification facts, not a duplicate mutable
approval flag.

## Idempotence and Recovery

Checker is read-only. Deletions are limited to tracked, reviewed paths and remain
recoverable in Git history. Regenerate mirrors from source, preserve unrelated
worktree files, and never modify old evidence timestamps to satisfy new gates.

## Outcomes & Retrospective

Implemented the 2.1.0 review contract with mandatory `documentationReview`,
including config-only scope and current reviewed-doc hashes. The trusted
documentation checker runs before an otherwise valid report can pass.
Passing structural checks alone is not proof that prose is semantically current.

Verification before independent review:

- Quality rubric and loop integration: 73 assertions passed.
- Drift checker and feature/story/bug workflow hints: 16 passed.
- Actual CI documentation-step execution: 5 passed.
- Installed-runtime checks: 17 passed; fresh standalone docs have zero broken links.
- Customization parity: 236 passed; diagnose/bundle references: 68 passed.
- Active facts: 12 checked; source references have zero broken links.
- No new or growing token-budget violations were introduced.

Consolidated 15 redundant execution notes and removed 8 accidental runtime
snapshots, with exact paths and retention rationale in the learning record.
Retained original ADR/PRD/spec/review history; the one historical PRD reference
to a removed note now points to its exact Git revision. Removed unsupported
installation profiles, unsafe uninstall examples and the stale CLI command
count; clarified that retained component grades are not a new certification.

The broad framework run reached the pre-commit behavior tests and stalled;
that result is inconclusive, not reported as a full-suite pass.
