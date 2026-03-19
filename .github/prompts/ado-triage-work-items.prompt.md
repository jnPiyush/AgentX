---
name: 'ADO: Triage Work Items'
description: 'Classify un-triaged Azure DevOps backlog items with priority, area path, and duplicate detection.'
---

Run the backlog triage workflow for the current ADO project.

Follow the Triage workflow in
#file:.github/instructions/ado/ado-backlog-triage.instructions.md.

1. Query all items in New state with missing priority or area path.
2. Classify each item by type, priority, and area path.
3. Flag high-confidence duplicates for closure.
4. Flag stale items (unchanged > 90 days).
5. Produce a triage report in `.copilot-tracking/workitems/triage/`.
6. Present the report awaiting approval before applying changes (Partial autonomy).
