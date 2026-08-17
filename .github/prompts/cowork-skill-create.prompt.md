---
name: "Create Cowork Skill Package"
agent: "AgentX Auto"
description: "Create an upload-ready Microsoft 365 Copilot Cowork skill zip with tailored instructions, assets, references, and scripts."
argument-hint: "name=... workflow=... [sources=...] [outputDir=artifacts/cowork-skills]"
inputs:
  name:
    description: "Short name for the Cowork skill"
    required: true
    default: ""
  workflow:
    description: "Repeatable workflow the Cowork skill must perform"
    required: true
    default: ""
  sources:
    description: "Authorized source types or attached materials the skill may use"
    required: false
    default: "user-provided and explicitly authorized materials"
  outputDir:
    description: "Directory where the package source and zip will be created"
    required: false
    default: "artifacts/cowork-skills"
---

# Create Cowork Skill Package

## Inputs

* `{{name}}`: Cowork skill name
* `{{workflow}}`: Repeatable workflow and desired result
* `{{sources}}`: Permitted source types
* `{{outputDir}}`: Package output directory

## Requirements

1. Read `.github/skills/development/cowork-skill-creator/SKILL.md` in full before authoring files.
2. Convert the request and attached context into a clear purpose, trigger, inputs, ordered process, fixed output format, boundaries, and quality checks.
3. Create `{{outputDir}}/<skill-name>/SKILL.md` with valid `name` and `description` frontmatter.
4. Create and populate all companion directories with workflow-specific content:
   * `assets/` with the exact reusable output template or sample structure
   * `references/` with normal, missing-input, conflicting-input, non-trigger, and consequential-action test cases
   * `scripts/` with a deterministic validator or helper appropriate to the output contract
5. Do not leave TODO markers, generic placeholders, secrets, credentials, personal data, customer-sensitive data, or unsupported claims.
6. Require human review before sending, publishing, deleting, approving, or taking another consequential action.
7. Run `.github/skills/development/cowork-skill-creator/scripts/New-CoworkSkillPackage.ps1` against the completed source directory.
8. Verify the zip contains `SKILL.md` at its root and populated `assets/`, `references/`, and `scripts/` folders.
9. Return the generated zip path and a concise list of packaged files. The final deliverable must be the zip file, not only a Markdown response or source directory.

## Output Format

```markdown
## Cowork Skill Package

**Skill**: <name>
**Archive**: [<archive-name>.zip](<workspace-relative-path>)

### Package Contents

* `SKILL.md`
* `assets/<tailored-file>`
* `references/<tailored-file>`
* `scripts/<tailored-file>`

### Validation

* Package validation: [PASS]
* Sensitive-content review: [PASS]
* Human-review boundary: [PASS]
```