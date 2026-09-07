---
name: "diagram-as-code"
description: "Author, review, and maintain diagrams as code across Mermaid, PlantUML, Structurizr DSL, Graphviz DOT, and draw.io XML. Covers swimlane/cross-functional workflows, C4 architecture, sequence, state, ER, dependency, and network diagrams. Use when any agent needs to create or update a diagram in a PRD, ADR, spec, UX flow, or architecture doc."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-21"
  updated: "2026-04-21"
---
# Diagrams as Code

> **Purpose**: One conventions layer for all diagrams produced across AgentX roles.
> **Principle**: Text-first, diffable, reviewable, rendered at read-time. Binary formats (PNG, JPG, VSDX) are an export, never the source of truth.
> **Scope**: This skill is the convention layer. The `diagram-specialist` sub-agent ([.github/agents/internal/diagram-specialist.agent.md](../../../agents/internal/diagram-specialist.agent.md)) owns spawn-and-execute behavior. Each reference file covers one format or quality concern.

## When to Use

Load this skill any time an agent needs to:

- Create a swimlane / cross-functional workflow (e.g. the contract-lifecycle template)
- Draw a C4 context / container / component diagram for an ADR or spec
- Capture an API or event sequence
- Document a state machine or lifecycle
- Render an ER diagram or data model
- Produce a network / infra / pipeline topology
- Convert a legacy Visio file into a diffable code artifact
- Review an existing diagram for clarity and correctness

## Prerequisites

No install prerequisites are implied by this root. Know the owner artifact, the
rendering surface reviewers will use, and whether the deliverable must round-trip
through Visio before choosing a format.

## Decision Guide

Default to Mermaid for GitHub-native diagrams. For C4 context or container
views, verify that the target surface renders Mermaid C4 before depending on it;
otherwise use Structurizr or another exported alternative. For formal swimlane or
cross-functional flow artifacts that must pass native-lane review, prefer
PlantUML activity beta, draw.io CFF, or BPMN. Use the full routing table in
[details-format-policy-and-review.md](references/details-format-policy-and-review.md#decision-matrix-pick-the-format)
when the diagram intent is ambiguous.

## Core Rules

Use text-first source as the artifact of record, keep the source beside any
binary export, and make the title, legend, and owner artifact explicit. Match
the format to the diagram intent, record fallback reasons in the header comment,
and render the result in the target surface before handoff. Keep filenames,
paths, ASCII-only content, and contrast choices review-friendly.

## Workflow

1. Identify the artifact and the diagram intent before drawing anything.
2. Choose Mermaid first, then confirm whether the target surface supports any
   advanced syntax you plan to use and whether the swimlane review gate requires
   a native-lane format before finalizing the choice.
3. Author the source file, add header metadata, and keep exports as secondary
   artifacts next to the source.
4. Render the diagram in the consumer surface and run the reviewer checklist
   before handing off the PRD, ADR, spec, or UX flow.

## Load Order

Read [references/details-format-policy-and-review.md](references/details-format-policy-and-review.md) first (decision matrix, non-negotiables, authoring rules, reviewer checklist), then follow the routing order below.

1. This `SKILL.md` (decision matrix + non-negotiables)
2. Pick the relevant reference:
   - [references/swimlane-patterns.md](references/swimlane-patterns.md) -- cross-functional / CFF / RACI flows
   - [references/mermaid-patterns.md](references/mermaid-patterns.md) -- flowchart, sequence, state, ER, C4, journey
   - [references/plantuml-patterns.md](references/plantuml-patterns.md) -- activity beta, sequence, component, deployment
   - [references/c4-structurizr.md](references/c4-structurizr.md) -- C4 model levels + Structurizr DSL
   - [references/graphviz-dot.md](references/graphviz-dot.md) -- dependency / network graphs
   - [references/visio-interop.md](references/visio-interop.md) -- `.vsdx` import/export paths
3. [references/diagram-review-checklist.md](references/diagram-review-checklist.md) -- review gate

Renderer note: verify Mermaid C4 support before relying on it; some renderers need Structurizr DSL or draw.io instead.

## Pitfalls

Do not ship image-only diagrams, mix multiple C4 levels in one picture, create
swimlanes with unlabeled handoffs, or pick draw.io / PlantUML / DOT without a
clear format reason. The full checklist and authoring details are in the detail
reference.

## Error Handling

If a renderer fails, first check the chosen syntax against the format-specific
reference, then simplify the diagram until it renders cleanly. When Mermaid
cannot express the layout, switch to the approved fallback and record that
reason instead of forcing a broken diagram through review.

## Checklist

Before approval, confirm the source is text, the format matches the intent, the
diagram has a title and legend, the target surface renders it, and any export is
co-located with its source. For swimlanes, label handoffs and keep lane count
bounded; for sequences, label arrows with the action and payload.

## Why This Is a Skill

Diagram work fails when agents treat every format as interchangeable or optimize
for a screenshot instead of a reviewable source artifact. This skill gives every
role one routing policy, one review gate, and one set of authoring constraints
so diagrams stay diffable, consistent, and reusable across PRDs, ADRs, specs,
and UX flows.

## References

- [references/details-format-policy-and-review.md](references/details-format-policy-and-review.md): read when you need the full default-format policy, decision matrix, non-negotiables, authoring rules, or the complete reviewer checklist relocated verbatim from the original root.
