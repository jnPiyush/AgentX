# Cowork Plugin Authoring Guide

Reference material for building a Microsoft 365 Copilot Cowork plugin. Capture these
fields before creating files, then validate the package before upload.

## Capability Definition

| Field | Purpose |
|-------|---------|
| Plugin name | Short and full names shown in the app list |
| Business capability | The outcome the plugin supports |
| Skill inventory | At least one specialized skill, or a connector-only package, with clear separation between skills |
| Inputs | Files, emails, documents, requirements, or meeting notes |
| Outputs | Reports, recommendations, checklists, or action items |
| Connector need | None, Microsoft Graph, Jira, ServiceNow, SAP, Dataverse, or a custom API |
| Owner | Accountable owner for versioning and release notes |

Avoid one large skill. Example inventories:

| Plugin | Skills |
|--------|--------|
| Legal Contract Assistant | draft-contract, risk-review, clause-analysis |
| Architecture Assistant | solution-review, adr-generator, non-functional-assessment |
| Migration Assistant | repository-assessment, migration-plan, security-review |

## Package Layout

```text
manifest.json
color.png
outline.png
skills/
  solution-review/
    SKILL.md
    references/architecture-principles.md
  adr-generator/
    SKILL.md
tools/
  connector-tools.json
```

Skills-only, connector-only, and combined packages are all valid. A `tools/` folder is
required only when a connector declares `mcpToolDescription`.

## Manifest Fields

The manifest uses the Microsoft 365 unified app manifest schema. The root sets
`additionalProperties: false`, so any field outside the schema fails upload.

| Field | Requirement |
|-------|-------------|
| `manifestVersion` | Must be `1.28` |
| `id` | Stable GUID that does not change across versions |
| `version` | Semantic version of the package |
| `developer` | `name`, and public `websiteUrl`, `privacyUrl`, `termsOfUseUrl` |
| `name` | `short` is required; `full` is optional |
| `description` | Both `short` and `full` are required |
| `accentColor` | Required six-digit hex color, for example `#2B579A` |
| `icons` | `color` and `outline` file names present in the package |
| `agentSkills` | One `folder` entry per skill, up to 20 |
| `agentConnectors` | Optional, up to 10 connectors |

## Skill Rules

* `name` is kebab-case: lowercase alphanumerics and single hyphens, no leading, trailing, or consecutive hyphens
* `name` is 1 to 64 characters and matches the folder leaf exactly
* `description` is 1 to 1024 characters and includes realistic trigger phrases
* Keep the `SKILL.md` body under roughly 2,000 words and move depth to `references/`
* Reference companion files explicitly so the agent knows they exist

## Companion File Rules

| Rule | Limit |
|------|-------|
| Companion files per skill | 20 |
| Size per companion file | 5 MB |
| Total companion size per skill | 10 MB |

Paths must be relative, without `..` segments, backslashes, or null bytes. File names
must avoid hidden names that start with a dot, Windows reserved names such as `CON`,
`PRN`, `AUX`, `NUL`, `COM1` through `COM9`, and `LPT1` through `LPT9`, and must use only
alphanumerics, hyphens, underscores, dots, spaces, and `!`.

## Connector Rules

* Transport is Streamable HTTP over HTTPS with TLS 1.2 or later
* `id` and `displayName` are required, and every `id` is unique in the manifest
* `toolSource` is optional, and `remoteMcpServer` is its only supported property
* `mcpToolDescription.file` is required and that file must ship inside the zip
* `authorization.type` is one of `None`, `OAuthPluginVault`, `ApiKeyPluginVault`, or `DynamicClientRegistration`
* `authorization.referenceId` is required for every type except `None`
* Omit the `authorization` object entirely when the MCP server needs no declared authorization configuration
* Tool names and descriptions must be specific and non-duplicative so routing stays unambiguous
* Set `readOnlyHint` and `destructiveHint` accurately; unannotated tools are treated as destructive

## Quality Review

| Area | Question |
|------|----------|
| Routing | Can Cowork tell when each skill applies from its description alone? |
| Non-overlap | Does exactly one skill own each scenario? |
| Output format | Does each skill define a reusable output structure? |
| Connector usage | Are tool names distinguishable and non-duplicative? |
| Boundaries | Does each skill state when not to use it and what it must not assume? |
| Safety | Is the package free of passwords, API keys, client secrets, personal data, and unapproved customer data? |

## Test Cases

1. Each skill activates for its intended request.
2. Skills do not activate for unrelated requests.
3. Similar skills route to the correct owner.
4. References are available to the relevant skill.
5. Connectors initialize and each tool returns the expected result.
6. Authentication and consent behave as designed.
7. Actions requiring approval do not execute without user approval.
8. Missing inputs are reported rather than fabricated.
9. Outputs follow the prescribed structure.

## Deployment

1. Complete business owner, security, and privacy review.
2. Validate authentication and connector permissions.
3. Assign an accountable owner and establish versioning with release notes.
4. Upload the package for personal testing, then publish to the tenant through Microsoft 365 administration.
5. Assign the plugin to approved users or groups and validate the deployed experience.
6. Monitor adoption, failures, and connector usage, then republish updates through the governed release process.

## Sources

* [Build plugins for Copilot Cowork](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-plugin-development)
* [Manage plugins for Copilot Cowork](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-manage-plugins)
