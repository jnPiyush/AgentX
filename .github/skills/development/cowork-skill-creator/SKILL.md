---
name: "cowork-skill-creator"
description: 'Create upload-ready Microsoft 365 Copilot Cowork skills as zip packages containing SKILL.md plus populated assets, references, and scripts folders. Use for Cowork, co-work, or coworker skill authoring and packaging requests.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-16"
  updated: "2026-08-16"
compatibility:
  frameworks: ["microsoft-365-copilot-cowork"]
  platforms: ["windows", "linux", "macos"]
prerequisites: ["PowerShell 7+"]
allowed-tools: "read_file apply_patch run_in_terminal"
---

# Cowork Skill Creator

> WHEN: Creating, scaffolding, reviewing, or packaging a Microsoft 365 Copilot Cowork, co-work, or coworker skill for upload as a `.zip` or `.skill` archive.

## When to Use

Use this skill when the user asks to:

* Turn a repeatable workflow into a Cowork skill
* Create or improve a Cowork `SKILL.md`
* Produce an upload-ready Cowork skill archive
* Package companion templates, test cases, or validation scripts with a skill

Do not use it for a one-time response that has no repeatable process or stable output contract.

## Prerequisites

* A workflow with a clear purpose, trigger, inputs, process, output, boundaries, and quality checks
* PowerShell 7 or later for deterministic package validation and zip creation
* Realistic, non-sensitive test inputs

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "SKILL.md alone is enough." | The requested deliverable includes companion folders; populate each with material that supports the workflow. |
| "Empty folders show the intended structure." | Empty folders disappear from zip archives and provide no reusable value. |
| "The user can zip it later." | A creation request is complete only when the upload-ready archive is produced. |
| "Generic placeholder files can be refined later." | Companion files must reflect the requested workflow and contain no TODO markers. |
| "Missing details can be inferred." | Flag missing inputs and preserve uncertainty instead of inventing facts. |
| "The skill can send or publish automatically." | Consequential actions require an explicit human-review checkpoint. |

## Decision Tree

```text
Cowork skill requested?
+- One-time task with no stable method? -> Respond normally; do not create a skill.
+- Repeatable workflow?
|  +- Missing purpose, trigger, or output? -> Ask only for the missing essentials.
|  +- Complete enough to author? -> Create the package directory.
|  |  +- Deterministic helper is useful? -> Add a tailored script.
|  |  +- Reusable output structure exists? -> Add a tailored asset.
|  |  - Tests or domain detail help? -> Add a tailored reference.
|  - Validate and package -> Return the zip path.
- Existing package supplied? -> Review, repair, validate, and repackage it.
```

## Core Rules

1. Define the skill name, purpose, activation phrases, authorized inputs, ordered process, fixed output, boundaries, and final quality checks.
2. Create `SKILL.md`, `assets/`, `references/`, and `scripts/`; every companion directory must contain at least one workflow-specific file.
3. Keep `SKILL.md` concise. Put output templates in `assets/`, test cases and extended guidance in `references/`, and deterministic checks in `scripts/`.
4. Never invent owners, dates, metrics, status, commitments, or sources. Require links or citations when source traceability matters.
5. Require user review before sending, publishing, deleting, approving, or otherwise taking consequential action.

## Authoring Workflow

1. Convert the request into the fields in [Cowork Authoring Guide](references/cowork-authoring-guide.md).
2. Start from [Cowork Skill Template](assets/SKILL.template.md), then replace every placeholder with workflow-specific content.
3. Add an output template under `assets/` that exactly matches the promised result.
4. Add normal, missing-input, conflicting-input, non-trigger, and consequential-action cases under `references/`.
5. Add only useful deterministic scripts. A validator should check the fixed output contract without calling external services.
6. Remove secrets, credentials, personal data, customer-sensitive data, TODO markers, and unsupported claims.
7. Package the directory:

```powershell
./.github/skills/development/cowork-skill-creator/scripts/New-CoworkSkillPackage.ps1 `
  -SkillPath artifacts/cowork-skills/example-skill `
  -OutputPath artifacts/cowork-skills/example-skill.zip
```

8. Return the absolute or workspace-relative zip path. Do not stop after showing the file contents.

## Package Contract

```text
SKILL.md
assets/
  <workflow-specific template or sample>
references/
  <workflow-specific test cases or detailed guidance>
scripts/
  <workflow-specific validator or deterministic helper>
```

`SKILL.md` must be at the archive root. Do not wrap these entries in an additional parent directory.

## Error Handling

* Missing essential workflow details: ask for the smallest set of missing fields
* Missing or empty companion directory: add an appropriate file before packaging
* Existing output archive: replace it only after validation succeeds
* Sensitive information: remove it and request a sanitized substitute
* Unsupported automation: document the manual or human-reviewed step instead of pretending it can run
* Packaging failure: report the exact validation error and preserve the source directory for repair

## Anti-Patterns

* Returning only a Markdown draft when the user requested an archive
* Adding empty folders or generic placeholder files to satisfy structure mechanically
* Putting all examples and templates into a large `SKILL.md`
* Using vague activation text that triggers unrelated requests
* Granting broad source access instead of using user-provided or explicitly authorized material
* Performing external actions without confirmation

## Checklist

* [ ] Name is lowercase kebab-case and description clearly states when to activate
* [ ] Purpose, trigger, inputs, ordered process, output, boundaries, and validation are explicit
* [ ] Missing and conflicting information are handled without fabrication
* [ ] `assets/`, `references/`, and `scripts/` contain appropriate files
* [ ] Consequential actions require human review
* [ ] No secrets, credentials, personal data, or customer-sensitive data are embedded
* [ ] Package script succeeds and the archive has `SKILL.md` at its root
* [ ] Final response links to the generated `.zip`

## References

* [Cowork Authoring Guide](references/cowork-authoring-guide.md)
* [Cowork Skill Template](assets/SKILL.template.md)

## Scripts

* `scripts/New-CoworkSkillPackage.ps1` validates and creates an upload-ready zip