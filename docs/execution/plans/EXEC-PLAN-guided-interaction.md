---
title: Guided Frontier interaction
description: Implement user clarification, plan approval and milestone reporting through shared Frontier contracts and runtime state.
---

## Purpose / Big Picture

The user approved the five-stage recommendation on 2026-10-02. User-facing
Frontier agents clarify consequential uncertainty, propose a high-level plan,
wait for approval, and report milestone outcomes. Clear requests need no
artificial clarification question. Internal delegates reuse the parent's
scope; preauthorized automation remains explicit. Originating epic: #411.

One implementation owner uses the accepted decision and existing runtime.
Independent final review remains mandatory. Architecture and AI alignment
checkpoints accepted this direction; neither is final implementation approval
or a model-council execution.

## Progress

- [x] Repository context and current interaction paths reviewed.
- [x] Alternatives considered and user-facing approach approved.
- [x] Architecture and AI contract alignment completed.
- [x] File inventory and validation approach defined.
- [x] Shared contracts updated.
- [x] Native lifecycle and host adapters implemented.
- [ ] Current non-test verification and independent review recorded.
- [ ] Post-loop suite decision recorded.

## Surprises & Discoveries

- Native resume and extension state currently assume clarification text;
  neither represents an independently approved plan.
- Native session JSON needs atomic writes, a single writer, explicit corruption
  errors, and model-tool protection before it can hold authorization.
- The Claude Code bridge is deliberately text-only. HydraFusion cannot resume
  a native session. Neither limitation may become an implicit provider fallback.
- MCP already distinguishes candidate exit 3, but misclassifies pending human
  input exit 2 as an error. Its SDK supports host elicitation.

## Decision Log

- Options considered before implementation: instructions in every role;
  a separate orchestration framework/store; extending canonical guidance and
  the existing session/runtime/adapters.
- Selected: extend shared guidance and existing mechanisms. This avoids prompt
  duplication, a second authority store, and new framework dependencies.
- Approval is separate from clarification, quality review and test consent.
  Only an exact session/plan-version/digest decision from a caller or host
  input channel can approve a native plan. Tool arguments cannot approve.
- Canonical plan serialization uses a fixed runtime-owned field order and
  normalized bounded strings, not a new general JSON canonicalization package.
- Material unanswered questions in autonomous mode remain pending. They are
  not converted automatically into assumptions or default choices.
- Progress evidence is explicitly agent-reported; runtime observation of a tool
  call is not independent verification of a milestone's semantic correctness.

## Context and Orientation

| Surface | Reuse or change |
| --- | --- |
| `AGENTS.md`, shared protocol, thin host pointers | Extend the common interaction contract; reconcile autonomous language |
| Native runner | Reuse guarded tools, provider adapters, usage, compaction and session persistence |
| New interaction module | Bounded state/schema transitions, plan digest, permission checks, progress rendering |
| Native prompt | File-based tool/interaction instructions; reload current state after compaction |
| CLI run/resume, watch and ship | Explicit decisions and automation; preserve pending rather than claim completion |
| Extension chat/context/sidebar | Reuse pending-input cache and CLI streaming; preserve exact plan identity |
| MCP | Pending result contract and client-elicited resume; unsupported clients remain pending |
| Asset distribution | Ship module and prompt through existing installed-runtime packaging |
| Regression cases | Add state, native batch, persistence, host and distribution cases |
| Guide/changelog/learning | Document capability limits, commands, migration and evidence |

## Pre-Conditions

- [x] User approved the previously presented approach and implementation stages.
- [x] Clean baseline: `28cdbcea`.
- [x] Relevant skills and source inspected.
- [x] Quality loop started before source mutation.
- [x] Permission-sensitive implementation: at least five evidenced iterations.

## Plan of Work

Define the shared user contract first. Implement the state machine beside the
runner, then connect native dispatch, CLI, chat and MCP. Persist transitions
before announcing them. Retain existing role permissions, review and consent
boundaries. Prepare regression cases and run non-suite checks before review.

## Steps

| # | Step | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Discovery and alignment | Engineer | Complete | Existing runner and adapters traced |
| 2 | Shared contract and runtime | Engineer | Complete | Guided default; explicit automation |
| 3 | Host and installed-workspace wiring | Engineer | Complete | Actual consumer install and real MCP inspection |
| 4 | Verification and regression readiness | Engineer | Complete | Type/syntax/frontmatter checks; suites deferred |
| 5 | Independent review and delivery | Engineer / reviewer | Runtime-tracked | Current review and loop records are authoritative |

## Concrete Steps

- Parse changed PowerShell source and run Node syntax checks.
- Run extension compilation and applicable frontmatter/schema validators.
- Inspect real consumer asset output and scoped offline interaction diagnostics.
- Run scrub in advisory mode and synchronize repository context.
- Record current code-quality scope and independent review evidence.
- After successful loop completion, offer the relevant native/MCP/chat suites.

## Blockers

No unresolved design blocker. Live editor/model qualification remains a separate
environment-dependent check and must not be represented by mocked regressions.

## Validation and Acceptance

- [ ] A guided native run cannot mutate files before exact plan approval.
- [ ] Questions and approval are different pending kinds; silence is not consent.
- [ ] Plan revision invalidates approval immediately, including batch-tail calls.
- [ ] Stale, cross-session, cross-workspace and malformed resume decisions fail.
- [ ] Session persistence is atomic, single-writer and protected from model tools.
- [ ] Delegated clarification is read-only and cannot start user intake.
- [ ] Milestone updates carry stable IDs, version, outcome and reported evidence.
- [ ] Completion cannot skip unreported milestones or existing review gates.
- [ ] Explicit automation and unsupported engine/host behavior are documented.
- [ ] Chat and MCP preserve pending state and obtain genuine caller/host input.
- [ ] Initialized consumer workspaces receive the runtime and canonical guidance.
- [ ] Final independent review has no HIGH/MEDIUM findings; suites have explicit status.

## Idempotence and Recovery

One session writer owns each transition. Resume validates stored identity and
pending state before provider calls. Replaying a consumed or superseded decision
cannot execute work again. Cancellation preserves history; interruption preserves
the latest committed state rather than inventing completion.

## Rollback Plan

Revert only this feature's source changes if needed. Preserve session artifacts
for diagnosis; older runtimes must not be used to reinterpret guided approvals.
No automatic history rewrite, published release or existing installation change
is part of this task.

## Artifacts and Notes

Evidence goes under ignored `.frontier/state/`. Maintained tests are authored,
not run inside implementation loops or reviews. No provider/model change or
live inference budget is authorized by this implementation request.

Current evidence:

- `guided-typecheck.log`: TypeScript no-emit compilation, including actual
  chat-handler regression cases.
- `guided-parse.json`: PowerShell syntax results; error-level script analysis
  also completed without findings.
- `guided-frontmatter.log`: 637 checks passed, zero warnings/errors.
- `guided-mcp-inspection.json`: real stdio catalog with 22 tools and a successful
  native loop-status call; no model calls.
- `guided-consumer-inspection.json`: actual isolated Copilot CLI pack install,
  source-matching interaction module and working consumer run/resume help.
- `guided-scrub.json`: advisory-only duplicate-logic candidates across changed
  files; schema declarations and unrelated existing blocks were not rewritten.
- `guided-code-scope.json`: exact implementation paths and hashes for review.

Regression coverage is authored in the native guided behavior script, MCP
guided/lifecycle suites and extension guided interaction/shell suites. Existing
native provider/review fixtures now opt into their preauthorized autonomous
mode. No fixture result is represented as live model or editor qualification.

## Outcomes & Retrospective

Implementation and non-test verification are complete. Final independent
review, loop completion and the post-loop suite decision are recorded by the
runtime rather than inferred from these checkboxes. No release, installation
into an existing editor profile, commit or push is included in this task.

The first review requested changes: a misplaced completion gate bypassed final
milestone checks and discarded resolved clarification; direct CLI session-info
failed after output because exit status was not initialized. These root causes
are corrected with focused guided and real-process regression cases. Functional
LOW findings around Unicode, cancellation choices, response/session limits and
nonexistent pending authorization were also addressed. Cosmetic duplication
remains advisory; the next independent verdict is authoritative.
