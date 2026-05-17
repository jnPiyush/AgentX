---
name: "design-system-reasoning"
description: 'Synthesize product context into a coherent UI direction with page archetypes, visual language, token guidance, anti-pattern filters, and stack-aware translation. Use when choosing a design style, defining a design brief, aligning UI choices to industry expectations, or reviewing whether a UI direction fits the product before implementation.'
metadata:
 author: "AgentX"
 version: "1.1.0"
 created: "2026-03-12"
 updated: "2026-03-12"
compatibility:
 agents: ["agent-x", "ux-designer", "architect", "engineer"]
 frameworks: ["html-css", "tailwind", "react", "vue", "swiftui", "flutter"]
 output-formats: ["markdown", "html", "css", "json"]
---

# Design System Reasoning

> WHEN: Choosing UI direction, selecting a visual language, defining design tokens, filtering anti-patterns, or turning a vague product brief into a design-system-ready implementation plan.

## When to Use This Skill

- Turning a product description into a usable UI direction
- Deciding which page archetype fits a product or feature
- Choosing a restrained visual language before coding begins
- Defining token guidance for color, typography, spacing, and motion
- Documenting anti-patterns for regulated, trust-sensitive, or data-heavy products
- Translating the same design intent across Tailwind, React, Vue, SwiftUI, Flutter, or plain HTML/CSS
- Reviewing whether a proposed UI direction matches audience expectations

## Quick Reference

| Need | Use |
|------|-----|
| Product is vague | Fill the design brief template first |
| Screen structure is unclear | Choose a page archetype before styling |
| Domain risk is high | Define anti-patterns and trust cues first |
| UI feels trendy but wrong | Re-check posture, density, and trust fit |
| Multi-stack delivery | Preserve intent, then translate per stack |

## Decision Tree

```
Need UI direction, not just polished screens?
|
+-- Product is vague or early-stage?
|   -> Create a design brief first
|
+-- Marketing / landing page?
|   -> Pick a page archetype before colors or typography
|
+-- Dashboard / admin / analytics?
|   -> Start from information density, hierarchy, and task frequency
|
+-- Regulated / trust-sensitive domain?
|   -> Define anti-patterns and confidence cues before visual style
|
+-- Multi-platform delivery?
|   -> Lock design intent, then translate to each stack separately
|
- Existing UI feels off but not obviously broken?
    -> Run the critique rubric and identify mismatch: tone, hierarchy, density, motion, or trust
```

## Core Rules

1. **Choose the product posture first** - classify the experience as trust-led, workflow-led, exploration-led, emotion-led, or utility-led before picking a style.
2. **Select page archetypes before aesthetics** - decide whether the screen is proof-led, conversion-led, workflow-led, editorial, or operational before picking colors or effects.
3. **Write anti-patterns explicitly** - every design brief MUST include what the UI must avoid for that domain, not only what it should include.
4. **Tokens before components** - define color, type, spacing, radius, shadow, and motion rules before expanding into component examples.
5. **Constrain visual intensity** - decorative effects must support the product goal; if the interface competes with the task, reduce it.
6. **Translate intent, not literal classes** - when switching stacks, preserve hierarchy, density, and interaction semantics rather than copying markup patterns.

## Product Posture Model

Use one primary posture and one secondary posture.

| Posture | Best Fit | Prioritize | Avoid |
|---------|----------|------------|-------|
| Trust-led | Finance, healthcare, legal, identity, admin | clarity, stability, confidence, auditability | novelty-heavy styling, ambiguous CTA hierarchy |
| Workflow-led | B2B tools, devtools, operations, internal platforms | density, task flow, keyboard support, status clarity | oversized hero sections, decorative motion |
| Exploration-led | analytics, discovery, content browsing, marketplaces | progressive disclosure, filtering, comparison | rigid single-path flows |
| Emotion-led | wellness, lifestyle, luxury, hospitality, creative brands | mood, pacing, imagery, warmth, storytelling | cold enterprise grids and harsh contrast |
| Utility-led | mobile utilities, quick forms, booking, support | speed, defaults, reachability, obvious next actions | ornamental complexity |

## Page Archetypes

Pick the dominant archetype per screen.

| Archetype | Use For | Structure | Success Signal |
|-----------|---------|-----------|----------------|
| Proof-led Landing | services, agencies, B2B trust pages | hero -> proof -> offering -> CTA | reduced hesitation |
| Workflow Demo | SaaS, productivity, AI tools | hero -> use case -> product detail -> CTA | user understands the loop |
| Editorial Story | brand, mission, launch, nonprofit | narrative sections with pacing changes | emotional clarity |
| Operations Surface | admin, monitoring, analytics | filters -> summary -> detail -> action | faster task completion |
| Guided Utility | booking, onboarding, quote, checkout | progress -> step -> validation -> resolution | fewer drop-offs |
| Comparison Grid | pricing, marketplaces, feature evaluation | filters -> cards/table -> proof -> next action | easier side-by-side choice |

## Direction Output Contract

Every design-direction output SHOULD include:

1. Product posture and intended user confidence level
2. Primary page archetype and why it fits
3. Visual language adjectives: 3-5 words only
4. Token guidance: color family, type pairing style, spacing rhythm, radius, shadow, motion
5. Component priorities: the 5-7 UI primitives that must feel most intentional
6. Anti-patterns: 3-7 domain-specific moves to avoid
7. Review rubric: how to decide whether the output is on-track

## Workflow Steps

1. Compress the brief into product type, audience, job, platform, and constraints.
2. Choose one primary posture and one dominant page archetype.
3. Define visual language adjectives and token guidance.
4. List component priorities and domain anti-patterns.
5. Translate the direction into stack-aware implementation notes.
6. Review the output against the critique rubric before handoff.

## Token Guidance Framework

Define tokens in ranges and behaviors, not only raw values.

| Token Group | Decide | Questions |
|-------------|--------|-----------|
| Color | contrast model, accent intensity, semantic clarity | Is the accent persuasive, calming, or instructional? |
| Typography | voice, density, scan speed | Does the product need warmth, authority, or precision? |
| Spacing | breathing room vs throughput | Does the interface reward focus or speed? |
| Radius | severity of edges | Should the UI feel institutional, neutral, or friendly? |
| Shadow | depth strategy | Should elevation signal hierarchy, tactility, or almost none? |
| Motion | interaction tone | Should motion confirm actions, guide attention, or stay nearly invisible? |

## Anti-Pattern Filters

Common domain filters to apply before implementation:

| Context | Avoid |
|---------|-------|
| Finance / security | neon accents, vague trust signals, playful error states, overly futuristic marketing polish |
| Healthcare / public service | low contrast, hidden instructions, tiny targets, novelty-first interactions |
| Devtools / admin | marketing-first layouts, oversized cards, sparse density, delayed feedback |
| AI products | generic cosmic gradients, unclear confidence states, fake human tone, unexplained automation |
| Wellness / premium lifestyle | noisy tables, harsh transitions, heavy data chrome, robotic microcopy |
| Marketplaces / pricing | inconsistent comparison structure, CTA overload, mismatched card heights |

## Industry Preset Use

Use presets as starting constraints, not as templates to copy verbatim.

| If the product is... | Start with... |
|---------------------|---------------|
| fintech, legal, security, identity | trust-led + proof-led or guided utility |
| SaaS, devtools, internal operations | workflow-led + workflow demo or operations surface |
| analytics, BI, marketplaces | exploration-led + operations surface or comparison grid |
| wellness, hospitality, premium consumer | emotion-led + editorial story or proof-led landing |
| booking, checkout, support, quick actions | utility-led + guided utility |

Then adjust color intensity, density, motion, and proof strategy for the real audience.

## Stack Translation

Keep the design intent stable while adapting implementation style.

| Stack | Translate Into |
|-------|----------------|
| HTML + Tailwind | utility-first tokens, semantic structure, component class recipes |
| React + component library | prop-driven variants, tokenized theme, state-rich components |
| Vue / Nuxt | composable layout shells, scoped tokens, interaction states in templates |
| SwiftUI | view modifiers, semantic spacing, motion via lightweight transitions |
| Flutter | theme data, component tokens, state surfaces, density-aware widgets |
| Plain CSS | variables, layout primitives, reusable component classes |

## Critique Rubric

Use this when reviewing a proposed direction:

- **Tone fit**: does the UI feel appropriate for the domain and audience?
- **Hierarchy fit**: is the most important action unmistakable?
- **Density fit**: does information density match user task frequency?
- **Trust fit**: are confidence cues visible where risk is high?
- **Motion fit**: does motion guide without distracting?
- **System fit**: do tokens and components feel like one family?

## Review Checklist

Run this before implementation handoff or final critique:

- **Intent**: can one sentence explain the posture and archetype without using style buzzwords?
- **Action clarity**: is the primary action obvious within the first viewport or first task area?
- **Density match**: does the spacing model fit how often the user performs the task?
- **Trust cues**: are proof, validation, status, privacy, or safety cues near the risky decisions?
- **State coverage**: are empty, loading, partial, success, and error states implied or documented?
- **Token consistency**: do type, spacing, radius, depth, and motion point in the same direction?
- **Platform translation**: does the stack guidance preserve intent rather than just naming components?
- **Anti-pattern defense**: is there a documented reason not to use the most tempting but wrong trend?

## Error Handling

| Issue | Response |
|-------|----------|
| Brief is too vague | Fill the design brief template, then choose only one primary posture and one archetype |
| Two styles feel equally plausible | Keep the safer one as default and document the alternate as a contrast option |
| Team wants a trend-heavy direction | Translate the trend into constraints and anti-patterns before implementation |
| Stakeholders want "modern" but disagree on meaning | Convert the request into adjectives, density, motion, and contrast decisions |
| Platform support differs | Preserve the system intent, then simplify interaction affordances per platform |

## Checklist

- [ ] Primary product posture chosen
- [ ] Dominant page archetype chosen
- [ ] Visual language reduced to 3-5 adjectives
- [ ] Token guidance defined for color, type, spacing, radius, shadow, and motion
- [ ] Domain anti-patterns documented
- [ ] Stack translation notes included
- [ ] Review rubric attached

## References

- [Visual Directions Starter Set](references/visual-directions.md) -- five seeded design directions (D1-D5) with OKLch palettes, font stacks, and a 5-axis selection rubric. Use when proposing or comparing visual directions.
- [Design System Template](../../../templates/DESIGN-SYSTEM-TEMPLATE.md) -- 9-section schema (Brand, Color, Typography, Spacing, Layout, Components, Motion, Voice and Content, Anti-Patterns) for codifying the chosen direction into a project design system.
- [Anti-Slop Skill](../anti-slop/SKILL.md) -- forbidden tells and honest-placeholder rules; load before emitting any UI.
- [Brand Spec Extraction](../brand-spec-extraction/SKILL.md) -- protocol to derive a brand spec from a referenced URL or screenshot.
- [Design Direction Playbook](references/design-direction-playbook.md)
- [Industry Presets](references/industry-presets.md)
- [Design Brief Template](assets/design-brief-template.md)
- [Design Review Scorecard](assets/design-review-scorecard.md)
- [UX/UI Design](../ux-ui-design/SKILL.md)
- [Prototype Craft](../prototype-craft/SKILL.md)
- [Frontend/UI Development](../frontend-ui/SKILL.md)