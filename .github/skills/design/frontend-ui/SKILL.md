---
name: "frontend-ui"
description: 'Build frontend UIs with HTML5, CSS3, and Tailwind CSS following accessibility and performance best practices. Use when creating responsive layouts, styling with Tailwind CSS, implementing accessible forms, optimizing frontend performance, or building common UI patterns.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["html", "css", "javascript"]
 frameworks: ["tailwind", "bootstrap"]
 platforms: ["windows", "linux", "macos"]
---
# Frontend/UI Development

> WHEN: Build or review production HTML, CSS, and Tailwind UI where structure, responsiveness, accessibility, and performance must hold together.

## When to Use This Skill

- New page, component, or layout shell in raw HTML, CSS, or Tailwind
- Responsive, form, media, or navigation regressions
- Choosing Grid, Flexbox, utilities, or framework defaults
- Hardening states before the accessibility or prototype-audit gate

## Prerequisites

Know which layer owns styling: Tailwind, Bootstrap, or custom CSS. Use
browser devtools, responsive mode, and a contrast checker. Read the existing
image/form/layout or Tailwind accessibility references only when that surface
is in scope.

## Decision Guide

Start with semantic HTML. Use Grid for page regions and Flexbox for alignment.
Prefer native elements for forms, navigation, and dialogs before custom
widgets. Stay inside the team's existing Tailwind or CSS system unless there is
a clear reason to mix tools. Compose with `prototype-craft` for polish and with
`accessibility` or `prototype-audit` for release gates.

## Core Rules

- Build mobile-first; add breakpoints only after the smallest layout is
  correct.
- Prefer `nav`, `main`, `section`, `article`, `button`, and `form` over
  generic interactive `div`s.
- Keep spacing, type, color, and radius on the established scale; avoid
  one-off magic values.
- Design empty, loading, success, error, disabled, and overflow states before
  calling a component done.
- Ship keyboard reachability, visible focus, descriptive labels, WCAG AA
  contrast, responsive media, and lean CSS as defaults.

## Workflow

1. Identify the surface, framework, breakpoints, and required states.
2. Draft semantic structure so landmarks, headings, forms, media, and buttons
   keep native behavior.
3. Choose Grid, Flexbox, and the styling layer; do not mix systems without a
   reason.
4. Implement responsive behavior and visible states before polish.
5. Validate forms, navigation, images, and dialogs against the linked
   accessibility references.
6. Test mobile, tablet, desktop, keyboard reachability, contrast, and
   error/loading states.
7. Hand off to `prototype-audit` or `accessibility` when the surface is review
   or release bound.

## Pitfalls

Pretty utilities cannot rescue weak structure. Check the detailed
anti-patterns before patching div-only layouts, missing labels, fixed widths,
or inline-style drift.

## Error Handling

If a layout breaks, inspect source order, min-width assumptions, and whether
Grid or Flexbox is overused. If Tailwind utilities conflict, collapse back to
one source of truth. If audits fail, fix semantics, labels, contrast, and
focus before adding more styling.

## Checklist

- Landmarks and heading order are present.
- Mobile-first layout works before larger overrides.
- Forms, images, dialogs, and navigation follow accessible defaults.
- Empty, loading, success, error, disabled, and overflow states are visible.
- Spacing and type stay on the chosen scale.
- Responsive media, lean CSS, and deferred non-critical scripts are in place.

## Why This Is a Skill

General HTML and CSS knowledge does not reliably choose the right layout
primitive, prevent framework drift, cover non-happy-path states, or protect
accessibility and performance under delivery pressure. This skill makes those
decisions mechanical and repeatable.

## Related Links

**See Also**: [Skills.md](../../../../Skills.md) - [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026

- [UX/UI Design Skill](../ux-ui-design/SKILL.md) -- wireframes and methodology
- [Prototype Craft](../prototype-craft/SKILL.md) -- UI visual polish and CSS variables
- [Design System Reasoning](../design-system-reasoning/SKILL.md) -- page archetypes and visual language
- [Tailwind A11y Css](references/tailwind-a11y-css.md)
- [Images Forms Layouts](references/images-forms-layouts.md)
- [Accessibility](../accessibility/SKILL.md) -- WCAG AA and keyboard gates
- [Prototype Audit](../prototype-audit/SKILL.md) -- mechanical multi-pass review
- [Impeccable Integration](../impeccable-integration/SKILL.md) -- design-language setup and Pass 0 checks

## References

- [details-frontend-foundations.md](references/details-frontend-foundations.md):
  read for the original quick reference table, decision tree, semantic HTML
  examples, anti-pattern table, resources, and troubleshooting.
- [Tailwind A11y Css](references/tailwind-a11y-css.md): read when tuning focus,
  contrast, forms, or Tailwind-specific accessibility rules.
- [Images Forms Layouts](references/images-forms-layouts.md): read when solving
  media handling, form structure, or reusable layout patterns.
