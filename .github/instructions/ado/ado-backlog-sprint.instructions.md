---
name: 'ADO Backlog Sprint Planning'
description: 'Instructions for running an Azure DevOps sprint planning workflow for a team iteration.'
applyTo: '**/.copilot-tracking/workitems/sprint/**'
---

# Azure DevOps Sprint Planning

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Plan a team sprint by gathering backlog candidates, considering capacity, selecting
items, assigning estimates, and finalizing the iteration.

## Tracking

Store all state under `.copilot-tracking/workitems/sprint/{iteration-kebab}/`.

## Phase 1: Retrieve Team Context

1. Use Azure CLI or REST to list all team iterations.
2. Identify the target iteration (current sprint or user-specified).
3. Retrieve work items already assigned to that iteration.
4. Extract team capacity from existing `planning-log.md` or ask user for capacity
   when not available.

Write sprint info (iteration path, dates, capacity) to `planning-log.md`.

## Phase 2: Gather Backlog Candidates

1. Retrieve priority-ordered backlog items using Azure CLI or REST.
2. For top candidates, retrieve full work item details.
3. Filter out items with unresolved blockers or missing acceptance criteria.
4. Record candidates in `artifact-analysis.md` with fields:
   - Priority, Story Points or Effort, AreaPath, AssignedTo, Blocked flag.

## Phase 3: Dependency Check

For each candidate:

1. Inspect parent-child relationships. Flag children whose parents are unresolved.
2. Inspect Related and Blocking links. Mark blockers for follow-up.
3. Flag items with no story points estimate (need estimation before commitment).

Update `artifact-analysis.md` with dependency notes.

## Phase 4: Build Sprint Plan

1. Sort candidates by priority, accounting for team capacity.
2. Propose a sprint candidate list: committed items + stretch items.
3. Calculate total estimated effort and compare with capacity.
4. Write proposed assignments to `work-items.md`.
5. Format entry per the work-items.md template, including
   `System.IterationPath` updates.

Under Partial autonomy: present the plan and wait for user confirmation.

## Phase 5: Finalize and Execute

After user confirmation:

1. Apply iteration path updates using Azure CLI or REST patch calls.
2. Add sprint planning comment using the Azure CLI discussion path with
   template B1 (Status Update) for each committed item.
3. Write summary to `handoff.md`:
   - Sprint name and dates
   - Committed items with IDs and estimates
   - Stretch items
   - Total committed points vs. capacity
   - Items deferred with reasons
