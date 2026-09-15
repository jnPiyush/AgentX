---
title: Frontier Corp Brand Migration
description: Living execution plan for replacing active AgentX and HVE product identity with Frontier Corp, Hypervelocity Engineering, and the Frontier FDE Fleet.
author: GitHub Copilot
ms.date: 2026-09-10
ms.topic: plan
---

## Purpose / Big Picture

Make Frontier Corp the company and Frontier the only active product brand across
source, customizations, runtime output, extension UI, installers, packs, tests,
and current documentation. Position Hypervelocity Engineering as Frontier's
operating discipline and every specialist agent as a Forward Deployed Engineer.

Success requires consistent display identity, Frontier-native machine
identifiers, generated-asset parity, and a compatibility boundary that does not
rewrite historical facts or break published external coordinates.

## Progress

* [x] Start a fresh high-risk loop for issue 428
* [x] Inspect the post-undo worktree and current brand anchors
* [x] Define the Frontier Corp brand and fleet hierarchy
* [x] Verify that `v9.2.0` and `HEAD` shipped AgentX rather than HVE
* [x] Convene a three-perspective identity and compatibility council
* [x] Add executable Frontier identity contracts
* [x] Rename all canonical agent display names and handoffs
* [x] Migrate active product copy, prompts, instructions, skills, and templates
* [x] Add Frontier-native extension, CLI, MCP, state, environment, and pack IDs
* [x] Regenerate derived registries and extension assets
* [x] Validate current docs, code, installers, packages, and compatibility aliases
* [ ] Complete independent review and compound capture

## Alternatives Considered

1. Keep HVE as the product and mention Frontier Corp only as a parent company.
   Rejected because the user explicitly replaced the AgentX brand with Frontier
   Corp and defined HVE as the company's expertise.
2. Rename every agent to a corporate department while leaving specialist role
   names unchanged in user-facing surfaces. Rejected because it hides the FDE
   fleet model and weakens the requested positioning.
3. Use Frontier Corp as the primary brand, Frontier as the machine namespace,
   Hypervelocity Engineering as the operating discipline, and FDE as the fleet
   identity. Chosen because each term has one job and can be tested mechanically.

## Decision Log

* Decision: Use Frontier Corp as the company and Frontier as the product and
   machine namespace. Options considered: HVE under Frontier Corp, Frontier
   Engineering, Frontier. Chosen: Frontier Corp / Frontier. Rationale: Gives the
   company and product distinct jobs while directly following the requested brand
   direction. The generic AI meaning of `frontier` is mitigated by consistent
   proper-noun treatment and the `Frontier Corp` first reference. Date/Author:
   2026-09-10 / GitHub Copilot.
* Decision: Use Hypervelocity Engineering as the operating discipline, not the
  product name. Options considered: Hyper Velocity Engineering, HVE product,
  Hypervelocity Engineering discipline. Chosen: Hypervelocity Engineering.
  Rationale: Separates corporate identity from the delivery method and uses the
  standard compound form. Date/Author: 2026-09-10 / GitHub Copilot.
* Decision: Treat every agent as a specialized Forward Deployed Engineer.
  Options considered: FDE suffix on all roles, generic agent labels, one FDE
  orchestrator with conventional subagents. Chosen: `Frontier <Specialty> FDE`
  display names with stable role-oriented filenames. Rationale: Makes the fleet
  model visible without weakening routing clarity. Date/Author: 2026-09-10 /
  GitHub Copilot.
* Decision: Preserve AgentX only for historical facts, published coordinates,
  and hidden compatibility aliases. Treat partial HVE product identifiers as
   unshipped migration artifacts to replace with Frontier. Rationale: `v9.2.0`
   and `HEAD` contain AgentX manifests and no HVE product namespace, so HVE has no
   release contract; local `.hve` state still receives migration coverage. This
   avoids a three-brand system. Date/Author: 2026-09-10 / GitHub Copilot.
* Decision: Use the full `Frontier <Specialty> FDE` form in agent definitions
   and picker entries. Options considered: full names everywhere, omit FDE in
   compact UI, keep conventional role names. Chosen: full display names with
   specialty-only prose after first reference. Rationale: The fleet identity is
   an explicit user requirement, while stable role IDs and filenames preserve
   routing clarity. Date/Author: 2026-09-10 / GitHub Copilot.
* Decision: Perform one release with internally ordered compatibility slices
   rather than separate display and runtime releases. Rationale: The requested
   rebrand covers all artifacts; tests will land before each machine migration,
   and user-facing docs will not advertise a Frontier command until its runtime
   exists. Date/Author: 2026-09-10 / GitHub Copilot.

## Compatibility Policy

| Surface | Canonical | Legacy handling |
|---------|-----------|-----------------|
| Company | Frontier Corp | No active AgentX or HVE display alias |
| Product | Frontier | One `formerly AgentX` migration signpost on primary surfaces |
| Methodology | Hypervelocity Engineering (HVE) | HVE is never the product name |
| Agent fleet | Frontier FDE Fleet | Existing role IDs remain stable where possible |
| Commands and settings | `frontier.*` | Hidden `agentx.*` aliases for published clients |
| Chat | `frontier.chat`, `@frontier` | Hidden legacy alias when supported |
| CLI and MCP | `frontier`, `frontier_*` | Old names delegate but are not advertised |
| State and environment | `.frontier`, `FRONTIER_*` | Read/migrate `.agentx`, `.hve`, `AGENTX_*`, and `HVE_*`; one writer |
| Repository and Marketplace | Current real coordinates | Preserve until external migration occurs |
| Historical artifacts | Original factual identity | Do not rewrite release evidence or checksums |

## Plan of Work

1. Turn the brand contract into deterministic identity tests.
2. Introduce and test Frontier-native machine identifiers with hidden
   compatibility adapters and single-writer state migration.
3. Rename canonical agent display names and collaborator references.
4. Update current documentation and customization content from product-centric
   HVE or AgentX language to Frontier/FDE terminology only after the described
   runtime surface exists.
5. Rename packs, workflows, generated assets, icons, and active evaluation
   metadata, then regenerate all derived copies.
6. Run focused checks after each slice and full validation before review.

## Validation and Acceptance

* [x] All 26 canonical agent names begin with `Frontier` and end with `FDE`
* [x] Primary docs use the standard Frontier introduction and terminology
* [x] HVE appears only as the Hypervelocity Engineering methodology
* [x] Active UI and runtime output contain no unexplained AgentX product copy
* [x] Frontier-native commands, settings, chat, CLI, MCP, state, and environment work
* [x] Legacy aliases are hidden, tested, and single-writer
* [x] Generated assets match canonical sources
* [ ] Frontmatter, token, reference, framework, extension, installer, security,
  package, and scrub checks pass
* [ ] Independent review reports zero HIGH and MEDIUM findings

## Recovery

Generation scripts remain rerunnable. State migration merges missing files under
an exclusive lock, publishes each completed file atomically, then records a
completion marker. Existing Frontier files win over HVE and AgentX sources.
Never delete legacy state during migration. Final release validation and any
remaining limitations are tracked in
[the 9.3.0 release plan](EXEC-PLAN-428-frontier-9.3.0-release.md).

## Artifacts and Notes

Evidence: the final release framework run passed 250/250 and the installed
launcher suite passed 63/63. Release-wide independent review passed the rubric
at 84/100; see the 9.3.0 release plan for scope and remaining operator limits.

* Brand contract: [Frontier Corp Brand](../../BRAND.md)
* Council: `docs/artifacts/adr/COUNCIL-428-frontier-corp-rebrand.md`
* Issue: <https://github.com/jnPiyush/AgentX/issues/428>
* Superseded plan: `EXEC-PLAN-428-hve-rebrand.md`
* Release provenance: `v9.2.0` (`b3f26106467c9d77a06d8ae9336d0a7b43bba5cb`)
   and `HEAD` both contain AgentX README, extension, and orchestrator identity.
* Pre-existing unrelated files remain outside this migration.

## Outcomes

Implementation and focused validation are complete. Frontier Corp is now the
company identity, Frontier is the product and machine namespace, Hypervelocity
Engineering is the operating discipline, and all 26 specialists use the
`Frontier <Specialty> FDE` display convention. Published AgentX coordinates and
hidden compatibility shims remain where external consumers depend on them;
Frontier is the only writer for migrated state.

Validation passed 69 identity checks, 1,060 extension tests, 250 framework
checks, 635 frontmatter checks, 340 customization parity checks, and the focused
installer, runner, loop, hook, packaging, MCP, reference, analyzer, security,
and scrub gates. Extension coverage is 82.65 percent for statements and lines,
75.52 percent for branches, and 80.8 percent for functions. Repository-wide
token and ESLint baselines still contain unrelated pre-existing debt; focused
checks for the changed surfaces pass. Independent review and compound capture
remain before final closeout.