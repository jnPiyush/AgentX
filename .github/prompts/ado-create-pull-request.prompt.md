---
name: 'ADO: Create Pull Request'
description: 'Create an Azure DevOps pull request with a structured description and linked work items.'
---

Create a pull request for the current branch in Azure DevOps.

Follow the PR Creation workflow in
#file:.github/instructions/ado/ado-create-pull-request.instructions.md.

1. Gather source branch, target branch, project, and repository from context.
2. Validate the branch and check for existing open PRs.
3. Resolve reviewers through the Azure CLI or Azure DevOps REST flow described in the instruction file.
4. Compose the PR description using the Summary / Related Work Items / Testing template.
5. Present the PR details for approval, then create it.
6. Link the PR to associated work items and add a B7 comment on each.
7. Write the PR URL and details to `.copilot-tracking/pr/new/handoff.md`.
