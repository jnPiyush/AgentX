# Execution Artifacts

This directory holds the living artifacts for complex work that is still being executed, reviewed, or validated.

## Folders

- `plans/` contains the execution plan for a complex task.
- `progress/` contains the matching progress log for that task.
- `contracts/` contains bounded work contracts and their matching evidence summaries used inside the `Work` checkpoint for complex tasks.
- `task-bundles/` and `bounded-parallel/` hold CLI-generated JSON snapshots from
  the `agentx bundle` and `agentx parallel` commands, backing the "Task bundles"
  and "Bounded parallel delivery" pilot slices in `docs/guides/WORKFLOW-PILOT-ORDER.md`.
  These are runtime state, not authored documentation: prune them once a
  bundle/parallel run is archived or reconciled and no longer needed for
  reference, the same way stale `plans/`+`progress/` pairs are pruned.

## Naming Guidance

- Prefer `EXEC-PLAN-<issue>-<topic>.md` for plans.
- Prefer `PROGRESS-<issue>-<topic>.md` for progress logs.
- Prefer `CONTRACT-<issue>-<topic>.md` for bounded work contracts.
- Prefer `EVIDENCE-<issue>-<topic>.md` for the matching evidence summary.
- Keep the topic stem stable so search results and pairings remain obvious.

## Keep This Directory Active

- Retain draft, blocked, partially delivered, and pending-validation work.
- Remove completed plans, progress logs, and one-off evidence only after unique
  decisions and required proof are captured in a retained guide, spec, review,
  learning, or certification. Update active links before removal.
- Preserve records consumed by packaging, tests, or another active contract.
- Store raw run output in local `.agentx/state/` or CI artifacts, not new tracked
  Markdown reports. Do not create a parallel `archive/` tree.
- Use `git log -- docs/execution` and `git show <commit>:<path>` to recover retired
  execution detail. Historical results are not a current validation claim.

## Relationship To Other Docs

- Durable design artifacts still live in `docs/artifacts/prd/`, `docs/artifacts/adr/`, `docs/artifacts/specs/`, `docs/artifacts/reviews/`, and `docs/artifacts/learnings/`.
- Execution artifacts are living state, not the final long-term source of product or architecture truth.
- Work contracts are nested execution artifacts: they bound the active slice inside `Work`, but they do not create a second workflow lifecycle.
- Evidence summaries are the matching proof layer for those contracts, distinguishing what changed, what was checked, and what was observed on the real surface.
- See [docs/README.md](../README.md) for the canonical navigation hub and the
  retention rule for completed plan/progress pairs, and
  [docs/guides/DOCUMENTATION-MAINTENANCE.md](../guides/DOCUMENTATION-MAINTENANCE.md)
  for the full retention/consolidation classification.