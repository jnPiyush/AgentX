---
name: "cowork-plugin-creator"
description: 'Create upload-ready Microsoft 365 Copilot Cowork plugin packages containing manifest.json, color and outline icons, and one or more agent skills, MCP connectors, or both. Use for Cowork plugin authoring, packaging, and validation requests.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-17"
  updated: "2026-08-17"
compatibility:
  frameworks: ["microsoft-365-copilot-cowork"]
  platforms: ["windows", "linux", "macos"]
prerequisites: ["PowerShell 7+"]
allowed-tools: "read_file apply_patch run_in_terminal"
---

# Cowork Plugin Creator

> WHEN: Creating, converting, reviewing, or packaging a Microsoft 365 Copilot Cowork plugin as an M365 app package `.zip` that bundles skills and optional MCP connectors.

## When to Use

Use this skill when the user asks to:

* Build a Cowork plugin that bundles several related skills
* Add an MCP connector so Cowork skills can reach an external system
* Produce an upload-ready Microsoft 365 app package for Cowork
* Repair a plugin package that fails upload validation

Use [Cowork Skill Creator](../cowork-skill-creator/SKILL.md) instead when the deliverable is a single standalone skill archive with no manifest, icons, or connectors.

## Prerequisites

* A business capability that resolves to at least one specialized skill, at least one connector, or both
* PowerShell 7 or later for deterministic package validation and zip creation
* `color.png` at 192x192 pixels and `outline.png` at 32x32 pixels
* An HTTPS MCP endpoint and its tool-description file when a connector is required

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "One large skill is simpler than several." | Cowork routes on skill descriptions; broad skills collide and misfire. Split by distinct stage, task, or domain. |
| "The manifest can list extra fields for clarity." | The v1.28 schema sets `additionalProperties: false`; any undocumented field fails upload. |
| "The folder name is cosmetic." | The frontmatter `name` must match the folder leaf exactly; mismatch is the most common skill failure. |
| "Icons can be any square image." | `color.png` must be 192x192 and `outline.png` must be 32x32, and both must match the manifest references. |
| "The connector tool list lives on the server." | Every `remoteMcpServer` requires `mcpToolDescription.file`, and that file must ship inside the zip. |
| "Zipping the plugin folder is enough." | A wrapper directory breaks upload. `manifest.json` must sit at the archive root. |
| "Credentials in the skill make testing easier." | Secrets never belong in the package; use `agentConnectors` authorization with a vault `referenceId`. |

## Decision Tree

```text
Cowork plugin requested?
+- Single workflow, no manifest or connector needed? -> Use cowork-skill-creator instead.
+- Business capability with one or more skills or connectors?
|  +- Missing capability, skills, or owner? -> Ask only for the missing essentials.
|  +- Needs external data or actions? -> Add an MCP connector plus its tool-description file.
|  +- Instruction-only analysis? -> Ship a skills-only package with no connector.
|  - Validate and package -> Return the zip path.
- Existing package supplied? -> Review, repair, validate, and repackage it.
```

## Core Rules

1. Define the business capability first, then the skill inventory. Each skill owns a distinct stage, task, or domain and defers explicitly at its boundaries.
2. Give every skill folder a `SKILL.md` whose frontmatter `name` matches the folder leaf exactly, is kebab-case, and carries a description with real trigger phrases.
3. Register every skill folder in `agentSkills` and every connector in `agentConnectors`; unregistered folders are ignored and missing folders fail upload.
4. Keep each `SKILL.md` lean. Move deep guidance to `references/` and executable helpers to `scripts/` inside the skill folder.
5. Never embed passwords, API keys, client secrets, personal data, or unapproved customer data. Route credentials through connector authorization.
6. Require user review before sending, publishing, deleting, approving, or otherwise taking consequential action.

## Authoring Workflow

1. Capture the capability, skill inventory, inputs, outputs, and connector needs using [Cowork Plugin Authoring Guide](references/cowork-plugin-authoring-guide.md).
2. Create the package directory and one folder per skill under `skills/`.
3. Author each `SKILL.md` from [Cowork Plugin Skill Template](assets/SKILL.template.md), replacing every placeholder with workflow-specific content.
4. Add `manifest.json` from [Cowork Plugin Manifest Template](assets/manifest.template.json) and fill in identity, developer, icons, `agentSkills`, and any `agentConnectors`.
5. Add `color.png` and `outline.png` at the required dimensions and match their names in `icons`.
6. For each connector, add the tool-description file under `tools/` and reference it from `mcpToolDescription.file`.
7. Remove secrets, personal data, customer-sensitive data, TODO markers, and unsupported claims.
8. Package the directory:

```powershell
./.github/skills/development/cowork-plugin-creator/scripts/New-CoworkPluginPackage.ps1 `
  -PluginPath artifacts/cowork-plugins/architecture-assistant `
  -OutputPath artifacts/cowork-plugins/architecture-assistant.zip
```

9. Return the absolute or workspace-relative zip path. Do not stop after showing the file contents.

## Package Contract

```text
manifest.json
color.png
outline.png
skills/
  <skill-name>/
    SKILL.md
    references/   (optional)
    scripts/      (optional)
tools/            (required only when a connector declares mcpToolDescription)
```

`manifest.json` must be at the archive root. Do not wrap these entries in an additional parent directory.

## Error Handling

* Missing capability or skill inventory: ask for the smallest set of missing fields
* Skill name and folder mismatch: rename the folder or correct the frontmatter before packaging
* Missing icons or wrong dimensions: regenerate the icons rather than shipping placeholders
* Connector without a packaged tool-description file: add the file under `tools/` or remove the connector
* Sensitive information: remove it and request a sanitized substitute
* Packaging failure: report the exact validation error and preserve the source directory for repair
* Symbolic link or junction inside the source tree: replace it with real files; the packager rejects links, and on Windows it also identity-checks each archived file through its open handle, while on Linux and macOS the check is path-based only, so package from a tree no other user can modify concurrently

## Anti-Patterns

* Returning only a manifest draft when the user requested an uploadable package
* Bundling one broad skill that claims every scenario in the domain
* Adding manifest fields outside the supported schema
* Reusing vague or duplicate connector tool names that make routing ambiguous
* Referencing skill folders that are not present in the package
* Embedding credentials instead of using connector authorization

## Checklist

* [ ] Business capability and skill inventory are explicit and non-overlapping
* [ ] Every skill folder has `SKILL.md` with a kebab-case `name` matching the folder leaf
* [ ] Every skill description contains realistic trigger phrases
* [ ] `manifest.json` carries identity, developer, icons, and at least one `agentSkills` or `agentConnectors` entry
* [ ] `color.png` is 192x192 and `outline.png` is 32x32
* [ ] Each connector uses HTTPS, declares `mcpToolDescription`, and ships that file
* [ ] Consequential actions require human review
* [ ] No secrets, credentials, personal data, or customer-sensitive data are embedded
* [ ] Package script succeeds and the archive has `manifest.json` at its root
* [ ] Final response links to the generated `.zip`
