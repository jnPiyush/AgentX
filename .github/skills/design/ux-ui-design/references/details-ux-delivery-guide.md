# UX/UI Design - Delivery Guide Detail

> Read this when you need the extended navigation, full decision tree, detailed
> do/don't guidance, or troubleshooting material that used to live in the root.
> The sections below are relocated verbatim from the previous root to keep the
> root under budget.

## Decision Tree

Use this to pick the right UX approach for your task:

```
Start: What is the deliverable?
|
+- New feature / epic?
| - 1. User Research -> 2. IA -> 3. Wireframes -> 4. User Flows
| -> 5. Hi-Fi Mockups -> 6. HTML Prototype -> 7. Usability Test
|
+- Bug fix / small change?
| - Skip to step 5 (Hi-Fi) or 6 (HTML Prototype)
|
+- Design system update?
| - Jump to Design Systems - update tokens + components
|
+- Accessibility audit?
| - Jump to Accessibility - run checklist + fix
|
- Responsive issue?
 - Jump to Responsive Design - breakpoint check + fix
```

---

## Core Rules

### [PASS] DO

**Research & Wireframing:**
- Define Product Posture & Archetype BEFORE sketching any screens
- Start with lo-fi sketches; iterate on paper first
- Use real content, never lorem ipsum in final designs
- Annotate interactions on every wireframe
- Test with diverse user demographics

**Design & Prototyping:**
- Follow the 8px spacing grid
- Design for ALL states: empty, loading, error, success, partial
- Build production-ready HTML/CSS prototypes (mandatory)
- Use semantic HTML5 + ARIA attributes from the start
- Use CSS custom properties for all design tokens (see `prototype-craft` asset)
- Validate HTML & CSS

**Collaboration:**
- Document every design decision
- Share prototypes early and gather developer feedback
- Version-control design files
- Hand off with detailed specifications

### [FAIL] DON'T

- Skip user research or design in isolation
- Leave placeholder content in final deliverables
- Ignore edge cases and error states
- Forget mobile/tablet breakpoints
- Neglect accessibility until the end
- Hardcode values instead of using design tokens
- Use large unoptimized images
- Inline all styles (use external stylesheets)
- Block rendering with synchronous scripts

## Anti-Patterns

- **Skipping user research**: Designing based on assumptions -> conduct interviews or surveys with 5+ users before wireframing
- **Lorem ipsum in deliverables**: Placeholder text hides content layout problems -> use realistic content from the actual domain
- **Desktop-first design**: Retrofitting mobile after desktop -> design mobile breakpoints first, then enhance upward
- **Ignoring error states**: Only designing the happy path -> design empty, loading, error, partial, and success states for every screen
- **Pixel-perfect handoff without tokens**: Hardcoded colors and sizes -> define a design token system (CSS custom properties) and reference tokens in specs
- **Accessibility as afterthought**: Running audits only at the end -> integrate WCAG checks from wireframe stage, not after prototyping
- **Overly complex user flows**: 10+ step flows without progress indicators -> limit critical paths to 3-5 steps with clear progress feedback
- **No version control on designs**: Overwriting files with no history -> use Git for HTML prototypes and Figma version history for mockups

---

## Table of Contents

1. [User Research & Analysis](#user-research--analysis)
2. [Information Architecture](#information-architecture)
3. [Wireframing](#wireframing)
4. [User Flows](#user-flows)
5. [High-Fidelity Mockups](#high-fidelity-mockups)
6. [Interactive Prototypes](#interactive-prototypes)
7. [HTML/CSS Prototypes](#htmlcss-prototypes)
8. [Design Systems](#design-systems)
9. [Accessibility (A11y)](#accessibility-a11y)
10. [Responsive Design](#responsive-design)
11. [Usability Testing](#usability-testing)
12. [Best Practices](#best-practices)
13. [Tools & Resources](#tools--resources)

## User Research & Analysis

Use [research-ia-wireframing.md](research-ia-wireframing.md) and
[research-templates.md](research-templates.md) for discovery inputs, personas,
and early synthesis artifacts.

## Information Architecture

Use [research-ia-wireframing.md](research-ia-wireframing.md) for sorting,
navigation, hierarchy, and page-map guidance.

## Wireframing

Use [research-ia-wireframing.md](research-ia-wireframing.md) for lo-fi framing
rules, page structure, and annotation expectations.

## User Flows

Use [flows-mockups-prototypes.md](flows-mockups-prototypes.md) for task flows,
state transitions, and path handoff detail.

## High-Fidelity Mockups

Use [flows-mockups-prototypes.md](flows-mockups-prototypes.md) for visual
refinement checkpoints before code-level prototyping.

## Interactive Prototypes

Use [flows-mockups-prototypes.md](flows-mockups-prototypes.md) and
[html-prototype-code.md](html-prototype-code.md) when the flow must be clicked
through and demonstrated.

## HTML/CSS Prototypes

Use [html-prototype-code.md](html-prototype-code.md) for the production-ready
prototype patterns that back this skill.

## Design Systems

Use [design-systems-a11y.md](design-systems-a11y.md) for tokens, component
consistency, and design-system accessibility alignment.

## Accessibility (A11y)

Use [accessibility-patterns.md](accessibility-patterns.md) and
[design-systems-a11y.md](design-systems-a11y.md) for keyboard, screen-reader,
and ARIA patterns.

## Responsive Design

Use [responsive-patterns.md](responsive-patterns.md) for breakpoints,
mobile-first layout rules, and grid behavior.

## Usability Testing

Use [usability-testing-template.md](usability-testing-template.md) for the
moderated test plan, script, and results format.

## Best Practices

See [../SKILL.md#core-rules](../SKILL.md#core-rules),
[../SKILL.md#workflow](../SKILL.md#workflow), and
[../SKILL.md#checklist](../SKILL.md#checklist) for the condensed release gate.

---

## Tools & Resources

### Design & Wireframing

| Tool | Use Case | Link |
|------|----------|------|
| Figma | Collaborative design | [figma.com](https://figma.com) |
| Sketch | Mac design | [sketch.com](https://sketch.com) |
| Penpot | Open-source design | [penpot.app](https://penpot.app) |
| Balsamiq | Quick wireframes | [balsamiq.com](https://balsamiq.com) |
| Whimsical | Flowcharts + wireframes | [whimsical.com](https://whimsical.com) |
| Excalidraw | Hand-drawn diagrams | [excalidraw.com](https://excalidraw.com) |

### Prototyping

| Tool | Use Case | Link |
|------|----------|------|
| CodePen | Quick HTML/CSS/JS | [codepen.io](https://codepen.io) |
| Tailwind CSS | Utility-first CSS | [tailwindcss.com](https://tailwindcss.com) |
| Bootstrap | Component framework | [getbootstrap.com](https://getbootstrap.com) |

### Accessibility

| Tool | Use Case | Link |
|------|----------|------|
| WAVE | Accessibility checker | [wave.webaim.org](https://wave.webaim.org) |
| axe DevTools | Browser extension | [deque.com/axe](https://www.deque.com/axe) |
| WCAG Quick Ref | Guidelines | [w3.org/WAI](https://www.w3.org/WAI/WCAG21/quickref/) |

### Inspiration

[Dribbble](https://dribbble.com) - [Behance](https://behance.net) - [awwwards](https://awwwards.com)

---

**Version**: 2.0.0 - **Last Updated**: February 10, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Prototype not accessible | Run WAVE or axe-core audit, ensure ARIA labels and keyboard navigation |
| Inconsistent design across pages | Create a design token system with shared colors, spacing, typography |
| User flow too complex | Reduce steps to 3-5 maximum, add progress indicators |
