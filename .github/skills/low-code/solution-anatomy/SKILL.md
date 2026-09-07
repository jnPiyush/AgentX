---
name: "solution-anatomy"
description: 'Author and structure unpacked Microsoft Power Platform solutions on disk so an agent can generate source that pac solution pack will accept and Power Apps will import. Covers Solution.xml, publisher, prefixes, versioning, dependencies, component folders, managed vs unmanaged, and the round-trip with pac solution unpack/pack.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-30"
compatibility:
  surfaces: ["power-platform-builder", "low-code-builder", "agent-x", "engineer"]
  platforms: ["power-platform", "dataverse", "power-apps", "power-automate", "copilot-studio"]
---
# Power Platform Solution Anatomy

> Purpose: let an agent emit a deterministic source tree that round-trips through `pac solution unpack` / `pac solution pack` and imports cleanly into a Dataverse environment.

## When to Use

- Generating a new Power Platform solution from a PRD
- Adding a component (table, flow, app, agent) to an existing unpacked solution
- Reviewing a solution before packaging or import
- Diffing two solutions semantically (per-component, not raw XML)

## Prerequisites

Have the `pac` CLI available for round-trip validation, know the publisher and
customization prefix the solution must use, and know which component types the
solution will contain before generating folders or manifests.

## Decision Guide

Use this skill when the work is about the solution shell itself: folder layout,
`Solution.xml`, publisher metadata, root components, connection references,
versioning, and pack validation. Use sub-skills for the component internals
once the shell exists. The canonical tree, required fields, and naming tables
are in [details-solution-structure.md](references/details-solution-structure.md).

## Core Rules

Generate unmanaged source only, keep one publisher prefix across every custom
component, and route environment-specific values through environment variables
or connection references instead of hardcoded tenant data. Every regeneration
must update solution versioning, declare the real root components, and remain
packable by `pac solution pack` from the unpacked `src` tree before handoff.

## Workflow

1. Gather the publisher, prefix, version intent, and component inventory.
2. Create the canonical unpacked tree and populate `src/Other/Solution.xml`
   plus its companion files from the structure reference.
3. Hand off component-specific folders to the relevant Dataverse, flow, canvas,
   or bot skills, while keeping `connectionreferences.json` ownership in this
   solution shell and preserving the shared prefix.
4. Run `pac solution pack`, fix naming or dependency issues, and only then mark
   the solution shell ready for import.

## Pitfalls

The most expensive mistakes are mixing managed and unmanaged artifacts,
hardcoding environment URLs or GUIDs, skipping connection references, and
changing prefixes after components exist. The full anti-pattern table is in the
detail reference.

## Error Handling

If `pac solution pack` fails, inspect the unpacked tree before changing
component payloads: check that `src/Other/Solution.xml` exists, root components
match the files present, names follow the prefix conventions, and required
companion files were emitted. When an import would bind to a specific
environment, replace hardcoded values with environment variables or connection
references instead of retrying the same invalid package.

## Checklist

- Canonical solution tree exists under `src/`
- `Solution.xml` declares publisher, prefix, version, managed flag, and real root components
- Connection references and environment variables are present when flows or environment-specific bindings need them
- Version was bumped for this regeneration
- `pac solution pack` succeeds on the emitted tree before handoff

## Why This Is a Skill

Power Platform solutions are not just a pile of XML files; they are a strict,
packable filesystem contract with naming, versioning, dependency, and import
rules that generic code generation often violates. This skill captures the
round-trip-safe shell so specialized sub-skills can add components without
breaking packaging or tenant portability.

## Skill Outputs

When invoked, this skill helps the calling agent produce:

1. A valid `src/Other/Solution.xml` with publisher, prefix, version, root components.
2. A valid `src/Other/Customizations.xml` shell ready for sub-skills (dataverse, flow, canvas, bot) to extend.
3. A `connectionreferences.json` if any flow is present.
4. A `README.md` with the pack + import commands.
5. The list of folders to create for the requested components.

## See Also

- [low-code/dataverse-schema](../dataverse-schema/SKILL.md) for Entity.xml authoring
- [low-code/power-automate-flow-json](../power-automate-flow-json/SKILL.md) for Workflows/*-FLOW.json
- [low-code/pac-cli](../pac-cli/SKILL.md) for pack/unpack/check commands
- [architecture/low-code-vs-pro-code](../../architecture/low-code-vs-pro-code/SKILL.md) for the higher-level platform-fit decision

## References

- [references/details-solution-structure.md](references/details-solution-structure.md): read when you need the canonical tree, `Solution.xml` field rules, prefix and naming tables, round-trip validation command, or the full anti-pattern table relocated verbatim from the original root.
