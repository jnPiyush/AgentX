# Docs Structure

This directory has a canonical split between reference guidance, durable workflow artifacts, and living execution state.

## Canonical Locations

- Core reference docs stay at the top of docs/ when they are repo-wide guidance:
  - [FEATURES.md](FEATURES.md): source-versioned feature inventory and availability notes
  - WORKFLOW.md
  - GUIDE.md
  - GOLDEN_PRINCIPLES.md
  - QUALITY_SCORE.md
  - tech-debt-tracker.md
- Implementation and operator guidance can live under `docs/guides/` when they are durable but do not fit the top-level reference set.
- Durable workflow artifacts remain in their established families:
  - docs/artifacts/prd/
  - docs/artifacts/adr/
  - docs/artifacts/specs/
  - docs/artifacts/reviews/
  - docs/artifacts/learnings/
- Living execution artifacts use:
  - docs/execution/plans/
  - docs/execution/progress/

## Why This Split Exists

The docs/execution/ tree isolates living implementation state during issue execution, while docs/artifacts/ collects durable PRDs, ADRs, specs, reviews, and learnings under one canonical root. 

## Current Guide Examples

- `docs/guides/AI-EVALUATION-LIGHTWEIGHT.md` for lightweight AI prompt/evaluation practices
- `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md` for compound review and learning capture guidance
- [Loop operations](guides/LOOP-OPERATIONS.md) for review gates, post-loop test
  records and their retention limits

## Workspace Housekeeping

- `build/` contains local scratch outputs, but can also hold registered Git
  worktrees, archived workspace data and referenced review evidence. Being
  ignored or old is not sufficient reason to delete a file.
- Remove only inspected, unreferenced intermediate outputs or superseded
  packages that are not used by an active process. Preserve final reports,
  baselines, signed release records and the current package/checksum pair.
- Keep source, dependency manifests, installed dependencies, current bundled
  runtime assets, project memory and durable `docs/artifacts/` records.
  Workspace configuration, issue/session state, pending candidates and loop
  evidence have separate lifecycles; do not blanket-delete their directories.
- Inspect worktrees with `git worktree list`; never treat a registered checkout
  as disposable build output. Do not use a repository-wide `git clean` as a
  shortcut for selective housekeeping.
- After documentation edits, run the reference validator and regenerate bundled
  documentation through the existing asset copier rather than deleting mirrors
  by hand.

From the repository root in PowerShell 7 on any supported OS:

```powershell
pwsh (Join-Path scripts validate-references.ps1) -Path docs
$copyAssets = Join-Path vscode-extension scripts copy-assets.js
node $copyAssets
node $copyAssets --check
```
