# Design System Reasoning - Foundation Detail

> Read this when applying the [design-system-reasoning](../SKILL.md) gate to a specific
> task. Content below is relocated verbatim from the original root to stay
> within the root token budget.

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
