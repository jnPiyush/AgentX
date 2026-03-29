---
name: 'ADO: Add Single Work Item'
description: 'Create a single Azure DevOps work item from a user description with the appropriate type and fields.'
---

Create one Azure DevOps work item based on the user description.

Use interaction templates from
#file:.github/instructions/ado/ado-interaction-templates.instructions.md
to compose the description and acceptance criteria.

1. Identify the work item type from the user request (Bug, User Story, Task, etc.).
2. Confirm or detect the ADO project and process template.
3. Check for existing duplicates using the Azure CLI or WIQL-backed discovery flow.
4. If no duplicates found, compose field values using the appropriate A-series template.
5. Apply content format detection (Markdown vs. HTML).
6. Create the item using the Azure CLI-based ADO provider flow.
7. Present the new work item ID and URL to the user.
