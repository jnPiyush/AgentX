# cowork-skill-creator: Decision Tree, Authoring Workflow, Package Contract

> MUST read before work involving **decision tree, authoring workflow, package contract**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## Authoring Workflow

1. Convert the request into the fields in [Cowork Authoring Guide](cowork-authoring-guide.md).
2. Start from [Cowork Skill Template](../assets/SKILL.template.md), then replace every placeholder with workflow-specific content.
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

The packager excludes `.gitkeep` placeholders, so a directory that holds nothing else is not packaged. Every companion directory needs a real file, not a placeholder.

## References

* [Cowork Authoring Guide](cowork-authoring-guide.md)
* [Cowork Skill Template](../assets/SKILL.template.md)

## Scripts

* `../scripts/New-CoworkSkillPackage.ps1` validates and creates an upload-ready zip