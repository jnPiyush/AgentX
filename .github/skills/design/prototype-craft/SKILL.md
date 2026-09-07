---
name: prototype-craft
description: 'Craft visually polished, production-quality HTML/CSS prototypes with modern styling, typography, color theory, and micro-interactions. Use when building UX deliverables that need visual polish beyond wireframes, implementing color systems, typography scales, elevation shadows, or smooth transitions for interactive prototypes.'
---
# Prototype Craft

> WHEN: A prototype must look product-grade, not skeletal. Use this skill when
> the concept is clear and the surface needs a coherent visual system,
> component polish, and believable interaction quality.

## When to Use This Skill

- Polishing HTML/CSS prototypes beyond wireframe fidelity
- Building color, type, spacing, elevation, and motion systems for a prototype
- Turning a solid flow into a surface that feels review-ready and product-real
- Choosing visual treatments, component states, and responsive presentation

## Prerequisites

Know the product direction, content honesty rules, and which styling layer owns
the prototype: Tailwind, custom CSS, or both with a clear boundary. Have the
token asset, browser devtools, and accessibility guardrails available before
adding polish.

## Decision Guide

If the work is still wireframing, use `ux-ui-design` first. If the challenge is
semantic structure, accessibility, or raw layout mechanics, compose with
`frontend-ui` and `accessibility`. Use this skill when the structure is sound
but the prototype still needs a coherent visual language, believable component
states, or motion restraint. If a brand reference exists, run
`brand-spec-extraction` before inventing a palette. If the request is review,
hand off to `prototype-audit` or `anti-slop`.

## Core Rules

- Build one coherent visual system before styling isolated components.
- Keep color, type, spacing, radius, and shadow on a shared token scale.
- Use modern CSS deliberately: Grid, Flexbox, custom properties, and fluid
  sizing where they simplify the prototype.
- Design hover, active, focus, loading, empty, error, and success states as
  first-class surfaces.
- Motion should clarify hierarchy, not create noise; short transitions and
  reduced-motion safety are the default.
- Polish must not break accessibility, responsiveness, or content honesty.

## Workflow

1. Establish the visual direction, honest sample content, and token baseline.
2. Define palette, typography, spacing, radius, and elevation before touching
   component one-offs.
3. Choose the page archetype and map its primary components, states, and
   responsive behavior.
4. Implement the surface with either Tailwind utilities or a clean CSS token
   stack; avoid framework drift.
5. Add restrained motion, hover, active, and focus behavior.
6. Validate contrast, responsiveness, state coverage, and composition quality;
   then hand off to `prototype-audit`.

## Pitfalls

Common failures are placeholder-heavy screens, missing states, flashy effects
without hierarchy, fixed widths, weak contrast, and controls that look static
until hovered. Review the detailed anti-patterns and motion recipes before
patching symptoms.

## Error Handling

If the prototype looks generic, revisit the design system before adding more
effects. If contrast fails, fix the tokens first. If Tailwind CDN setup is not
appropriate, fall back to CSS custom properties instead of mixing approaches.
If animation makes the surface feel noisy, reduce motion or disable it under
`prefers-reduced-motion`.

## Checklist

- A clear visual direction or brand reference exists.
- Tokens for color, type, spacing, and elevation are defined or imported.
- Primary components include hover, active, focus, loading, empty, error, and
  success states.
- Motion is purposeful and safe under reduced-motion settings.
- Responsive behavior holds across the target breakpoints.
- The result is ready for `prototype-audit`, not just visually attractive.

## Why This Is a Skill

General UI generation often produces either generic SaaS chrome or decorative
noise with no system underneath. This skill forces agents to make explicit
craft decisions about tokens, hierarchy, component states, and motion so the
prototype feels intentional, believable, and ready for audit.

## Assets

- [assets/prototype-tokens.css](assets/prototype-tokens.css) - Production-ready CSS custom properties for spacing, typography scale, Apple-style elevation, and Stripe-style precision. Use this file as a foundation for HTML prototypes to ensure consistency.

## Related Links

- [Anti-Slop Skill](../anti-slop/SKILL.md) -- forbidden visual tells (T1-T10) and honest-placeholder rules. Load alongside this skill when crafting prototypes.
- [Brand Spec Extraction](../brand-spec-extraction/SKILL.md) -- protocol for extracting a brand spec from a referenced site or screenshot before crafting.
- [Design System Reasoning](../design-system-reasoning/SKILL.md) -- posture and archetype framework
- [UX/UI Design Skill](../ux-ui-design/SKILL.md) -- methodology and research
- [Frontend/UI Skill](../frontend-ui/SKILL.md) -- semantic HTML, accessibility patterns
- [Accessibility](../accessibility/SKILL.md) -- WCAG AA release gates
- [Prototype Audit](../prototype-audit/SKILL.md) -- final multi-pass review

## References

- [details-visual-foundations.md](references/details-visual-foundations.md):
  read for the original craft rules, color, type, shadow, transition, and CSS.
- [details-layout-and-patterns.md](references/details-layout-and-patterns.md):
  read for the original responsive strategy, file structure, decision tree,
  component patterns, and anti-patterns.
- [animation-recipes.md](references/animation-recipes.md): read when tuning
  motion patterns and interaction choreography.
- `assets/prototype-tokens.css`: read when you need a ready-made token base.
