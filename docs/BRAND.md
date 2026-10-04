---
title: Frontier Corp Brand
description: Canonical identity, positioning, terminology, voice, and compatibility rules for Frontier Corp and its Forward Deployed Engineer fleet.
author: Frontier Corp
ms.date: 2026-09-27
ms.topic: reference
---

## Brand Foundation

Frontier Corp is an AI-native engineering company built for Hypervelocity
Engineering. Its fleet of specialized Forward Deployed Engineers works inside
the repository to turn intent into shipped, reviewed, evidence-backed software.

Frontier does not present agents as generic assistants. Each agent is an FDE
with a defined specialty, operating contract, delivery boundary, and evidence
standard. Together, the fleet covers product, architecture, experience, data,
implementation, review, operations, testing, and domain delivery.

**Primary tagline:** A fleet of Forward Deployed Engineers for Hypervelocity
Engineering.

**Short description:** Frontier Corp deploys specialized AI FDEs that plan,
build, verify, and improve software through a governed engineering workflow.

## Identity Hierarchy

| Layer | Canonical term | Use |
|-------|----------------|-----|
| Company and publisher | Frontier Corp | First reference, legal-facing copy, primary introductions |
| Product and short brand | Frontier | Commands, navigation, compact UI, conversational references |
| Operating discipline | Hypervelocity Engineering | The engineering system Frontier practices and enables |
| Discipline abbreviation | HVE | Methodology references only, never the company or product name |
| Fleet | Frontier FDE Fleet | The complete multi-agent workforce |
| Individual specialist | Forward Deployed Engineer (FDE) | Every agent role in the fleet |
| Orchestrator | Frontier Orchestration FDE | Top-level routing and end-to-end delivery agent |

## Fleet Naming

Agent filenames and stable role IDs remain role-oriented. Human-readable names
follow `Frontier <Specialty> FDE`.

| Stable role ID | Display name |
|----------------|--------------|
| `frontier` | Frontier Orchestration FDE |
| `product-manager` | Frontier Product FDE |
| `ux-designer` | Frontier Experience FDE |
| `architect` | Frontier Architecture FDE |
| `engineer` | Frontier Engineering FDE |
| `reviewer` | Frontier Review FDE |
| `reviewer-auto` | Frontier Auto-Fix FDE |
| `devops` | Frontier DevOps FDE |
| `data-scientist` | Frontier AI Systems FDE |
| `tester` | Frontier Test FDE |
| `fabric-engineer` | Frontier Fabric FDE |
| `power-platform-builder` | Frontier Power Platform FDE |
| `powerbi-analyst` | Frontier Power BI FDE |
| `consulting-research` | Frontier Research FDE |
| `agile-coach` | Frontier Agile FDE |
| `github-ops` | Frontier GitHub Ops FDE |
| `ado-ops` | Frontier ADO Ops FDE |
| `ado-prd-to-wit` | Frontier ADO Planning FDE |
| `functional-reviewer` | Frontier Functional Review FDE |
| `architecture-reviewer` | Frontier Architecture Review FDE |
| `prompt-engineer` | Frontier Prompt FDE |
| `eval-specialist` | Frontier Evaluation FDE |
| `ops-monitor` | Frontier Observability FDE |
| `rag-specialist` | Frontier RAG FDE |
| `diagram-specialist` | Frontier Diagram FDE |
| `prototype-auditor` | Frontier Prototype Audit FDE |

Use the full display name in agent definitions and agent pickers. After a role is
introduced, prose may use its specialty alone, such as `the Architecture FDE`,
when the shorter form is unambiguous.

## Machine Identity

| Surface | Canonical value | Compatibility rule |
|---------|-----------------|--------------------|
| VS Code commands and settings | `frontier.*` | AgentX/HVE aliases and settings fallbacks are not supported |
| Chat participant | `frontier.chat`, `@frontier` | Use Frontier command prefixes; no old product-name aliases |
| CLI-facing name | `frontier` | Launchers live in `.frontier/runtime/`; no legacy `.agentx` launchers |
| MCP tools | `frontier_*` | Old product-name tool aliases are rejected |
| Runtime code | `.frontier/runtime/` | Tracked CLI, MCP server, hooks, plugins and templates |
| Mutable state | Private workspace profile or `.frontier/` | Old `.agentx/` and `.hve/` state is ignored and is not migrated |
| Environment variables | `FRONTIER_*` | No `AGENTX_*` or `HVE_*` fallback readers or emitters |
| Plugin host requirements | `engines.frontier` | Deprecated AgentX/HVE engine keys are rejected; update manifests explicitly |
| Pack names | `frontier-*` | Preserve old package coordinates only where already published |

The repository URL, Marketplace extension ID, historical release assets, and
checksums remain factual until those external resources are migrated. Their old
names do not define the active brand. Current migration surfaces include one
clear signpost: `Frontier, formerly AgentX`. Do not expose HVE as an intermediate
product name.

## Brand Icon

The user-selected AI coding harness mark replaces the robot and standalone X
marks. This icon-only update does not change the product name, colour tokens,
typography, layout, or functional command/status icons.

The maintained artwork is in `vscode-extension/resources/`:

| Asset | Use |
|-------|-----|
| `frontier-ai-coding-harness.svg` | Coloured vector master for website and repository branding |
| `frontier-ai-coding-harness.png` | Transparent 256x256 export for the Marketplace icon, chat avatar, extension README, and Teams colour-icon generation |
| `frontier-ai-coding-harness-vscode.svg` | Matching monochrome `currentColor` artwork for the theme-coloured VS Code Activity Bar |

The landing build generates `docs/assets/frontier-logo.svg` and
`public/assets/frontier-logo.svg` from the coloured master. Do not maintain these
copies independently. When the artwork changes, regenerate the PNG and update
the matching monochrome paths together. The source prototype and built site both use that mark for
the home link and favicon; the adjacent Frontier label supplies the home-link name.
Teams packaging derives the 192x192 colour icon and 32x32 white transparent
outline from the same PNG rather than drawing a different letterform.

Keep SVG out of the Marketplace package-icon field and regular Marketplace
README images; use the PNG there. Published release artifacts remain unchanged
until a separately requested versioned release.

## Voice

Frontier speaks with technical authority and operational clarity.

* Lead with the engineering outcome or decision
* Name the responsible FDE specialty and expected evidence
* Prefer concrete mechanisms over claims of speed or intelligence
* Use mission language sparingly and only when it clarifies ownership
* Describe autonomy together with boundaries, review, and recovery
* Avoid inflated claims, military theater, generic AI language, and invented proof

## Editorial Rules

* Write `Frontier Corp` for the company and `Frontier` for the product
* Write `Hypervelocity Engineering` as two words and capitalize both words
* Define `Forward Deployed Engineer (FDE)` on first reference
* Use `FDEs` for the plural, not `FDE's`
* Use `HVE` only for the operating discipline
* Do not call Frontier a framework when `engineering system`, `platform`, or
  `FDE fleet` is more precise
* Use `Frontier, formerly AgentX` once on primary migration and install surfaces
* Do not rewrite historical records that accurately describe AgentX releases

## Standard Introduction

Frontier Corp is an AI-native engineering company that practices Hypervelocity
Engineering through a fleet of specialized Forward Deployed Engineers. Frontier
FDEs work across the software lifecycle, from product discovery and architecture
through implementation, review, operations, and learning. Repo-local contracts,
mechanical quality gates, and durable evidence keep autonomous delivery aligned
with engineering intent.