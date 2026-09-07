---
name: "prd"
description: "Produce production-grade Product Requirements Documents (PRDs) that bridge business vision and technical execution. Use when writing, reading, reviewing, or extending a PRD -- by Product Manager agents authoring one, or by Architect/UX/Engineer/Agent-X agents that need to consume or fact-check PRD conventions without loading the full PM agent contract."
user-invocable: false
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-21"
  updated: "2026-04-21"
---
# Product Requirements Document (PRD)

> **Purpose**: Shared PRD conventions loadable by any AgentX role.
> **Goal**: Concrete, measurable, non-contradictory requirements that survive handoff to Architect, UX, Data Scientist, and Engineer.
> **Scope**: This skill is the conventions layer. The PM agent contract ([.github/agents/product-manager.agent.md](../../../agents/product-manager.agent.md)) owns the full authoring workflow. The template ([.github/templates/PRD-TEMPLATE.md](../../../templates/PRD-TEMPLATE.md)) owns the section structure.

## When to Use This Skill

- Authoring a PRD (PM agent)
- Reading a PRD to design architecture (Architect)
- Reading a PRD to design UX (UX Designer)
- Reading a PRD to plan ML/AI work (Data Scientist)
- Reading a PRD to implement a story (Engineer)
- Reviewing a PRD for quality (Reviewer, Agent X)
- Refining or amending an existing PRD

Non-PM agents load this skill to understand **what a "good" PRD looks like** without pulling the full PM agent payload.

## Prerequisites

Before drafting or reviewing, collect the problem statement, target user,
success metric, hard constraints, and known repo context. If any of those are
missing, record `TBD` and surface an Open Question instead of inventing facts.

## Load Order

1. This `SKILL.md` (conventions)
2. [`.github/templates/PRD-TEMPLATE.md`](../../../templates/PRD-TEMPLATE.md) (structure)
3. [`.github/agents/product-manager.agent.md`](../../../agents/product-manager.agent.md) (full authoring contract, PM role only)
4. [`references/requirements-quality.md`](references/requirements-quality.md) (vague vs concrete, anti-patterns)
5. [`references/pbi-examples.md`](references/pbi-examples.md) (Product Backlog Item examples and issue-body patterns)
6. [`references/worked-example.md`](references/worked-example.md) (end-to-end filled example)

---

## Decision Guide

Use the root when you need the shared release gate for PRD quality. Use the
template when writing or extending the document structure. Use the PM agent
contract only for the full PM workflow. If you must judge requirement quality,
PBI completeness, or an AI-bearing PRD contract, read
[details-prd-quality-and-consumption.md](references/details-prd-quality-and-consumption.md)
before approving handoff.

## Core Rules

A PRD must be evidence-based, measurable, aligned to stated user intent, and
explicit about non-goals. Every important requirement must be testable, every
unknown must stay visible as `TBD` or an Open Question, and every backlog item
must carry enough scope, acceptance, and dependency context that downstream
agents do not have to reverse-engineer the PRD.

## Workflow

1. Load this root, the PRD template, and the supporting references in the order
   above.
2. Capture research evidence, user intent, metrics, constraints, and unknowns
   before drafting claims as requirements.
3. Write the PRD in the template, then enforce measurable requirements,
   explicit non-goals, and complete acceptance criteria using the detail
   reference.
4. If the PRD includes AI work, specify the product-facing AI contract, then
   decompose to PBIs and review the final draft with the checklist below before
   handing off to Architect, UX, Data Scientist, or Engineer.

## Pitfalls

The fastest way to break a PRD is to use vague adjectives, invent technical
constraints, hide open questions, or write backlog items that say only "build
X". Those anti-patterns force downstream agents to guess.

## Error Handling

If a claim cannot be sourced, measured, or tested, do not smooth it over.
Replace it with `TBD`, add an Open Question, or send the draft back through the
clarification loop. When downstream consumers cannot act without guessing, the
handoff is blocked until the requirement becomes concrete.

## Checklist


When a non-PM agent loads a PRD before doing its own work:

- [ ] Problem Statement is present and specific
- [ ] At least one success metric is numeric
- [ ] Every P0 requirement has testable AC
- [ ] Non-Goals are explicit
- [ ] If AI-bearing, the product-facing AI contract is complete (see [details-prd-quality-and-consumption.md](references/details-prd-quality-and-consumption.md))
- [ ] No constraint contradicts the original user intent
- [ ] Open Questions are listed rather than silently assumed



If any check fails, the downstream agent MUST push back through the clarification loop rather than inventing the missing requirement.

## Why This Is a Skill

PRDs fail when agents treat them as prose instead of as a handoff contract.
This skill gives every role a shared definition of requirement quality,
backlog-item completeness, and AI contract scope so product intent survives
handoff into architecture, UX, data science, and engineering work.

## Related

- [Documentation skill](../../development/documentation/SKILL.md)
- [AI Agent Development skill](../../ai-systems/ai-agent-development/SKILL.md)
- [Code Review skill](../../development/code-review/SKILL.md)

## References

- [references/details-prd-quality-and-consumption.md](references/details-prd-quality-and-consumption.md): read when you need the full five non-negotiables, discovery gate, requirements quality rule, PBI rule, AI product-contract table, or schema delegation guidance relocated verbatim from the original root.
