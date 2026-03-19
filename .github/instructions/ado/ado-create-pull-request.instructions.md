---
name: 'ADO Create Pull Request'
description: 'Instructions for validating a branch and creating an Azure DevOps pull request with linked work items.'
applyTo: '**/.copilot-tracking/pr/**'
---

# Azure DevOps Pull Request Creation

Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.

## Purpose

Validate a source branch, create a pull request, compose a description with linked
work items, and set reviewers.

## Tracking

Store all state under `.copilot-tracking/pr/new/`.

## Phase 1: Gather PR Context

From the user request or current git context, collect:

- Source branch name
- Target branch (default: main or develop)
- Repository name
- Project name
- PR title (derive from branch name when not provided)
- Work item IDs to link (from planning-log.md or user input)
- Reviewers (names or email addresses)

Write gathered context to `planning-log.md`.

## Phase 2: Validate Branch

1. Confirm the source branch exists and has commits not on the target.
2. Check for open PRs targeting the same source/target pair.
3. Flag conflicts when detected and present options to the user.

Write validation results to `artifact-analysis.md`.

## Phase 3: Resolve Reviewer Identities

1. For each reviewer, call `mcp_ado_core_get_identity_ids` to get identity GUIDs.
2. Record identity GUIDs in `planning-log.md`.

## Phase 4: Compose PR Description

1. Gather commit messages and changed file list for the branch.
2. Retrieve linked work item titles and descriptions.
3. Compose PR description using this structure:

```markdown
## Summary
{{summary_of_changes}}

## Related Work Items
* #{{work_item_id}} - {{work_item_title}}

## Testing
{{testing_notes}}

## Notes
{{additional_notes}}
```

Apply content format detection (Markdown vs. HTML) per planning spec before
writing.

## Phase 5: Create Pull Request

Under Partial autonomy: present the PR details (title, description, reviewers,
linked items) and wait for approval.

After confirmation:

1. Create the pull request via the ADO REST API or MCP PR tool.
2. Call `mcp_ado_wit_link_work_item_to_pull_request` for each linked work item.
3. Write PR URL and ID to `handoff.md`.

## Phase 6: Post-creation

1. Add a comment to each linked work item using template B7 (PR Linked).
2. Write completion summary to `handoff.md`:
   - PR URL and ID
   - Linked work items
   - Reviewers assigned
   - Source and target branches
   - Draft status
