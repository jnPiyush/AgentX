# cowork-plugin-creator: Authoring Workflow through Anti-Patterns

> MUST read before work involving **authoring workflow through anti-patterns**. This reference preserves complete source guidance relocated for context-budget compliance.

## Authoring Workflow

1. Capture the capability, skill inventory, inputs, outputs, and connector needs using [Cowork Plugin Authoring Guide](cowork-plugin-authoring-guide.md).
2. Create the package directory and one folder per skill under `skills/`.
3. Author each `SKILL.md` from [Cowork Plugin Skill Template](../assets/SKILL.template.md), replacing every placeholder with workflow-specific content.
4. Add `manifest.json` from [Cowork Plugin Manifest Template](../assets/manifest.template.json) and fill in identity, developer, icons, `agentSkills`, and any `agentConnectors`.
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

The packager excludes `.gitkeep`, `.gitignore`, `.gitattributes`, `.DS_Store`, `Thumbs.db`, and the `.git`, `.svn`, `.hg`, `__pycache__`, `node_modules`, and `.venv` directories from the archive and from the companion-file count, so a scaffolded, source-controlled plugin tree packages without manual cleanup. Every other file under the plugin directory ships as-is.

## Error Handling

* Missing capability or skill inventory: ask for the smallest set of missing fields
* Skill name and folder mismatch: rename the folder or correct the frontmatter before packaging
* Missing icons or wrong dimensions: regenerate the icons rather than shipping placeholders
* Connector without a packaged tool-description file: add the file under `tools/` or remove the connector
* Duplicate skill name across two `agentSkills` folders: rename one folder and its frontmatter `name`; identically named skills make routing ambiguous
* Skill folder present but not in `agentSkills`: register it or delete it rather than shipping an inert folder
* Uppercase or underscored folder name carried over from a source pipeline: rename to lowercase kebab-case and update the frontmatter `name` to match
* Companion count above 20: move the overflow into the stage skill that actually uses it, or consolidate several thin reference files into one
* Sensitive information: remove it and request a sanitized substitute
* Packaging failure: report the exact validation error and preserve the source directory for repair
* Symbolic link or junction inside the source tree: replace it with real files; the packager rejects links everywhere it traverses, skipping excluded noise names before that check, and on Windows it also identity-checks each archived file through its open handle, while on Linux and macOS the check is path-based only, so package from a tree no other user can modify concurrently

## Anti-Patterns

* Returning only a manifest draft when the user requested an uploadable package
* Bundling one broad skill that claims every scenario in the domain
* Adding manifest fields outside the supported schema
* Reusing vague or duplicate connector tool names that make routing ambiguous
* Referencing skill folders that are not present in the package
* Shipping stage folders that no `agentSkills` entry registers
* Duplicating the same template into every stage folder until the companion limit trips
* Embedding credentials instead of using connector authorization
