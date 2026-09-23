---
title: Frontier Corp Rebrand Model Council
description: Three-perspective review of brand hierarchy, FDE fleet naming, compatibility, and release provenance for issue 428.
author: GitHub Copilot
ms.date: 2026-09-10
ms.topic: reference
---

## Council Context

**Mode:** Three independent read-only subagents
**Purpose:** ADR options

The council reviewed [the brand contract](../../BRAND.md) and
[the execution plan](../../execution/plans/EXEC-PLAN-428-frontier-corp-rebrand.md).

## Questions

1. Is the hierarchy Frontier Corp company, Frontier product, Hypervelocity
   Engineering methodology, and Forward Deployed Engineer fleet coherent?
2. Should all agent display names follow `Frontier <Specialty> FDE`?
3. Should the partial HVE namespace be replaced or retained as compatibility?
4. Which AgentX identifiers remain public contracts or historical facts?

## Council Roster

| Role | Reviewer |
|------|----------|
| Analyst | Architecture Reviewer |
| Strategist | Product Manager |
| Skeptic | Implementation Validator |

## Member Responses

### Analyst

Position: Approve with tighter identity classification. Frontier Corp should be
the company, Frontier the product and namespace, and Hypervelocity Engineering
the methodology. Use FDE names only for display identity while retaining stable
role IDs. Replace HVE only after release provenance proves it was not published;
still migrate local HVE state through an atomic single-writer path.

Primary risks: conflating company and product, assuming all HVE identifiers are
private, hiding published AgentX provenance, changing stable role IDs, and
creating multiple writable state stores.

### Strategist

Position: Approve the hierarchy but simplify first-contact language and tighten
fleet names. The FDE model fits agents that deploy into a repository, but it must
be defined for audiences unfamiliar with enterprise FDE terminology. Use
specialty names rather than seniority labels, enumerate every role, and include a
controlled `formerly AgentX` migration signpost.

Primary risks: term overload, ambiguity with the generic phrase `frontier model`,
overlong picker names, missing agent-name compatibility, and documentation that
advertises machine identifiers before they exist.

### Skeptic

Position: Do not approve machine migration without provenance and executable
compatibility evidence. Commands, chat participants, MCP tools, state roots,
environment variables, generated assets, filenames, and test discovery are
separate contracts. A hybrid dirty worktree makes broad replacement especially
risky.

Primary risks: public HVE identifiers misclassified as private, split-brain state,
aliases that are displayed but not registered, stale generated bundles, renamed
tests disappearing from aggregate execution, and delete/add renames obscuring
user changes.

## Synthesis

### Consensus

All members support separating company, product, methodology, and fleet identity.
They agree that stable role IDs should remain role-oriented, machine contracts
need per-surface compatibility tests, generated assets must come from canonical
sources, and state migration must be atomic, idempotent, and single-writer.

### Release Provenance

The `v9.2.0` tag at `b3f26106467c9d77a06d8ae9336d0a7b43bba5cb`
and current `HEAD` both contain AgentX README, extension, and orchestrator
identity. HVE appears only in the dirty migration worktree. This evidence permits
removal of active HVE product identifiers, while local `.hve` state remains an
explicit migration input.

### Resolved Divergences

* Frontier remains the product namespace despite its generic AI meaning because
  the user selected Frontier Corp and a concise namespace is required. Primary
  introductions use `Frontier Corp` to disambiguate the proper noun.
* Full FDE display names remain in agent definitions and pickers because fleet
  identity is a stated requirement. Prose may use specialty-only short forms
  after first reference to control token cost.
* The work remains one release rather than two. Internal sequencing prevents docs
  from advertising a Frontier machine surface before its implementation and test
  exist.
* AgentX compatibility remains visible in migration help, diagnostics, install
  coordinates, and provenance, but hidden from normal command and agent discovery.

### Required Adjustments

* Enumerate all 26 FDE display names in the brand contract.
* Add one `Frontier, formerly AgentX` signpost to primary migration surfaces.
* Inventory identifiers as Frontier canonical, AgentX published, HVE transient,
  or historical before replacement.
* Validate commands, chat, MCP, CLI, state, generated assets, filename discovery,
  and test-count parity independently.
* Keep `.frontier` as the sole writer after migration and test both old state roots
  as read-only migration inputs.

## Decision

**APPROVED WITH REQUIRED CONTROLS.** The brand hierarchy and FDE fleet naming are
accepted. Implementation must satisfy the provenance, compatibility, generation,
and test-discovery controls above before the rebrand can complete.