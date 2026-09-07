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
| SOW Generator (pipeline) | sow-orchestrator, scope-intake, effort-estimate, sow-drafter, sow-reviewer |

## Pipeline Plugins

A pipeline capability is one where stage N cannot start until stage N-1 produced an
artifact. Model it as an orchestrator skill plus one skill per stage.

| Element | Requirement |
|---------|-------------|
| Orchestrator skill | Owns stage order and the shared task list; performs no stage work |
| Stage skill | Names the artifact it consumes and the artifact it produces |
| Gate | Orchestrator verifies the expected artifact exists before advancing |
| Blocker | Missing or empty artifact stops the pipeline with a named reason, never a guess |
| Registration | Every stage folder, including the orchestrator, appears in `agentSkills` |

Write each handoff as an explicit contract in the stage skill: required inputs from the
previous stage, the output it hands forward, and the condition that makes the stage
unable to proceed. Keep shared templates in the single skill folder that owns them
rather than duplicating them across stages, which consumes the companion budget.

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

The packager drops `.gitkeep`, `.gitignore`, `.gitattributes`, `.DS_Store`, `Thumbs.db`,
and the `.git`, `.svn`, `.hg`, `__pycache__`, `node_modules`, and `.venv` directories
from the archive and from the companion-file count. Everything else under the plugin
directory ships, so keep working notes and source pipelines outside the plugin tree.

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
* Skill names are unique across the whole manifest; two folders resolving to the same name make routing ambiguous and the packager rejects them
* Extra frontmatter keys beyond `name` and `description` ship unchanged, but activation is driven by `name` and `description`, so never rely on custom keys to route a skill
* Author for a managed container: assume no terminal and no package installation, and describe what the agent should do with the tools it already has instead of prescribing setup commands

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

When a skill exceeds 20 companion files, the fix is structural: move each group of
references into the stage skill that actually reads it, or consolidate several thin
files into one. These are product limits and cannot be raised by the packager.

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

---

## Quality Review

Full retained review guidance moved to [split-cowork-plugin-review-and-release.md](split-cowork-plugin-review-and-release.md).

## Test Cases

Full retained test cases moved to [split-cowork-plugin-review-and-release.md](split-cowork-plugin-review-and-release.md).

## Deployment

Full retained deployment guidance moved to [split-cowork-plugin-review-and-release.md](split-cowork-plugin-review-and-release.md).

## Sources

Full retained source links moved to [split-cowork-plugin-review-and-release.md](split-cowork-plugin-review-and-release.md).
