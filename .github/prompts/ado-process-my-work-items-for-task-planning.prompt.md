---
name: 'ADO: Plan My Work Items'
description: 'Retrieve work items assigned to the current user and recommend a prioritized task plan.'
---

Retrieve the current user assigned work items and produce a task plan.

1. Call `mcp_ado_wit_my_work_items` with type `assignedtome` and `includeCompleted: false`.
2. Group items by sprint (current, upcoming, backlog).
3. Sort within each group by priority and estimated effort.
4. Flag items missing estimates, acceptance criteria, or parent assignments.
5. Break down large items into sub-tasks where helpful.
6. Write the plan to `.copilot-tracking/workitems/current-work/planning-log.md`.
7. Present recommended order with reasoning and estimated daily focus allocation.
