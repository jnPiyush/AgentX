---
name: "working-prototype-app"
description: 'Build a runnable, multi-page UX prototype as a real SPA when static HTML is insufficient. Use when the prototype must demonstrate routing, state persistence, dynamic data, or interactive flows that exceed what plain HTML/CSS can convey. Provides a Vite + React + Tailwind + Framer Motion + Lucide scaffold, data-driven page layout, debounced localStorage state, and a clean file structure for `src/`.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-12"
  updated: "2026-05-12"
compatibility:
  agents: ["ux-designer", "engineer", "prototype-auditor"]
  frameworks: ["react", "vite", "tailwind", "framer-motion"]
  output-formats: ["spa", "static-build"]
---

# Working Prototype App

> WHEN: A static HTML/CSS deliverable cannot answer the question being asked of the prototype. Typical triggers: multi-screen flow with routing, state that must persist across reloads, data-driven views, or an interactive demo for stakeholder validation. Below that bar, prefer plain HTML/CSS via `prototype-craft`.

## When to Use This Skill

- The prototype must demonstrate real routing across multiple screens.
- Stakeholders need state persistence, filtering, or dynamic lists to judge the UX.
- A static click-through stops being credible because behavior matters as much as layout.
- The team needs a runnable SPA build, but not a real backend integration yet.

## Prerequisites

You need Node and npm available, a scoped prototype question that static HTML
cannot answer, a route list or flow map, and clearly non-sensitive sample data.
If the work requires real backend integration, stop and recast it as a product
spike instead of a UX prototype. Use the scaffold and implementation detail in
[details-react-prototype-implementation.md](references/details-react-prototype-implementation.md).

## Decision Guide

| Need | Use |
|------|-----|
| Single page or short flow, visual review only | `prototype-craft` static HTML |
| Up to 3 screens with simple click-through | `prototype-craft` + plain anchor links |
| Routing, persisted state, dynamic lists, or filtering | This skill |
| Real backend integration | A product spike, not a UX prototype |

If in doubt, start with static. Promote to a working app only after the static answer becomes hand-wavy.

## Core Rules

- Promote from static to SPA only when interaction or persistence is the real
  design question.
- Keep page data in `src/data/`, route logic in `pages/`, shared UI in
  `components/`, and pure helpers in `lib/` or `hooks/`.
- Use the default stack unless the team has a documented reason to substitute
  frameworks.
- Persist only low-risk demo state; localStorage is plain text and same-origin.
- Ship every prototype with a 404 route, accessibility hooks, and basic
  performance discipline so stakeholder feedback reflects the intended UX.

## Workflow

1. Prove the prototype needs a runnable SPA instead of static HTML.
2. Scaffold the stack, wire tokens and global styles, and lay out `src/` using
   the reference file.
3. Model prototype content in `src/data/` before building route components.
4. Add routing, local persistence, and any motion or accessibility hooks needed
   for the flow.
5. Validate build, dev navigation, accessibility, performance, and the 404
   fallback before handoff.

## Pitfalls

Common failures are building backend behavior into a prototype, hard-coding
lists inside components, persisting sensitive data, and forgetting the catch-
all route. The full scaffold, code patterns, and verification checklist stay in
the reference file.

## Error Handling

If scaffold or build steps fail, stop and repair the toolchain before layering
on more UI. If state complexity exceeds safe local demo data, simplify the flow
or escalate to a product spike. If localStorage parsing or quota fails, fall
back to defaults and keep the prototype usable rather than blank. If routing
breaks, preserve the 404 fallback instead of hiding invalid paths.

## Done Criteria

- Stack scaffolded, tokens wired, Tailwind compiling.
- File structure follows the layout above; no business logic in `components/`.
- All prototype content lives in `src/data/`.
- Debounced localStorage hook in place wherever state must survive a reload.
- Routing covers every screen plus a `*` 404 fallback.
- `prototype-audit` passes all ten audit passes (Pass 0 through Pass 9).

## Why This Is a Skill

A working prototype sits between static design and production software: it must
feel real enough for UX validation without accumulating full product scope.
This skill provides that boundary, defining when to graduate from static HTML,
how to structure the app, and which implementation shortcuts remain acceptable
for a prototype.

## Skills to Compose With

- [design/design-system-reasoning](../design-system-reasoning/SKILL.md) for tokens and theme selection.
- [design/prototype-craft](../prototype-craft/SKILL.md) for visual polish and motion recipes.
- [design/accessibility](../accessibility/SKILL.md) for WCAG checklist applied to each route.
- [design/prototype-audit](../prototype-audit/SKILL.md) to run the mechanical 10-pass audit.
- [languages/react](../../languages/react/SKILL.md) and [TypeScript instructions](../../../instructions/typescript.instructions.md) for component-level depth.

## References

- [details-react-prototype-implementation.md](references/details-react-prototype-implementation.md):
  read for the original default stack, scaffold commands, file structure, data
  pattern, debounced localStorage hook, routing example, performance rules,
  built-in accessibility hooks, and verification checklist relocated verbatim
  from the prior root.
