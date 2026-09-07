# split-ado-provider-and-cli-contract

> Source: [ado-wit-planning.instructions.md](ado-wit-planning.instructions.md)
> Source hash (LF-normalized original file): `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`
> Read routing: load this companion when you need the original consuming `#file:` pattern or the full Azure CLI fallback contract that was previously inline in the root instruction.
> Relocation manifest:
> - `## Purpose and Scope` -> original lines 9-20
> - `## Current ADO Execution Path` -> original lines 23-83
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## Purpose and Scope

This file is a reference specification that defines templates, field conventions,
and search protocols for work item planning files. Workflow files consume this
specification by including a cross-reference at the top of their content.

Cross-reference pattern for consuming files:

```markdown
Follow all instructions from
#file:.github/instructions/ado/ado-wit-planning.instructions.md while executing
this workflow.
```

## Current ADO Execution Path

The AgentX ADO work-item provider uses Microsoft's Azure DevOps MCP Server only.

Required config in `.agentx/config.json`:

- `organization`: plain org name, `https://dev.azure.com/<org>`, or `https://<org>.visualstudio.com`
- `project`: Azure DevOps project name
- Optional `adapters.ado.mcpCommand`: custom server launch command
- Optional `adapters.ado.mcpTools`: tool-name overrides for forks or wrappers of the MCP server

Default MCP tool names (overridable via `adapters.ado.mcpTools`):

- Retrieval: `wit_get_work_item`
- Create: `wit_create_work_item`
- Update: `wit_update_work_item`
- Comment: `wit_add_work_item_comment`
- Query (WIQL): `wit_query_by_wiql`

Authenticate the MCP server per its documentation, typically with `AZURE_DEVOPS_PAT`.

For PR, pipeline, or REST scenarios outside the built-in work-item provider, use Azure CLI first and `az devops invoke` only when no first-class CLI wrapper exists.

Discovery and retrieval:

- `az boards query`: Search work items with WIQL.
  Key inputs: WIQL string, `--organization`, `--project`, `--output json`.
- `az boards work-item show`: Retrieve a single work item.
  Key inputs: `--id`, `--organization`, `--output json`.
- `az devops invoke`: Fallback for batch retrieval or specialized REST endpoints.

Iteration:

- Prefer Azure CLI commands when available; otherwise use `az devops invoke`
  against the team iterations REST endpoints.

Creation and updates:

- `az boards work-item create`: Create a new work item.
  Key inputs: `--title`, `--type`, optional `--description`, `--fields`,
  `--organization`, `--project`, `--output json`.
- `az boards work-item update`: Update work item fields, state, tags, and discussion.
  Key inputs: `--id`, `--fields`, `--state`, `--discussion`,
  `--organization`, `--output json`.
- `az devops invoke`: Fallback for batch updates or relationship patch payloads.

Relationships and linking:

- Prefer `az devops invoke` against the work item relations REST endpoints.
- For pull requests and builds, prefer first-class `az repos pr` or
  `az pipelines build` commands when they cover the scenario; otherwise use REST.

History and comments:

- `az boards work-item update --discussion ...` adds a discussion entry.
- Use `az devops invoke` for comment history or revision history when needed.

Identity:

- Prefer Azure DevOps REST identity lookups via `az devops invoke` when reviewer
  or assignee GUID resolution is required.
