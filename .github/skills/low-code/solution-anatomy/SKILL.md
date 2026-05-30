---
name: "solution-anatomy"
description: 'Author and structure unpacked Microsoft Power Platform solutions on disk so an agent can generate source that pac solution pack will accept and Power Apps will import. Covers Solution.xml, publisher, prefixes, versioning, dependencies, component folders, managed vs unmanaged, and the round-trip with pac solution unpack/pack.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "dataverse", "power-apps", "power-automate", "copilot-studio"]
---

# Power Platform Solution Anatomy

> Purpose: let an agent emit a deterministic source tree that round-trips through `pac solution unpack` / `pac solution pack` and imports cleanly into a Dataverse environment.

## When to Use

- Generating a new Power Platform solution from a PRD
- Adding a component (table, flow, app, agent) to an existing unpacked solution
- Reviewing a solution before packaging or import
- Diffing two solutions semantically (per-component, not raw XML)

## The On-Disk Layout (Canonical)

```
<solution-root>/
  src/
    Other/
      Solution.xml            # manifest: UniqueName, Version, Publisher, Managed flag, RootComponents
      Customizations.xml      # global customizations (option sets, security roles, sitemap)
      Relationships.xml       # cross-entity relationships
    Entities/
      <prefix>_<entityname>/  # one folder per Dataverse table
        Entity.xml
        FormXml/
        SavedQueries/
        Views/
    CanvasApps/
      <prefix>_<appname>_<DocumentUri>/
        CanvasManifest.json
        Src/                  # *.fx.yaml files (Power Fx source)
        Assets/
    Workflows/
      <prefix>_<name>-FLOW.json   # Power Automate cloud flow
    Bots/
      <prefix>_<botname>/         # Copilot Studio agent
        bot.yaml
        topics/*.yaml
        knowledge/*.yaml
    Roles/                    # security roles
    WebResources/             # static assets, JS, images
    OptionSets/               # global choice columns
    ConnectionReferences/     # named connection bindings
    EnvironmentVariables/     # config that varies by environment
```

All folders are optional except `src/Other/Solution.xml` and `src/Other/Customizations.xml`.

## Solution.xml -- Required Fields

| Field | Rule |
|-------|------|
| `UniqueName` | Lowercase, alphanumeric, underscores. Must be globally unique within the tenant. Convention: `<publisherprefix>_<short_solution_name>`. |
| `LocalizedName` | Display name shown in maker portal. |
| `Description` | One-paragraph summary. |
| `Version` | Four-part SemVer-ish `MAJOR.MINOR.BUILD.REVISION`. Bump `BUILD` per build, `REVISION` per hotfix. |
| `Managed` | `0` for unmanaged source (the only form pac solution pack should produce from this tree). |
| `Publisher` | Inline element with `UniqueName`, `LocalizedNames`, `CustomizationPrefix`, `CustomizationOptionValuePrefix`. |
| `RootComponents` | One `<RootComponent>` per included component, with `type` and `schemaName`. |
| `MissingDependencies` | Empty unless the solution layers on another solution. |

## Publisher and Prefix Rules

- Pick ONE customization prefix per publisher and stick with it. Example: publisher `agentx` -> prefix `agx`.
- Every custom Dataverse table, column, choice, flow, app, and bot MUST start with the prefix and an underscore: `agx_issue`, `agx_NotifyOnIssueCreated`.
- The prefix is permanent. Changing it later forces every component to be recreated.
- `CustomizationOptionValuePrefix` is a 5-digit integer (e.g. `10000`) used as the high digits for new choice option values.

## RootComponents Reference

Common `type` values the builder will emit:

| Type | Component | schemaName format |
|------|-----------|-------------------|
| 1 | Entity (table) | `agx_issue` |
| 2 | Attribute | `agx_issue.agx_severity` |
| 9 | Option Set | `agx_priority` |
| 20 | Security Role | role GUID |
| 29 | Workflow / Cloud Flow | flow GUID |
| 60 | System Form | form GUID |
| 61 | Web Resource | `agx_/scripts/foo.js` |
| 80 | Connection Reference | `agx_sharedoutlook365` |
| 300 | Canvas App | app GUID |
| 371 | Environment Variable Definition | `agx_envvar` |

The full enumeration is in the SDK reference; emit only what the solution actually contains.

## Component Naming Discipline

| Component | Convention | Example |
|-----------|------------|---------|
| Table | `<prefix>_<noun_singular>` | `agx_issue` |
| Column | `<prefix>_<lower_snake>` | `agx_severity` |
| Choice | `<prefix>_<noun>` | `agx_priority` |
| Flow | `<prefix>_<VerbObject>` | `agx_NotifyOnIssueCreated` |
| Canvas App | `<prefix>_<NounApp>` | `agx_IssueTrackerApp` |
| Copilot Studio bot | `<prefix>_<noun>_copilot` | `agx_issue_copilot` |
| Connection reference | `<prefix>_<connector_lower>` | `agx_sharedoutlook365` |

## Managed vs Unmanaged

- Generate UNMANAGED source. Always.
- The maker can export a MANAGED zip from the target environment after importing the unmanaged solution. Generating managed-only artifacts is an anti-pattern for source control.
- Never check `*_managed.zip` files into the repo. Only the unpacked unmanaged source tree.

## Versioning Rule

The builder MUST bump `Solution.xml/Version` on every regeneration:

- New solution: `1.0.0.0`
- Same builder run, additive change: bump `REVISION`
- Schema-breaking change (renamed column, removed table): bump `BUILD` and document in the solution `Description`

## Required Companion Files

For every generated solution the builder MUST also emit:

| File | Purpose |
|------|---------|
| `README.md` | Pack + import instructions (the 3-command flow). |
| `.gitignore` | Exclude `*.zip`, `bin/`, `obj/`, `.pac/`. |
| `connectionreferences.json` (if flows present) | Symbolic bindings the importer wires up. |

## Round-Trip Validation

Every emitted tree MUST be verifiable with:

```
pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged
```

If `pac solution pack` fails, the tree is invalid. The builder's loop MUST run this command before declaring done.

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|--------------|--------------|
| Mixing managed and unmanaged components | Import order becomes ambiguous; layer conflicts on update. |
| Hardcoded environment URLs in flows | Breaks on import into a different environment. Use environment variables. |
| Inline GUIDs in canvas YAML referring to a specific env | Apps won't bind on import. Use connection references. |
| Skipping `connectionreferences.json` | Importer prompts the user for every connection; bad UX. |
| Components named without prefix | Import succeeds but customizations cannot be exported back into the solution. |
| Solution names with hyphens or mixed case | `pac` will sometimes accept and sometimes silently drop; lowercase + underscores only. |

## Skill Outputs

When invoked, this skill helps the calling agent produce:

1. A valid `src/Other/Solution.xml` with publisher, prefix, version, root components.
2. A valid `src/Other/Customizations.xml` shell ready for sub-skills (dataverse, flow, canvas, bot) to extend.
3. A `connectionreferences.json` if any flow is present.
4. A `README.md` with the pack + import commands.
5. The list of folders to create for the requested components.

## See Also

- `low-code/dataverse-schema` for Entity.xml authoring
- `low-code/power-automate-flow-json` for Workflows/*-FLOW.json
- `low-code/pac-cli` for pack/unpack/check commands
- `architecture/low-code-vs-pro-code` for the higher-level platform-fit decision