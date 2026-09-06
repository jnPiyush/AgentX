---
description: 'Documentation consolidation: retiring redundant completed-plan pairs and rebuilding the docs navigation hub.'
confidence: 0.5
observations: 1
status: draft
category: documentation-drift
---

# LEARNING-20260905-documentation-drift: Verify redundancy before deleting, verify counts before publishing them

**Date**: 2026-09-05
**Issue**: Local-mode user request; no remote issue created.

## Context

`docs/execution/plans/EXEC-PLAN-20260905-documentation-drift.md` found stale
counts in navigation docs and a growing pile of completed plan/progress pairs
and CLI-generated JSON runtime snapshots sitting alongside active documentation
with no hub explaining which records are current, which are retained history,
and which are prunable. The task was scoped to documentation consolidation
only: fix real drift, delete only confirmed-redundant files, and leave the
active loop/plan, protocol/agent/template/script files, and the generated
vscode-extension mirror untouched.

## Learning

- Before deleting a "completed plan" pair, grep the whole repo for its exact
  filename, not just its topic. A plan and its progress file can each have
  different reference profiles (one may be linked from a PRD's Appendix while
  the other is unreferenced).
- A markdown-link reference checker (`scripts/validate-references.ps1`) only
  parses `[text](path)` syntax. Backtick-quoted bare paths (e.g.
  `` `docs/execution/progress/PROGRESS-x.md` ``) in an "Appendix / Related
  Artifacts" list are invisible to it and must be found with a plain text
  grep for the filename before deleting the target.
- CLI-generated JSON snapshots (task bundles, bounded-parallel runs) are
  runtime state, not documentation, even when they live under `docs/execution/`.
  Confirm the producing subcommand exists before writing that classification
  into a hub doc.
- When a doc states a count (skills, agents, commands), recompute it from the
  filesystem (`Get-ChildItem -Recurse -Filter SKILL.md`, `*.agent.md` in both
  the visible and `internal/` agent folders) rather than trusting the prior
  number. Two of three suspected count claims in this repo were stale; the
  third ("14 commands") could not be verified within the audited scope and
  was left unfixed rather than guessed.
- A plan's own unchecked final-checklist item is authoritative over any
  external assumption about its status. Do not flip a plan to "Complete"
  because related plans nearby already are; require the plan's own body to
  support it.
- Deleting a file that is referenced only by a non-hyperlink text mention in
  an out-of-scope doc (here, `docs/artifacts/prd/PRD-244.md`) will not fail an
  automated link check but still leaves a real dangling mention. Record it as
  known drift instead of silently deleting without disclosure, and instead of
  editing a file outside the ownership boundary.

## Evidence

- Reference checker run after all edits and deletions:
  `pwsh scripts/validate-references.ps1` -> Files scanned: 569, Links found:
  1944, Local checked: 1370, **Broken links: 0** ([PASS]).
- Removed 23 files (all previously verified `Status: Complete` with
  deliverables durably captured elsewhere, or confirmed-unreferenced runtime
  snapshots) - see the full list and per-item rationale in the task summary
  returned to the requester.
- Count corrections verified via `Get-ChildItem` before editing
  `docs/GUIDE.md` (skills: 107 -> 134) and `docs/QUALITY_SCORE.md` (agent
  table rows: 24 -> 26, adding the two internal sub-agents that were already
  on disk but missing from the table).
- `docs/execution/plans/EXEC-PLAN-401-cli-runtime-migration.md` left
  unchanged: its own Step 11 checklist still has an unchecked "Final
  subagent review reports zero HIGH/MEDIUM and the quality loop completes"
  item, so its own evidence does not support "Complete".

## Why It Matters

### Removal ledger

These are deletion records, not links to current files. The prior versions remain
in Git commit `586498ec8766150470c97c89488e36e032c46abf`.

| Completed pair | Removed plan and progress suffix |
|----------------|----------------------------------|
| #248 | `248-evidence-model.md` |
| #249 | `249-reset-vs-compaction-policy.md` |
| #250 | `250-contract-workflow-artifacts.md` |
| #251 | `251-contract-aware-operator-surfaces.md` |
| #252 | `252-pilot-pruning-guidance.md` |
| #253 | `253-runtime-contract-state.md` |

Each pair removed `docs/execution/plans/EXEC-PLAN-<suffix>` and
`docs/execution/progress/PROGRESS-<suffix>`. The durable contracts/guides remain.

Other removed transient notes under `docs/execution/progress/`:

- `PROGRESS-harness-controls.md`
- `PROGRESS-harness-design-adoption.md`
- `review-json-registry-complete-20260521-225948.md`

Removed generated snapshots:

```text
docs/execution/task-bundles/bundle-20260530-143311101-1e8631.json
docs/execution/task-bundles/bundle-20260530-145448907-d9f0aa.json
docs/execution/bounded-parallel/parallel-20260530-143355126-87a263.json
docs/execution/bounded-parallel/parallel-20260530-143409258-a27933.json
docs/execution/bounded-parallel/parallel-20260530-143425404-f2e322.json
docs/execution/bounded-parallel/parallel-20260530-145527466-9d4d08.json
docs/execution/bounded-parallel/parallel-20260530-145540655-b0b28c.json
docs/execution/bounded-parallel/parallel-20260530-145555326-0e5d62.json
```

The two generated snapshot patterns are now ignored to prevent accidental
reintroduction into the documentation corpus.

Parent integration resolved the remaining dangling PRD mention by linking to its
exact historical Git revision, removed the unsupported install-profile examples,
and replaced the stale CLI command count with the live help surface. Packaged
documentation no longer assumes that repo-only contribution files or a direct
workspace runner exist. These were navigation/portability corrections, not new
claims that every historical component was re-certified.

Consolidation work is easy to over-claim ("cleaned up all stale docs") or
under-verify ("deleted everything with an old date"). Grounding every
deletion in an actual reference search and every count in an actual file
listing keeps the navigation hub trustworthy without silently hiding the
drift that remains genuinely out of scope for one ownership slice.

## Additional checkpoint retirement: 2026-09-06

The following three deletions were already pending when the user requested
"commit uncommited changes". They are included in that requested checkpoint,
not retroactively counted in the 23-file consolidation ledger above:

| Pending deletion | Retention decision |
|------------------|--------------------|
| `docs/pitch/agentx-pitch.md` | Retire the v8.4.47 marketing narrative: it advertises 21 agents, 94 skills and an unconditional five-iteration minimum, rather than the current 26 agents, 134 skills and risk-based loop policy. |
| `docs/pitch/agentx-pitch.pptx` | Retire the companion generated presentation with its obsolete source package. |
| `docs/pitch/build_deck.py` | Retire the presentation-only generator with its output; it is not a runtime component or an active build dependency. |

The initial worktree status recorded all three as deleted before any new
remediation edits. Source/reference searches found no active consumer of the
generator or deck; the changelog's historical mention remains historical.
The source and binary remain recoverable from commit
`586498ec8766150470c97c89488e36e032c46abf`. Current product and operating guidance
remain in `README.md`, `docs/GUIDE.md` and `docs/WORKFLOW.md`. This is a bounded
retirement of the already-pending pitch package, not permission to delete other
historical artifacts.

## Promotion Path

Keep in draft until a second consolidation pass (e.g. the parent's planned
docs-drift policy/tool) reconfirms these patterns hold under automated
enforcement rather than a single manual audit.

## Related

- Plan: `docs/execution/plans/EXEC-PLAN-20260905-documentation-drift.md`
- Guide: `docs/guides/DOCUMENTATION-MAINTENANCE.md` (parent-authored retention
  and consolidation policy referenced from the rebuilt `docs/README.md`)
- Other LEARNING(s): none yet promoted for this category.
