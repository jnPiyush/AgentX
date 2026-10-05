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
