---
name: "brand-spec-extraction"
description: 'Extract and codify a brand specification from user-provided sources (URL, screenshot, PDF, existing app) into a deterministic brand-spec.md artifact. Captures palette, typography, voice, motion, and prohibited patterns so downstream design decisions can be defended against the real brand instead of invented from scratch.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-04"
  updated: "2026-02-04"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer"]
  output-formats: ["markdown"]
---

# Brand Spec Extraction

> WHEN: A user points at an existing brand source -- URL, screenshot, PDF,
> deck, existing app, or Figma export -- and later design work must stay
> anchored to observed evidence instead of invented taste.

## When to Use This Skill

- User says "make it match our website at example.com"
- User attaches a screenshot, deck, PDF, or Figma export of an existing brand
- The product is an extension of an existing app with established UI
- An issue carries `needs:brand-fidelity`

## Prerequisites

You need at least one real brand artifact: stable URL, brand PDF, product
screenshots, deck, or Figma export. If only a verbal description exists, record
that as low confidence and do not lock visual direction or CSS until a source
artifact is captured.

## Decision Guide

Stable live site -> prefer browser capture at desktop, tablet, and mobile
widths. PDF or deck -> extract declared tokens and wording from source pages.
Screenshots only -> sample visible atoms and lower confidence. Conflicting
sources -> prefer the most current authoritative artifact and record the
conflict in the spec.

## Core Rules

- Source authority beats stylistic guesswork.
- Record concrete observations, not mood words, for palette, typography,
  radius, elevation, motion, imagery, and voice.
- Colors must be stored as hex and OKLch.
- Every field carries confidence tied to evidence.
- Prohibited patterns belong in the spec so later anti-slop findings can
  distinguish brand fidelity from generic trends.
- A user correction overrides the observation, but the artifact keeps both.

## Workflow

1. Locate the best available brand source.
2. Capture the source and save or cite it.
3. Extract the minimum visual atoms and convert colors to OKLch.
4. Write the fixed `brand-spec` artifact with sources, tokens, constraints, and
   confidence.
5. Vocalize the summary back before downstream design depends on it.

## Pitfalls

Keep the full fixed template and extraction details in the reference file below.
The common failure is replacing missing evidence with taste words like
"modern" or "premium" instead of preserving confidence and gaps.

## Error Handling

If the artifact is partial or conflicting, mark affected fields medium or low
confidence instead of normalizing them. If live capture is blocked, fall back
to screenshots or PDFs and record the weaker evidence. If no source can be
obtained, do not present the result as authoritative brand guidance.

## Done Criteria

- At least one real source recorded
- Minimum token set captured
- Palette stored as hex and OKLch
- Prohibited patterns listed or explicitly absent
- Confidence reflects evidence
- Downstream steps can cite the spec

## Why This Is a Skill

Without a brand extraction step, models invent tasteful-looking systems that
drift away from the actual brand and then defend those guesses as design
judgement. This skill forces evidence capture first, producing a reusable
contract that later design, content, and audit passes can cite instead of
improvising.

## Related Skills and Assets

- [browser-automation](../../development/browser-automation/SKILL.md) -- for capturing a live URL.
- [design-system-reasoning](../design-system-reasoning/SKILL.md) -- consumes the spec to pick a direction.
- [anti-slop](../anti-slop/SKILL.md) -- consumes the spec to allow brand-authorized patterns.
- [DESIGN-SYSTEM-TEMPLATE.md](../../../templates/DESIGN-SYSTEM-TEMPLATE.md) -- the spec feeds Sections 1-3 and 9.

## References

- [details-five-step-protocol.md](references/details-five-step-protocol.md) --
  read for the original five-step protocol, fixed artifact template,
  cross-reference contract, and self-review.
