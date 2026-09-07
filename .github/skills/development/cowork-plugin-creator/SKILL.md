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

## Core Rules

1. Define the business capability first, then the skill inventory. Each skill owns a distinct stage, task, or domain and defers explicitly at its boundaries.
2. Give every skill folder a `SKILL.md` whose frontmatter `name` matches the folder leaf exactly, is kebab-case, and carries a description with real trigger phrases.
3. Register every skill folder in `agentSkills` and every connector in `agentConnectors`; unregistered folders are ignored and missing folders fail upload.
4. Keep each `SKILL.md` lean. Move deep guidance to `references/` and executable helpers to `scripts/` inside the skill folder.
5. Never embed passwords, API keys, client secrets, personal data, or unapproved customer data. Route credentials through connector authorization.
6. Require user review before sending, publishing, deleting, approving, or otherwise taking consequential action.
7. Author for a managed container: assume no terminal, no package installation, and no outbound calls except through a declared connector. A skill that needs external data gets an `agentConnectors` entry, not a setup script. Treat this as the authoring floor even where a host is more permissive.

## Checklist

* [ ] Business capability and skill inventory are explicit and non-overlapping
* [ ] Every skill folder has `SKILL.md` with a kebab-case `name` matching the folder leaf
* [ ] Skill names are unique across every `agentSkills` entry
* [ ] Every skill folder in the tree is registered in `agentSkills`
* [ ] Pipeline stages declare their input artifact, output artifact, and gate
* [ ] Every skill description contains realistic trigger phrases
* [ ] `manifest.json` carries identity, developer, icons, and at least one `agentSkills` or `agentConnectors` entry
* [ ] `color.png` is 192x192 and `outline.png` is 32x32
* [ ] Each connector uses HTTPS, declares `mcpToolDescription`, and ships that file
* [ ] Consequential actions require human review
* [ ] No secrets, credentials, personal data, or customer-sensitive data are embedded
* [ ] Package script succeeds and the archive has `manifest.json` at its root
* [ ] Final response links to the generated `.zip`
## Workflow

1. Confirm capability and manifest inputs.
2. Create the canonical directory tree and components.
3. Validate JSON, paths, icons, and connector declarations.
4. Build the upload archive and inspect its entries.

## Error Handling

- Missing required input: stop before scaffolding an invalid package.
- Manifest/path mismatch: correct the source tree, not the validator.
- Packaging failure: retain the unpacked source and report the exact contract violation.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| invent tenant IDs, endpoints, or capabilities. | Keep manifest identifiers and referenced paths consistent. |
| treat a successfully created ZIP as package validation. | Choose skill-only, connector-only, or mixed packaging from the requested capabilities; use multi-stage definitions only when stages have distinct contracts. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Rationalization Table, Decision Tree, Multi-Stage Pipeline Plugins](references/details-rationalization-table-and-multi-stage-pipeline-plugins.md) - MUST read before work involving rationalization table, decision tree, multi-stage pipeline plugins.
- [Authoring Workflow through Anti-Patterns](references/details-authoring-workflow-and-anti-patterns.md) - MUST read before work involving authoring workflow through anti-patterns.

Existing focused references are reused, not duplicated:

- [Cowork Plugin Authoring Guide](references/cowork-plugin-authoring-guide.md) - MUST read before applying the focused cowork plugin authoring guide guidance.
- [split-cowork-plugin-review-and-release](references/split-cowork-plugin-review-and-release.md) - MUST read before applying the focused split-cowork-plugin-review-and-release guidance.
