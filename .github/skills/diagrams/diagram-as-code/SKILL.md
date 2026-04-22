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
> **Scope**: This skill is the convention layer. The `diagram-specialist` sub-agent (`.github/agents/internal/diagram-specialist.agent.md`) owns spawn-and-execute behavior. Each reference file covers one format or quality concern.

---

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

---

## Default Format Policy (Mermaid-First)

**Mermaid is the default for all AgentX templates and artifacts.** It renders natively in GitHub, VS Code preview, most markdown tooling, and is the lowest-friction option for reviewers.

Use another format ONLY when one of these is true:

1. Mermaid cannot express the diagram intent (e.g. true swimlanes with role columns, native Visio `.vsdx` round-trip, complex cluster layouts).
2. The user explicitly asks for PlantUML, draw.io, Structurizr, or Graphviz.
3. The artifact must round-trip to Visio (`.vsdx`) -- in that case use draw.io.

When falling back, record the reason in the diagram's header comment (e.g. `<!-- Format: draw.io; reason: Visio round-trip required -->`).

---

## Decision Matrix (pick-the-format)

| Intent | Primary format | Fallback (only if Mermaid cannot express it) | Visio round-trip |
|--------|----------------|-----------------------------------------------|------------------|
| System context (C4 L1) / containers (C4 L2) | **Mermaid C4** | Structurizr DSL | Mermaid -> Visio web |
| Component / class structure (C4 L3, UML) | **Mermaid class / flowchart** | PlantUML | draw.io |
| Sequence (API, message, handoff) | **Mermaid sequence** | PlantUML sequence | Mermaid -> Visio web |
| State machine / lifecycle | **Mermaid state** | PlantUML state | draw.io |
| ER / data model | **Mermaid ER** | PlantUML ER | draw.io |
| Journey map / capability map | **Mermaid flowchart (LR) or journey** | draw.io | Mermaid -> Visio web |
| Dependency / call graph | **Mermaid flowchart** | Graphviz DOT | SVG -> draw.io -> `.vsdx` |
| Gantt / roadmap timeline | **Mermaid gantt** | draw.io | draw.io |
| Cross-functional workflow / swimlane / RACI | **Mermaid flowchart with subgraph lanes** | PlantUML activity beta, then draw.io CFF | draw.io -> `.vsdx` |
| Role-phase matrix (roles as columns, phases as bands) | **Mermaid flowchart with subgraph lanes** | draw.io CFF | Native `.vsdx` export |
| Network / infra topology with many cluster boundaries | **Mermaid flowchart with subgraphs** | draw.io | Native `.vsdx` export |

Rule: Mermaid first. If the intent fits the matrix fallback column, justify it in the header comment. If the deliverable must round-trip to native Visio (`.vsdx`), draw.io is the only allowed format.

---

## Five Non-Negotiables

1. **Mermaid-first** -- use Mermaid unless the intent cannot be expressed in Mermaid, Visio round-trip is required, or the user explicitly requests another format. Record the reason in the diagram header comment when falling back.
2. **Text-first source** -- the diagram code is committed in git; any PNG/SVG/VSDX is an export next to it, not a replacement.
3. **Titled and legended** -- every diagram has a title, a legend for non-obvious shapes/colors, and a link back to the PRD/ADR/spec it supports.
4. **Intent-matched format** -- if a non-Mermaid format is chosen, it must match the Decision Matrix and the justification must be recorded.
5. **Rendered before merge** -- the author validated the render in the target surface (GitHub markdown, Visio web, draw.io, PlantUML) before handoff.

---

## Load Order

1. This `SKILL.md` (decision matrix + non-negotiables)
2. Pick the relevant reference:
   - [references/swimlane-patterns.md](references/swimlane-patterns.md) -- cross-functional / CFF / RACI flows
   - [references/mermaid-patterns.md](references/mermaid-patterns.md) -- flowchart, sequence, state, ER, C4, journey
   - [references/plantuml-patterns.md](references/plantuml-patterns.md) -- activity beta, sequence, component, deployment
   - [references/c4-structurizr.md](references/c4-structurizr.md) -- C4 model levels + Structurizr DSL
   - [references/graphviz-dot.md](references/graphviz-dot.md) -- dependency / network graphs
   - [references/visio-interop.md](references/visio-interop.md) -- `.vsdx` import/export paths
3. [references/diagram-review-checklist.md](references/diagram-review-checklist.md) -- review gate

---

## Authoring Rules

- **Filename**: `<artifact>-<issue>-<short-name>.<ext>` (e.g. `ADR-42-context.mmd`, `PRD-17-contract-workflow.drawio`)
- **Location**: under a `diagrams/` subfolder inside the parent artifact's directory
- **Header comment**: title, owner artifact, date, AgentX issue number
- **ASCII only** -- no emoji, no Unicode symbols (per AgentX golden principle). Use `->`, not arrow glyphs
- **Contrast** -- avoid pastel-on-pastel; favor default theme colors over custom palettes unless the target surface requires branding

## Consumer Checklist (any reviewer)

Before approving a diagram-bearing artifact:

- [ ] Source is text (Mermaid, PlantUML, DSL, DOT, or draw.io XML), not a raw image
- [ ] Format matches intent (check against the decision matrix)
- [ ] Title + legend + source-link present
- [ ] Renders in the target surface
- [ ] For swimlanes: every activity in one lane; handoffs labeled; lane count <= 7
- [ ] For C4: one level per diagram (no mixing context with component)
- [ ] For sequences: arrows carry action + payload, not just direction
- [ ] Any binary export (.vsdx, .png, .svg) is co-located with its source
