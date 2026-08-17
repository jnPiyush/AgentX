---
name: "Create Cowork Plugin Package"
agent: "AgentX Auto"
description: "Create an upload-ready Microsoft 365 Copilot Cowork plugin zip with manifest.json, icons, and one or more agent skills, MCP connectors, or both."
argument-hint: "name=... capability=... skills=... [connector=none] [outputDir=artifacts/cowork-plugins]"
inputs:
  name:
    description: "Short name for the Cowork plugin"
    required: true
    default: ""
  capability:
    description: "Business capability the plugin supports"
    required: true
    default: ""
  skills:
    description: "Comma-separated list of specialized skills to bundle, or none for a connector-only package"
    required: false
    default: ""
  connector:
    description: "MCP connector requirement, or none for a skills-only package"
    required: false
    default: "none"
  outputDir:
    description: "Directory where the package source and zip will be created"
    required: false
    default: "artifacts/cowork-plugins"
---

# Create Cowork Plugin Package

## Inputs

* `{{name}}`: Cowork plugin name
* `{{capability}}`: Business capability the plugin supports
* `{{skills}}`: Specialized skills to bundle, or `none` for a connector-only package
* `{{connector}}`: MCP connector requirement, or `none`
* `{{outputDir}}`: Package output directory

## Requirements

1. Read `.github/skills/development/cowork-plugin-creator/SKILL.md` in full before authoring files.
2. Decompose `{{capability}}` into non-overlapping skills. Each skill owns one stage, task, or domain and defers explicitly at its boundaries. The package must declare at least one skill or at least one connector.
3. Create `{{outputDir}}/<plugin-name>/manifest.json` with `manifestVersion`, a stable GUID `id`, `version`, `developer`, `name`, `description`, `icons`, `agentSkills`, and any `agentConnectors`. Do not add fields outside the supported schema.
4. Add `color.png` at 192x192 pixels and `outline.png` at 32x32 pixels, and reference both from `icons`.
5. Create `skills/<skill-name>/SKILL.md` for every skill. The frontmatter `name` must be kebab-case and match its folder name exactly, and the description must contain realistic trigger phrases.
6. Register every skill folder in `agentSkills`. Populate `references/` and `scripts/` inside a skill folder only when that skill needs them.
7. When `{{connector}}` is not `none`, add an `agentConnectors` entry with an HTTPS `mcpServerUrl`, a packaged `mcpToolDescription` file under `tools/`, and an `authorization` block whose `type` is `None`, `OAuthPluginVault`, `ApiKeyPluginVault`, or `DynamicClientRegistration`. Every type except `None` requires a vault `referenceId`. Never embed credentials in the package.
8. Do not leave TODO markers, generic placeholders, secrets, personal data, customer-sensitive data, or unsupported claims.
9. Require human review before sending, publishing, deleting, approving, or taking another consequential action.
10. Run `.github/skills/development/cowork-plugin-creator/scripts/New-CoworkPluginPackage.ps1` against the completed source directory.
11. Verify the zip contains `manifest.json`, both icons, and every registered skill folder at the archive root with no wrapper directory.
12. Return the generated zip path and a concise list of packaged files. The final deliverable must be the zip file, not only a Markdown response or source directory.

## Output Format

```markdown
## Cowork Plugin Package

**Plugin**: <name>
**Capability**: <capability>
**Archive**: [<archive-name>.zip](<workspace-relative-path>)

### Package Contents

* `manifest.json`
* `color.png`, `outline.png`
* `skills/<skill-name>/SKILL.md` (when a skill is declared)
* `tools/<tool-description>.json` (when a connector is declared)

### Skills

Omit this section for a connector-only package.

| Skill | Purpose | Triggers |
|-------|---------|----------|
| <skill-name> | <purpose> | <trigger phrases> |

### Next Steps

1. Upload the package for personal testing in Microsoft 365 Copilot Cowork.
2. Validate skill routing, connector access, and approval prompts.
3. Publish through Microsoft 365 administration after business, security, and privacy review.
```

## Constraints

* Never fabricate connector endpoints, tool names, credentials, or customer data
* Never wrap package contents in an extra parent directory inside the zip
* Ask only for genuinely missing essentials, then proceed
