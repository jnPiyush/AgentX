---
name: 'ADO Update Work Items'
description: 'Instructions for executing work item create and update operations from a finalized handoff file.'
applyTo: '**/.copilot-tracking/workitems/execution/**'
---

# Azure DevOps Work Item Execution

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Process a finalized `handoff.md` to create, update, and link ADO work items in
batch. Resume safely from partial execution using checkbox state.

## Tracking

Store all state under `.copilot-tracking/workitems/execution/{YYYY-MM-DD}/`.

## Phase 1: Load and Validate Handoff

1. Read `handoff.md` from the user-provided or most recent planning directory.
2. Confirm project name and repository match the current ADO context.
3. Resolve optional AreaPath and IterationPath from `work-items.md`.
4. Apply content sanitization guards:
   - Strip `.copilot-tracking/` paths from all field values.
   - Replace `WI[NNN]` references with ADO IDs or descriptive phrases.
5. Detect content format (Markdown vs. HTML) per planning specification.

Write execution context to `planning-log.md`.

## Phase 2: Execute Create Operations

Process all unchecked `(Create)` entries in `handoff.md` in order:

For each entry:

1. Build the `fields` array using templates from
   `ado-interaction-templates.instructions.md`.
2. Create the work item with Azure CLI using the resolved project, work item type, and fields.
3. Record the new ADO ID in `planning-log.md`.
4. Update the checkbox in `handoff.md` to checked.
5. Under Partial autonomy: present each create operation before calling the API.

## Phase 3: Execute Update Operations

Process all unchecked `(Update)` entries in `handoff.md`:

For each entry:

1. Retrieve the work item to confirm it still exists.
2. Build the `updates` array with patch operations for changed fields only.
3. Apply the update with Azure CLI or REST.
4. Update the checkbox in `handoff.md` to checked.
5. Under Partial autonomy: present state-change updates before calling the API.

## Phase 4: Apply Relationships

For each item with a `Relationships` section in `work-items.md`:

1. Resolve linked item IDs (from planning-log.md ADO ID map).
2. Apply each relationship with Azure CLI or REST.
3. Record linked pairs in `planning-log.md`.

## Phase 5: Post Comments

For items with required comment templates:

1. Compose comment using B-series templates from
   `ado-interaction-templates.instructions.md`.
2. Add the comment through the Azure CLI discussion/update path.

## Phase 6: Execution Summary

Write completion summary to `handoff.md`:

- Created items: IDs with ADO links
- Updated items: IDs with changed fields
- Linked items: relationship pairs
- Skipped items: reason for skipping
- Errors: item references with error message

If any operation failed, record error details but continue processing remaining items.
Report all errors in the summary.
