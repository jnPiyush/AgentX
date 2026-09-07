# Design System Reasoning - Execution Detail

> Read this when applying the [design-system-reasoning](../SKILL.md) gate to a specific
> task. Content below is relocated verbatim from the original root to stay
> within the root token budget.

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
