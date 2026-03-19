---
name: 'ADO: Execute Work Item Updates'
description: 'Process a finalized handoff file to create, update, and link Azure DevOps work items.'
---

Execute work item operations from the current planning handoff file.

Follow the execution workflow in
#file:.github/instructions/ado/ado-update-wit-items.instructions.md.

1. Load the most recent `handoff.md` from `.copilot-tracking/workitems/`.
2. Apply content sanitization guards before any ADO API call.
3. Process all (Create) entries, then (Update) entries, then relationships.
4. Post comments on updated items using interaction templates.
5. Record ADO IDs for all created items in `planning-log.md`.
6. Write an execution summary to `handoff.md`.
