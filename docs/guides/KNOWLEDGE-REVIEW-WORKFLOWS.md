# Knowledge And Review Workflows

## Purpose

This guide defines the shared workflow contract for three related AgentX concerns:

- post-review knowledge capture
- agent-native review parity
- durable review findings and promotion

These concerns are intentionally documented together because they form one review-time workflow: evaluate parity, decide what should be preserved, and track durable follow-up work when review findings require it.

## Workflow Chain

1. Finish implementation review and validation.
2. Run agent-native review to check action parity, context parity, and shared workspace expectations.
3. Resolve whether the outcome creates reusable knowledge that should be captured.
4. Persist durable review findings when follow-up work should survive beyond the current review cycle.
5. Promote important findings into the normal AgentX backlog instead of creating a parallel tracker.

## Agent-Native Review

### Review Lens

Agent-native review is architectural and workflow-focused. It does not score naming style, formatting taste, or subjective implementation preferences.

The review asks three questions:

1. Action parity: can agents reach the same high-value review-time actions that users can trigger?
2. Context parity: do agents and users operate on the same workspace, issue, plan, review, and state context?
3. Shared workspace expectations: do both paths resolve the same repo-local artifacts, guidance, and workflow contracts?

### Capability Map

| Capability | User Surface | Agent Surface | Shared Artifacts | Why It Matters |
|------------|--------------|---------------|------------------|----------------|
| Workflow execution | Command palette, Work sidebar | `@agentx run ...` | issue, plan, workflow state | Review findings are weak if agents cannot trigger the same delivery flow |
| Review learnings retrieval | Command palette, Work sidebar | `@agentx learnings review ...` | `docs/learnings/` | Review should reuse prior solutions without user-only lookup steps |
| Knowledge capture guidance | Command palette, Work sidebar | `@agentx capture guidance` | this guide, `docs/learnings/` | Reusable outcomes should be preserved consistently after review |
| Durable review findings | Command palette, Quality sidebar | `@agentx review findings` | this guide, `docs/reviews/findings/` | Important review outcomes should remain visible across sessions |

### Scoring Rubric

#### Action Parity

- 100%: every mapped capability is available in both user and agent surfaces
- 50-99%: at least one mapped capability is missing from one side
- 0-49%: review-time actions are materially user-only or agent-only

#### Context Parity

- 100%: workspace root, pending clarification state, execution plan access, and state-file access are shared
- 50-99%: one shared context dependency is missing or indirect
- 0-49%: user and agent flows rely on different context models

#### Shared Workspace Expectations

- 100%: review guidance, templates, and review surfaces all point at the same repo-local contract
- 50-99%: one contract artifact or review surface is missing
- 0-49%: review output depends on disconnected or host-specific assumptions

### Severity Model

- High: a user-visible review capability is not reachable for agents, or vice versa
- Medium: the capability exists, but shared context or contract artifacts are missing
- Low: the parity path exists but is weakly documented or exposed in only one minor surface
- None: no parity gap detected

### Output Expectations

Agent-native review output should include:

- a capability map
- per-pillar scores for action parity, context parity, and shared workspace expectations
- concrete findings that point to architectural gaps
- an advisory-first recommendation, not an immediate hard gate

## Knowledge Capture

### Trigger Model

- Mandatory capture:
  Work produces reusable workflow, architecture, review, validation, or operator guidance that is likely to help future planning or review.
- Optional capture:
  Work is useful but narrow, local, or low-leverage, so a capture artifact is helpful but not required.
- Skip capture:
  Work is trivial, transient, duplicated by an existing learning, or too weakly validated to preserve as durable guidance.

### Operator-Facing Path

1. Finish review and validate the final outcome.
2. Resolve the capture decision as mandatory, optional, or skip.
3. When capture is produced, store it under `docs/learnings/LEARNING-<issue>.md`.
4. Link the learning back to the originating issue and its supporting ADR, spec, review, or validation artifacts.
5. If capture is skipped, record a short rationale in the close-out summary or issue comment.

### Autonomous Execution Path

1. AgentX finishes the same review and validation steps it would require from an operator.
2. AgentX resolves the capture decision after review, not during initial implementation.
3. When capture is required or accepted, AgentX creates the learning artifact and mentions it in the final summary.
4. The flow stays advisory-first until stronger automation and duplication checks are proven.

### Artifact Location

- Curated durable learnings: `docs/learnings/LEARNING-<issue>.md`
- Durable review findings: `docs/reviews/findings/FINDING-<issue>-<id>.md`
- Source documents remain in their original families, such as `docs/adr/`, `docs/specs/`, `docs/reviews/`, and issue state

### Minimum Link-Back Requirements

Each curated learning should link back to:

- the originating issue
- the main supporting design or execution artifacts
- the review or validation artifact that makes the learning trustworthy

## Durable Review Findings

### Durable Record

Store durable review findings under `docs/reviews/findings/FINDING-<issue>-<id>.md`.

Each durable finding record should capture:

- source review artifact
- source issue when known
- severity
- workflow status using the standard AgentX status set
- priority using `p0` through `p3`
- owner or suggested owner
- dependencies
- evidence links
- promotion classification
- linked backlog issue once promoted

### Status Contract

Durable findings reuse the normal AgentX workflow states so review follow-up does not create a second state machine.

| Status | Meaning |
|--------|---------|
| Backlog | Finding is captured and awaiting triage or promotion |
| Ready | Finding has been accepted as follow-up work and is ready to be picked up |
| In Progress | Follow-up implementation is underway |
| In Review | Follow-up change is under review |
| Done | Follow-up is resolved or explicitly closed |

### Promotion Contract

Each finding must declare one of these promotion modes:

- `review-only`: preserve the finding in the review record, but do not create a backlog item
- `recommended`: finding is important enough that maintainers should normally promote it
- `required`: finding should become tracked backlog work unless it is immediately resolved in the current review cycle

### Promote Versus Keep Review-Only

Promote the finding when one or more of these conditions are true:

- the finding affects correctness, security, resilience, or workflow safety
- the finding requires code or documentation work beyond the current review cycle
- the finding should be prioritized, assigned, or tracked across sessions
- the finding blocks parity, review quality, or repeatable operator behavior

Keep the finding review-only when one or more of these conditions are true:

- the note is informational and needs no tracked follow-up
- the issue is already fully covered by an existing backlog item
- the concern is too weakly evidenced to justify tracked work
- the fix is completed before the review closes

### Lifecycle Rules

1. Capture the durable finding record during review or immediately after review.
2. Use `Backlog` as the initial status for captured findings.
3. Promote only into the existing AgentX issue flow. Do not create a parallel tracker.
4. When promoted, link the created backlog issue number back into the finding record.
5. Let the promoted issue follow the normal AgentX workflow from `Backlog` to `Done`.
6. Keep dependencies and evidence links in the finding record even after promotion.

## Notes

- Local and GitHub-backed workflows should use the same artifact-based contract even when storage or status plumbing differs.
- Do not create a second backlog or sidecar tracker for learnings.
- Do not treat raw runtime observations as curated learnings by default.
- Prefer a small number of high-signal learning artifacts over a large volume of weak notes.