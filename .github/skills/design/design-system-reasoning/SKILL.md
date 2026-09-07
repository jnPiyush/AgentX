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

> WHEN: Choose a UI direction before coding -- especially when the product is
> vague, the domain is risk-sensitive, or the same intent must survive across
> multiple stacks.

## When to Use This Skill

- Turning a product description into a usable UI direction
- Deciding which page archetype fits a product or feature
- Choosing a restrained visual language before coding begins
- Defining token guidance for color, typography, spacing, and motion
- Documenting anti-patterns for regulated, trust-sensitive, or data-heavy
  products
- Translating the same design intent across Tailwind, React, Vue, SwiftUI,
  Flutter, or plain HTML/CSS
- Reviewing whether a proposed UI direction matches audience expectations

## Prerequisites

Start with a brief that names product type, audience, platform, task, and
constraints. If the user referenced an existing brand, extract the brand spec
first. If the screen already exists, capture representative states so the
direction is anchored in real workflow, not only aspiration.

## Decision Guide

Vague product or greenfield feature -> choose posture and dominant archetype
before talking about color. Trust-sensitive or regulated flow -> define trust
cues and anti-patterns before style. Multi-stack delivery -> lock design intent
and token behavior first, then translate per platform. Existing UI "feels off"
-> critique tone, hierarchy, density, motion, and trust fit instead of asking
for generic modernization.

## Core Rules

- Product posture comes before aesthetics.
- Page archetype comes before palette or type.
- Tokens and behavior come before component decoration.
- Anti-patterns are first-class output, especially in regulated or
  trust-sensitive domains.
- Decorative intensity must serve the task rather than compete with it.
- Stack translation preserves intent, hierarchy, density, and interaction
  semantics, not literal classes.
- A direction is incomplete until it includes review criteria and
  implementation guidance.

## Workflow

1. Compress the brief into product, audience, job, platform, and constraints.
2. Choose one primary posture and one dominant page archetype.
3. Define visual language adjectives plus token guidance for color, type,
   spacing, radius, depth, and motion.
4. List the UI primitives, trust cues, and anti-patterns that matter most.
5. Translate the direction into stack-aware notes and review it against the
   critique rubric before handoff.

## Pitfalls

Use the detail files below for the full posture, archetype, token, critique,
and translation material. The common failure is skipping straight to style
trends before deciding what the product must feel like and what it must never
do.

## Error Handling

If the brief is vague, fill the design brief template first and delay style
calls. If two directions seem plausible, keep the safer one as default and
document the alternate as a contrast option. If platform constraints diverge,
preserve the system intent and simplify the implementation rather than forking
the design language into unrelated UIs.

## Checklist

- Product posture chosen
- Dominant page archetype chosen
- Visual language reduced to a few adjectives
- Token guidance defined
- Domain anti-patterns documented
- Stack translation notes included
- Critique rubric or review criteria attached

## Why This Is a Skill

General model output jumps from a prompt to a look. That creates attractive but
weakly justified systems that collapse under review, reuse, or cross-platform
translation. This skill forces a reasoning layer between brief and UI so
direction, tokens, anti-patterns, and review criteria are explicit and
defensible.

## Related Skills and Assets

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

## References

- [details-foundation.md](references/details-foundation.md) -- read for the
  original quick reference, decision tree, posture model, archetypes, and
  direction output contract.
- [details-execution.md](references/details-execution.md) -- read for the
  original workflow steps, token framework, filters, presets, stack
  translation, critique rubric, error handling, and checklist.
