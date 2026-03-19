---
name: 'ADO: Get Build Info'
description: 'Query Azure DevOps build pipeline status and failure details, optionally linking results to work items.'
---

Retrieve build pipeline information for the specified build, PR, or branch.

Follow the Build Info workflow in
#file:.github/instructions/ado/ado-get-build-info.instructions.md.

1. Identify the build context: build ID, pipeline name, or PR number.
2. Retrieve build status, stage timeline, and duration.
3. Extract failure details when the build is in a failed state.
4. Search for associated work items.
5. Optionally link build artifacts to work items (requires user confirmation).
6. Write a build report to `.copilot-tracking/pr/handoff.md`.
