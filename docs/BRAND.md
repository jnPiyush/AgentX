---
title: Frontier Corp Brand
description: Canonical identity, positioning, terminology, voice, and compatibility rules for Frontier Corp and its Forward Deployed Engineer fleet.
author: Frontier Corp
ms.date: 2026-09-10
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
| VS Code commands and settings | `frontier.*` | Hidden `agentx.*` aliases may remain for published clients |
| Chat participant | `frontier.chat`, `@frontier` | Keep legacy chat aliases only when the host supports hidden registration |
| CLI-facing name | `frontier` | Legacy launchers delegate to Frontier and emit deprecation guidance |
| MCP tools | `frontier_*` | Legacy tool aliases are callable but not advertised |
| Mutable state | `.frontier/` | Read and migrate `.agentx/` or partial `.hve/` state; write only `.frontier/` |
| Environment variables | `FRONTIER_*` | Read `AGENTX_*` and partial `HVE_*` only as compatibility fallbacks |
| Pack names | `frontier-*` | Preserve old package coordinates only where already published |

The repository URL, Marketplace extension ID, historical release assets, and
checksums remain factual until those external resources are migrated. Their old
names do not define the active brand. Current migration surfaces include one
clear signpost: `Frontier, formerly AgentX`. Do not expose HVE as an intermediate
product name.

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