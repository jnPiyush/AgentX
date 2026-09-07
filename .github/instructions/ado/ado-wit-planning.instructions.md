---
name: 'ADO Work Item Planning'
description: 'Reference specification for Azure DevOps work item planning files, templates, field definitions, and search protocols -- adapted for AgentX.'
applyTo: '**/.copilot-tracking/workitems/**'
---

# Azure DevOps Work Items Planning File Instructions

## Purpose and Scope

Read this root file first. It keeps the active execution contract in one place and routes deeper planning templates, field catalogs, and search procedures to required companion references.

**Source preservation**: LF-normalized original hash `CC5F33115F6FDDD9D1A8C5DE0F3DD141FD06933AD875E11BF0142C1FAAA7AE15`. The full prior body is retained verbatim in the `split-*` references linked below.

## Required Companion References

| Topic | Required reference |
|------|--------------------|
| Original consuming `#file:` pattern and the full provider plus Azure CLI execution contract | [split-ado-provider-and-cli-contract.md](split-ado-provider-and-cli-contract.md) |
| Planning workspace structure and `artifact-analysis.md` / `work-items.md` templates | [split-ado-planning-files.md](split-ado-planning-files.md) |
| `planning-log.md` / `handoff.md` templates and ordering rules | [split-ado-planning-log-and-handoff.md](split-ado-planning-log-and-handoff.md) |
| Work item field definitions and type-specific field matrix | [split-ado-work-item-fields.md](split-ado-work-item-fields.md) |
| Full search procedure, similarity assessment, state persistence, and the full autonomy table | [split-ado-search-and-state.md](split-ado-search-and-state.md) |
| Full sanitization and content-format rules | [split-ado-sanitization-and-format.md](split-ado-sanitization-and-format.md) |

## Current ADO Execution Path

The AgentX ADO work-item provider uses Microsoft's Azure DevOps MCP Server only. Load [split-ado-provider-and-cli-contract.md](split-ado-provider-and-cli-contract.md) when you need the verbatim original provider and Azure CLI fallback contract.

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

Authenticate the MCP server per its documentation, typically with `AZURE_DEVOPS_PAT`. For PR, pipeline, or REST scenarios outside the built-in work-item provider, prefer Azure CLI first and `az devops invoke` only when no first-class CLI wrapper exists.

## Dispatch and Authorization Contract

Consuming workflow files should cite this root file with the existing cross-reference pattern before execution. Reads are always autonomous. Writes follow the autonomy gate below and must still apply the sanitization rules from this root before sending user-visible content.

| Mode | Create | Update | Link | State Change |
|------|--------|--------|------|--------------|
| Full | Auto | Auto | Auto | Auto |
| Partial (default) | Gate | Auto | Auto | Gate |
| Manual | Gate | Gate | Gate | Gate |

## Search Safety Rules

- Build ordered keyword groups of 1-4 specific terms and execute WIQL-backed search with bounded downstream review (roughly 50 results).
- Prefer candidates whose highlights match the planned item's core concepts and whose work-item type is the same or one level above or below.
- Fetch the full work item before assigning `Match`, `Similar`, `Distinct`, or `Uncertain`.
- If the title, description, acceptance criteria, or type relationship is genuinely ambiguous, stop and request user guidance instead of guessing.
- Update `planning-log.md` as you search so discovery is resumable after context compaction.

## Content Sanitization Guards

- Never send `.copilot-tracking/` paths to ADO APIs. Read the file locally, extract the relevant facts, and replace the path with an inline summary.
- Never send planning reference ids such as `WI001` to ADO APIs. Replace them with the mapped ADO id, a descriptive phrase, or remove a self-reference.

## Planning File Definitions and Directory Conventions

Load [split-ado-planning-files.md](split-ado-planning-files.md) before creating or editing planning artifacts.

## planning-log.md

Load [split-ado-planning-log-and-handoff.md](split-ado-planning-log-and-handoff.md) before changing planning-log or handoff content.

## Work Item Fields

Load [split-ado-work-item-fields.md](split-ado-work-item-fields.md) for the complete field catalog and type-specific requirements.

## Search Keyword and Search Text Protocol

Load [split-ado-search-and-state.md](split-ado-search-and-state.md) for the full deterministic search procedure, similarity categories, and human-review triggers.

## State Persistence Protocol

Load [split-ado-search-and-state.md](split-ado-search-and-state.md) for pre-summarization capture, post-summarization recovery, and the retained full autonomy table.

## Content Format Detection

Load [split-ado-sanitization-and-format.md](split-ado-sanitization-and-format.md) before writing Markdown or HTML rich-text fields.
