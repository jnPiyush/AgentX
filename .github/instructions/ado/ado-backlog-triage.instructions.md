---
name: 'ADO Backlog Triage'
description: 'Step-by-step instructions for running an Azure DevOps backlog triage workflow.'
applyTo: '**/.copilot-tracking/workitems/triage/**'
---

# Azure DevOps Backlog Triage

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Identify un-triaged items; classify type, priority, and area; flag duplicates; tag
stale items; and produce a triage report for team review.

## Tracking

Store all state under `.copilot-tracking/workitems/triage/{YYYY-MM-DD}/`.

## Phase 1: Query Un-triaged Items

1. Query candidate work items with state `New` and no area path using Azure CLI or WIQL.
2. For each result, retrieve full work item details.
3. Write results to `artifact-analysis.md` keyed by WI[NNN] reference.

Skip items that already have both `Priority` and `AreaPath` set; they are
considered pre-triaged.

## Phase 2: Classify Each Item

For each un-triaged item:

1. **Type check**: Confirm work item type matches content (bug vs. user story vs.
   task). Recommend type change when mismatched.
2. **Priority assignment**: Apply a default priority matrix:
   - P1: production-blocking, security, data-loss risk
   - P2: user-facing regression or contract violation
   - P3: degraded experience or tech-debt
   - P4: minor improvement or enhancement
3. **Area Path**: Map to project area using keyword heuristics (component names,
   team tags, module references). Flag for manual assignment when unresolvable.
4. **Tags**: Extract tags from title and description keywords. Append new tags to
   existing tag list.

Write all classifications to `work-items.md` using the WI[NNN] scheme.

## Phase 3: Duplicate Detection

For each un-triaged item:

1. Build a keyword group from the item title and first two sentences of description.
2. Run a WIQL-backed Azure CLI search with those keywords.
3. Perform similarity assessment (see `ado-wit-planning.instructions.md`).
4. For high-confidence duplicates (Category = Match):
   - Set proposed action to "Close as Duplicate".
   - Record the target work item ID in `artifact-analysis.md`.

## Phase 4: Stale Item Flagging

1. Retrieve `System.ChangedDate` for all items in triage scope.
2. Flag items unchanged for more than 90 days with a `stale` tag proposal.
3. Flag items in `Active` state with no sprint assignment or remaining-work value.

## Phase 5: Summary Report

Write `handoff.md` with:

- Total items triaged
- Breakdown by classification (type, priority changes)
- Duplicate candidates (with target IDs)
- Stale items flagged
- Items requiring manual area path assignment

Under Partial autonomy: present the full report and wait for approval before
applying any ADO field updates.

Under Full autonomy: apply all non-duplicate field updates, then present the report.
