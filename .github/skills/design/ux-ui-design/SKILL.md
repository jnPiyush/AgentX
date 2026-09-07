---
name: "ux-ui-design"
description: 'Design user experiences with wireframing, prototyping, user flows, accessibility, and production-ready HTML prototypes. Use when creating wireframes, building interactive prototypes, designing user flows, implementing accessibility standards, or producing HTML/CSS design deliverables.'
user-invocable: false
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 agents: ["ux-designer", "agent-x"]
 frameworks: ["html-css", "figma", "tailwind", "bootstrap"]
 output-formats: ["html", "css", "markdown", "mermaid"]
---

# UX/UI Design & Prototyping

> **Purpose**: Create user-centered designs, wireframes, prototypes, and production-ready HTML/CSS interfaces.

---

## When to Use This Skill

- Creating wireframes or high-fidelity mockups
- Building interactive HTML/CSS prototypes
- Designing user flows and information architecture
- Implementing accessibility (WCAG) standards
- Setting up design systems or component libraries

## Prerequisites

- Basic HTML/CSS knowledge for prototyping
- Design tool access

## Decision Tree

Use the full discovery-to-prototype path for net-new features. Collapse to
hi-fi or HTML prototype only for scoped bug fixes. Route design-system work to
tokens and component updates first, and route a11y or responsive issues to the
dedicated validation passes before polishing visuals.

## Core Rules

- Start from user goals, posture, and real content before layout details.
- Design every required state, breakpoint, and accessibility behavior before
  handoff.
- Build production-ready HTML/CSS prototypes with semantic markup, tokens, and
  implementation-ready notes instead of static mockups alone.
- Record design decisions early enough that engineering can implement without
  reverse-engineering intent.

## Anti-Patterns

Do not skip research, rely on placeholder content, retrofit mobile late, or
treat accessibility as a final cleanup pass. The full anti-pattern catalog and
the original do/don't lists are in the detail reference.

## Workflow

1. Classify the design task: new feature, small change, design-system update,
   accessibility audit, or responsive fix.
2. Start from posture, user goals, and real content before choosing fidelity.
3. Produce the right artifact sequence for the task: research -> IA ->
   wireframes -> flows -> hi-fi -> HTML prototype, skipping only the stages
   that the decision tree explicitly allows you to collapse.
4. Validate states, accessibility, responsiveness, and implementation realism
   before handoff.
5. Route to the linked reference files for code patterns, templates, and test
   assets before declaring the UX deliverable complete.

## Checklist

- Product posture, archetype, and target users are defined before screen work.
- The deliverable covers empty, loading, error, success, and partial states.
- The prototype uses semantic HTML, ARIA where needed, and responsive tokens.
- The chosen reference files are attached for research, prototype code, a11y,
  responsive rules, and usability testing as needed.
- Handoff notes explain the design decisions and how engineers should build the
  result without guessing.

## Error Handling

If the problem statement is under-specified, pause screen work and clarify the
user goal, posture, and success metric first. If implementation constraints
invalidate the design, capture the constraint and revise the prototype instead
of handing off a knowingly unbuildable screen. If accessibility or responsive
checks fail, route to the linked reference before declaring the work done.

## Why This Is a Skill

General design advice rarely specifies the next artifact or readiness gate.
This skill connects research, accessibility, prototyping, and handoff through
explicit decisions and phase-specific references.

## Reference Files

Detailed code blocks and templates are extracted into dedicated reference files:

| Reference | Contents |
|-----------|----------|
| [html-prototype-code.md](references/html-prototype-code.md) | Full HTML/CSS/JS prototype code (dashboard, modals, forms, tokens) |
| [research-templates.md](references/research-templates.md) | Persona template, user journey map template |
| [accessibility-patterns.md](references/accessibility-patterns.md) | Screen reader markup, keyboard navigation JS, ARIA patterns |
| [responsive-patterns.md](references/responsive-patterns.md) | Breakpoint CSS, responsive grid, mobile-first examples |
| [usability-testing-template.md](references/usability-testing-template.md) | Full usability test plan, script, and results template |

---

**Related Skills:**
- [Frontend/UI Development](../frontend-ui/SKILL.md)
- [React Framework](../../languages/react/SKILL.md)
- [E2E Testing (A11y validation)](../../testing/e2e-testing/SKILL.md)

## References

- [Prototype Tokens Asset](../prototype-craft/assets/prototype-tokens.css) - Production-ready CSS variables
- [Design System Reasoning](../design-system-reasoning/SKILL.md) - Posture and archetype framework
- [Research Ia Wireframing](references/research-ia-wireframing.md)
- [Flows Mockups Prototypes](references/flows-mockups-prototypes.md)
- [Design Systems A11y](references/design-systems-a11y.md)

Read Prototype Tokens Asset when you need ready-made design tokens; Design System Reasoning when choosing a posture or component archetype; Research Ia Wireframing for user research, IA, or wireframing; Flows Mockups Prototypes for user-flow, mockup, or interactive-prototype work; and Design Systems A11y for design-system, accessibility, or responsive-layout rules.

- [details-ux-delivery-guide.md](references/details-ux-delivery-guide.md): read for the relocated original decision tree, full do/don't rules, anti-pattern catalog, table of contents, tool catalog, version note, and troubleshooting guide from the previous root.
