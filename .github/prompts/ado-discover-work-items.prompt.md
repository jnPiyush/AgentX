---
name: 'ADO: Discover Work Items'
description: 'Search for Azure DevOps work items matching a topic, keyword set, or user request.'
---

Search for existing Azure DevOps work items related to the current user request.

Follow the Discovery workflow in
#file:.github/instructions/ado/ado-wit-discovery.instructions.md.

1. Extract keyword groups from the user input or attached document.
2. Execute work item searches using `mcp_ado_search_workitem`.
3. Retrieve full details for candidate items.
4. Group and annotate results by type, state, and area.
5. Produce a structured discovery report in `.copilot-tracking/workitems/discovery/`.
6. Present findings and suggest next steps.
