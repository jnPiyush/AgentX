---
name: "pac-cli"
description: 'Operate the Microsoft Power Platform CLI (pac) for solution pack/unpack, environment auth, and import. Use after an agent emits an unpacked solution tree to validate it, pack it into a zip, and import it into a Dataverse environment.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["low-code-builder", "engineer", "devops"]
  platforms: ["power-platform", "dataverse"]
---

# Power Platform CLI (pac)

> Purpose: provide the agent and the maker with exact `pac` commands to validate, package, and import a generated solution. The builder agent never invokes destructive commands; it documents them for the maker.

## When to Use

- After emitting an unpacked solution, validate `pac solution pack` succeeds.
- Generate the import script in the example README.
- Diagnose pack/import failures.

## Installation

The maker installs once:

```
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
```

Or via MSI from `aka.ms/PowerPlatformCLI`. Verify:

```
pac --version
```

Minimum supported version for this skill: 1.30.x (2025+).

## Authentication

```
pac auth create --environment https://<env>.crm.dynamics.com --name agx-dev
pac auth select --name agx-dev
pac auth list
```

The builder agent MUST NOT call `pac auth` (no access to user credentials). The agent only documents the command in the generated README.

## Core Commands (Solution Lifecycle)

| Command | Purpose | Safe from Agent? |
|---------|---------|-------------------|
| `pac solution init --publisher-name agentx --publisher-prefix agx` | Bootstrap a new solution project | yes |
| `pac solution unpack --zipfile <file>.zip --folder ./src --packagetype Unmanaged` | Convert vendor-exported zip into source | yes (read-only) |
| `pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged` | Convert source into importable zip | yes (writes only to `build/`) |
| `pac solution check --path build/solution.zip` | Run Solution Checker static analysis | yes |
| `pac solution import --path build/solution.zip --async --publish-changes --activate-plugins` | Import zip into the current env | NO -- maker only |
| `pac solution export --name <UniqueName> --path build/exported.zip --managed false` | Export solution back to zip | NO -- maker only |
| `pac solution publish` | Publish customizations | NO -- maker only |
| `pac solution delete --solution-name <UniqueName>` | Delete a solution from the env | NO -- destructive |

## Round-Trip Validation (Builder Agent Loop)

After emitting the source tree, the builder agent quality loop MUST run:

```
pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged --allowDelete true
```

- Exit code 0: tree is structurally valid. Continue.
- Non-zero: read stderr, identify the bad component (usually malformed XML), fix, repeat.

Optionally, run `pac solution check` to catch governance issues before import.

## The Makers 3-Command Import Flow

Every generated solution README ends with this exact block:

```
pac auth create --environment https://<your-env>.crm.dynamics.com --name <env-name>
pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged
pac solution import --path build/solution.zip --async --publish-changes --activate-plugins
```

The importer will prompt the maker to bind each `connectionreferences.json` entry to a real connection on first import.

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Solution.xml not found` | `--folder` points wrong | Point at the folder that contains `Other/Solution.xml` |
| `Invalid customization prefix` | Component schema name does not match publisher prefix | Rename the component or fix the publisher |
| `Duplicate root component` | Same component listed twice | Dedupe `RootComponents` |
| `Could not load file or assembly Microsoft.Crm...` | Stale pac install | `dotnet tool update -g Microsoft.PowerApps.CLI.Tool` |
| `Authentication expired` | Token aged out | `pac auth create` again |
| `Solution depends on missing components` | `MissingDependencies` not satisfied | Install the parent solution first |
| `Connection reference not bound` | Import skipped the binding prompt | Open in maker portal and bind the connection |
| Pack succeeds but flow fails on import | GUID in filename does not match `properties.workflowId` | Make them match or omit `workflowId` |

## Useful Inspection Commands

```
pac org who
pac solution list
pac solution online-version --solution-name <UniqueName>
pac data export --schemafile schema.xml
```

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|--------------|--------------|
| Agent calling `pac solution import` directly | No credentials in agent context; destructive in shared envs. |
| Hardcoding env URL in repo scripts | Repo becomes single-tenant. Use a parameter. |
| Skipping `pac solution check` before review | Misses naming, perf, security violations. |
| Committing packed zip to git | Zip is a build artifact. Source of truth is the unpacked tree. |
| `--packagetype Managed` for source authored from scratch | Loses round-trip. |

## Skill Outputs

1. Document the makers 3-command import flow in the generated README.
2. Include the one-line round-trip validation command for the builder loop.
3. Provide the failure-mode table for the makers reference.

## See Also

- `low-code/solution-anatomy` -- source tree pac packs.
- `low-code/dataverse-schema` -- tables pac validates.
- `low-code/power-automate-flow-json` -- flows pac round-trips.
- Microsoft docs: `learn.microsoft.com/power-platform/developer/cli/introduction`