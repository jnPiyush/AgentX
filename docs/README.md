# Docs Navigation Hub

This is the canonical entry point for `docs/`. The root [README.md](../README.md)
introduces AgentX; this page routes you to the reference guidance, durable
workflow artifacts, and living execution state that live underneath it.

## Canonical Locations

- Core reference docs stay at the top of docs/ when they are repo-wide guidance:
  - [WORKFLOW.md](WORKFLOW.md) -- delivery flow, checkpoints, handoffs
  - [GUIDE.md](GUIDE.md) -- install, setup, GitHub/Local/ADO modes, troubleshooting
  - [GOLDEN_PRINCIPLES.md](GOLDEN_PRINCIPLES.md) -- mechanical rules enforced by linters/agents
  - [QUALITY_SCORE.md](QUALITY_SCORE.md) -- component inventory and retained qualitative assessments
  - [tech-debt-tracker.md](tech-debt-tracker.md) -- known gaps and deferred work
- Implementation and operator guidance lives under `docs/guides/` (see below) when
  it is durable but does not fit the top-level reference set.
- Durable workflow artifacts remain in their established families and are
  retained regardless of age:
  - docs/artifacts/prd/
  - docs/artifacts/adr/
  - docs/artifacts/specs/
  - docs/artifacts/reviews/
  - docs/artifacts/learnings/
- Living execution artifacts use:
  - docs/execution/plans/
  - docs/execution/progress/
  - docs/execution/contracts/ (see [docs/execution/README.md](execution/README.md))

## Active vs. Retained Historical Records

- **Active**: an execution plan/progress pair is active while its `Status` is
  not `Complete` or its deliverables are not yet fully captured elsewhere.
- **Retained historical**: durable artifacts under `docs/artifacts/` (PRD, ADR,
  spec, review, learning) are never pruned for being old -- they are the
  permanent decision record. Supersession is marked explicitly in the document,
  not by deletion.
- **Prunable**: completed plans, progress logs, and one-off evidence summaries
  can be removed after their unique guidance and required proof are captured in
  retained documents and active references are updated. Drafts, blockers, and
  pending validation are not completed work. Recover retired run details from
  Git history rather than maintaining a second archive tree.
  See [docs/guides/DOCUMENTATION-MAINTENANCE.md](guides/DOCUMENTATION-MAINTENANCE.md#retention-and-consolidation)
  for the full retention classification and the `agentx doc-drift check` gate.
- **Runtime state, not documentation**: `docs/execution/task-bundles/` and
  `docs/execution/bounded-parallel/` hold CLI-generated JSON snapshots of
  bundle/parallel-delivery runs, not authored prose. They are pruned once
  archived/reconciled and are not treated as durable guidance.
- **Raw evidence**: command output, screenshots from individual runs, and loop
  reports belong in local `.agentx/state/` or CI artifacts. Keep a concise durable
  review or certification when the result must remain part of the decision record.

## Source vs. Mirror Ownership

- This `docs/` tree (and root `AGENTS.md`, `Skills.md`, `CLAUDE.md`) is the
  canonical source. Edit it directly.
- `vscode-extension/.github/**` (including its `docs/` copy) is a **generated
  mirror** kept in sync by `node vscode-extension/scripts/copy-assets.js`.
  Never hand-edit files under that path -- edit the source here and regenerate.

## Why This Split Exists

The docs/execution/ tree isolates living implementation state during issue
execution, while docs/artifacts/ collects durable PRDs, ADRs, specs, reviews,
and learnings under one canonical root.

## Current Guides (docs/guides/)

| Guide | Purpose |
|-------|---------|
| [CODING-HARNESS.md](guides/CODING-HARNESS.md) | Quality-first coding harness: working sequence, local CLI commands, token budgets |
| [DOCUMENTATION-MAINTENANCE.md](guides/DOCUMENTATION-MAINTENANCE.md) | Mandatory doc-drift review step, one-source-of-truth map, retention/consolidation policy |
| [RESET-VS-COMPACTION-POLICY.md](guides/RESET-VS-COMPACTION-POLICY.md) | When to continue, compact, or clean-reset during long-running work |
| [CONTRACT-HARNESS-PILOT-PRUNING.md](guides/CONTRACT-HARNESS-PILOT-PRUNING.md) | Pilot path and pruning rubric for the contract-driven harness flow |
| [HARNESS-PRUNING-RUBRIC.md](guides/HARNESS-PRUNING-RUBRIC.md) | When to simplify or remove harness constraints as model capability improves |
| [HARNESS-RESEARCH-20260905.md](guides/HARNESS-RESEARCH-20260905.md) | Coding harness research and design-council findings |
| [EVALUATOR-CALIBRATION.md](guides/EVALUATOR-CALIBRATION.md) | Few-shot PASS/FAIL calibration examples for the self-review evaluator |
| [WORKFLOW-OPERATOR-CHECKLIST.md](guides/WORKFLOW-OPERATOR-CHECKLIST.md) | Per-checkpoint operator checklist (Brainstorm/Plan/Work/Review) |
| [WORKFLOW-PILOT-ORDER.md](guides/WORKFLOW-PILOT-ORDER.md) | Ordered rollout sequence for workflow-cohesion pilot slices |
| [WORKFLOW-ROLLOUT-SCORECARD.md](guides/WORKFLOW-ROLLOUT-SCORECARD.md) | Pilot-gate scorecard tracking rollout slice readiness |
| [KNOWLEDGE-REVIEW-WORKFLOWS.md](guides/KNOWLEDGE-REVIEW-WORKFLOWS.md) | Compound review and learning-capture workflow contract |
| [AI-EVALUATION-LIGHTWEIGHT.md](guides/AI-EVALUATION-LIGHTWEIGHT.md) | Lightweight AI prompt/evaluation practices |
