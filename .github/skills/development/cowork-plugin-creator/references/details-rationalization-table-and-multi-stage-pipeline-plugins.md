# cowork-plugin-creator: Rationalization Table, Decision Tree, Multi-Stage Pipeline Plugins

> MUST read before work involving **rationalization table, decision tree, multi-stage pipeline plugins**. This reference preserves complete source guidance relocated for context-budget compliance.

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
| "Every skill folder in the tree gets picked up." | Only folders listed in `agentSkills` ship as skills. Unregistered stage folders are dead weight in the archive. |
| "The folder name from the source pipeline is fine as-is." | Names must be lowercase kebab-case. `BE-sow-generator` fails; `sow-generator` passes. |
| "The skill can install what it needs at runtime." | Author for a managed container: assume no terminal and no package installation. Ship instructions and templates, not setup steps. |
| "Placeholder and repo files must be cleaned up by hand." | The packager drops `.gitkeep`, version-control metadata, and build caches from both the archive and the companion count. |

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

## Multi-Stage Pipeline Plugins

When the capability is a sequential pipeline rather than a set of independent tasks, model it as one orchestrator skill plus one skill per stage.

* The orchestrator owns the stage order, the shared task list, and the handoff between stages. It never performs stage work itself.
* Each stage skill states the artifact it requires from the previous stage and the artifact it produces for the next one.
* Each stage ends at a gate: the orchestrator confirms the expected artifact exists before advancing, and stops with a named blocker when it does not.
* Every stage folder, including the orchestrator, is registered in `agentSkills`. A stage that is present but unregistered never runs.
* Shared templates and prompts live inside the skill folder that owns them. Copying the same asset into every stage folder burns the 20-file companion budget for no benefit.

Split a stage into its own skill when it has a distinct trigger, a distinct output artifact, or a reviewer gate. Keep it inline when it is a step of the same output.
