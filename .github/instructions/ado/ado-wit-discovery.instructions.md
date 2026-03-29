---
name: 'ADO Work Item Discovery'
description: 'Instructions for discovering and summarizing Azure DevOps work items from search terms, documents, or user requests.'
applyTo: '**/.copilot-tracking/workitems/discovery/**'
---

# Azure DevOps Work Item Discovery

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Find, group, and summarize Azure DevOps work items matching a user request or set
of keywords. Output is a structured discovery report.

## Tracking

Store all state under `.copilot-tracking/workitems/discovery/{scope-name}/`.

## Phase 1: Build Search Queries

1. Extract keyword groups from the user request, document, or requirement brief.
   Each group covers one semantic concept.
2. Format the `searchText` parameter using the Search Keyword Protocol from
   `ado-wit-planning.instructions.md`.
3. Scope the search with `project` and optional `state` or `workItemType` filters
   based on user context.

Write keyword groups and scoping decisions to `planning-log.md`.

## Phase 2: Execute Search

For each keyword group:

1. Execute a WIQL-backed Azure CLI search and cap review to roughly 50 items.
2. Deduplicate results across groups (same ID seen in multiple groups).
3. Write raw results to `artifact-analysis.md` keyed by work item ID.

## Phase 3: Retrieve Full Details

For each unique work item in the result set:

1. Retrieve each work item in full using Azure CLI or REST.
2. Extract: Title, Type, State, AreaPath, IterationPath, AssignedTo, Tags,
   Description preview, and relationship counts.
3. Update `artifact-analysis.md` with full detail rows.

## Phase 4: Group and Annotate

Group results by:

- Work item type (Epic / Feature / User Story / Bug / Task)
- State (New / Active / Resolved / Closed)
- Area Path (when multiple areas are represented)

For each group, note:

- Total item count
- Cross-references to related work items (parent/child/linked)
- Average age (days since creation)

## Phase 5: Produce Discovery Report

Write `handoff.md` with:

- Discovery scope (keywords, project, filters)
- Grouped summary tables (type x state matrix)
- Top-ranked matches by relevance with field preview
- Items that need additional review or have incomplete data
- Suggested next steps (triage, sprint plan, execution)

Present the report to the user. If the user requests actions on discovered items,
dispatch them to the routing table in the ADO Backlog Manager.
