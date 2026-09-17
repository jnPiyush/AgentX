---
name: prototype-craft
description: 'Craft visually polished, production-quality HTML/CSS prototypes with modern styling, typography, color theory, and micro-interactions. Use when building UX deliverables that need visual polish beyond wireframes, implementing color systems, typography scales, elevation shadows, or smooth transitions for interactive prototypes.'
---

# Prototype Craft

Build beautiful, interactive HTML/CSS prototypes that look and feel like real products -- not wireframes.

## When to Use This Skill

- Building HTML/CSS prototypes that need production-quality visual polish
- Implementing color palettes, typography scales, and spacing systems
- Adding micro-interactions, transitions, and elevation shadows
- Crafting responsive layouts with modern CSS (Grid, Flexbox, custom properties)
- Polishing UX deliverables beyond skeletal wireframes

## Core Rules

1. **Visual polish first** -- prototypes MUST look production-quality, not skeletal
2. **Modern CSS** -- use CSS Grid, Flexbox, custom properties, clamp(), container queries
3. **Typography** -- use font pairing (max 2-3 families), proper scale (1.25-1.333 ratio), line-height 1.5-1.75
4. **Color system** -- define palette with CSS custom properties: primary, secondary, neutral, success, warning, error + tints/shades
5. **Spacing rhythm** -- use consistent 4px/8px base grid; spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
6. **Depth and shadow** -- layered box-shadows for elevation (sm, md, lg, xl); subtle borders for separation
7. **Transitions** -- all interactive elements have smooth transitions (150-300ms ease); no jarring state changes
8. **Accessibility** -- WCAG 2.1 AA minimum; 4.5:1 contrast; focus-visible; skip-to-content; aria labels

## Prerequisites

Start with confirmed audience, primary tasks, brand direction and target
`DESIGN.md`; inspect existing components before choosing a technique. Browser
inspection is an external prerequisite for judging rendered output, not a
substitute for design.

## Decision Guide

Use static HTML for simple flows, and
[working-prototype-app](../working-prototype-app/SKILL.md) for routing or durable
state. Choose utility layouts for repeated operational tasks, and expressive
layouts only when the product context supports them.

Delegated work MUST NOT start, reset, iterate or complete the parent-owned loop;
return scoped evidence without changing its baseline or approval history.

## Workflow and Verification Checklist

1. Select a layout based on the user's tasks and compare two justified alternatives.
2. Apply the target tokens; treat referenced examples as techniques, not a default theme.
3. Implement meaningful loading, error, empty and success states for the flow.
4. Render at observed desktop and mobile widths, check text wrapping and keyboard
  operation, and use prototype-audit for accessibility and visual evidence.
5. Recheck affected states after edits; report checks not executed as unavailable.

## Error Handling

If the brand direction is missing, resolve it before inventing a visual system.
If browser tooling is unavailable, return a source-reviewed draft with that limit,
not a polished-output certification. If a technique conflicts with usability,
accessibility or the target design, remove it instead of waiving the user's needs.

## Visual Techniques

These are conditional techniques, not defaults. The target `DESIGN.md`, product
posture, accessibility requirements and anti-slop rules take precedence over
referenced examples. Do not apply glass, gradients, large card radii or viewport-scaled
type to routine product screens merely because an example demonstrates them.
An Impeccable PASS does not establish usability, originality or accessibility.

MUST read the applicable reference before selecting or applying a technique:

- [Visual techniques and component patterns](references/visual-techniques.md)
  for palette, typography, elevation, transitions, glass, cards, tables, forms,
  navigation or dashboard stats.
- [Framework and layout recipes](references/framework-layout.md) for Tailwind
  or pure CSS, breakpoints, file layout and product-specific layout decisions.
- [Animation recipes](references/animation-recipes.md) for page transitions,
  stagger, hover, scroll reveal, shimmer, modals, count-up or live indicators.

## Anti-Patterns

- Placeholder-only content ("Lorem ipsum" everywhere) -- use realistic sample data
- Missing states: always design empty, loading, error, success states
- Flat/unstyled buttons without hover/active/focus states
- Fixed pixel widths that break on resize
- Color contrast below 4.5:1 for text
- Missing focus indicators on interactive elements

## Assets

- [Prototype tokens](assets/prototype-tokens.css) provide CSS custom properties
  for spacing, typography, Apple-style elevation and Stripe-style precision.
  Use as a foundation only when consistent with the target design.

## Verification Checklist

- Required flow states, desktop/mobile wrapping and keyboard operation checked.
- Affected states rechecked after fixes; unavailable checks reported honestly.
- [Prototype audit](../prototype-audit/SKILL.md) supplies accessibility and visual
  evidence; source review alone is not rendered-output certification.

## References

- [Anti-Slop Skill](../anti-slop/SKILL.md) -- forbidden visual tells (T1-T10) and honest-placeholder rules. Load alongside this skill when crafting prototypes.
- [Brand Spec Extraction](../brand-spec-extraction/SKILL.md) -- protocol for extracting a brand spec from a referenced site or screenshot before crafting.
- [Design System Reasoning](../design-system-reasoning/SKILL.md) -- posture and archetype framework
- [UX/UI Design Skill](../ux-ui-design/SKILL.md) -- methodology and research
- [Frontend/UI Skill](../frontend-ui/SKILL.md) -- semantic HTML, accessibility patterns
