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

<!--
Source: 5-step brand-spec extraction protocol adapted from
  alchaincyf/huashu-design's "locate, screenshot, grep, codify, vocalise"
  flow, via nexu-io/open-design (Apache-2.0). See repository NOTICE.
-->

# Brand Spec Extraction

> WHEN: A user references an existing brand (URL, screenshot, deck, PDF,
> app, or "match the look of X"). Run BEFORE picking a visual direction or
> writing any prototype CSS. The output is a single artifact at
> `docs/ux/brand-spec-<issue>.md` that every subsequent design step cites.

A design choice that contradicts the extracted brand-spec must be flagged
as a finding, not silently overridden. The spec is the source of truth.

## When to Use This Skill

- User says "make it match our website at example.com"
- User attaches a screenshot, deck, PDF, or Figma export of an existing brand
- The product is an extension of an existing app with established UI
- An issue carries `needs:brand-fidelity`

## The 5-Step Protocol

### Step 1 - Locate the source

Identify exactly what authoritative artifact the brand lives in. Order of
preference:

1. Live website at a stable URL.
2. Brand-guidelines PDF or deck.
3. Existing app screenshots.
4. Figma file (read-only export if accessible).
5. Verbal description from the user (least reliable -- escalate for an
   artifact before continuing).

Record the URL or filename in the brand-spec under "Sources".

### Step 2 - Capture it

Fetch the source. Recommended methods:

- Live URL: use the browser-automation skill to take screenshots at
  desktop, tablet, and mobile widths. Save under
  `docs/ux/brand-spec-<issue>/sources/`.
- PDF or deck: read with the corresponding plugin (`read-pdf`, `read-slides`).
- App screenshots: ingest as provided.

Each captured asset gets a filename like `home-desktop-2026-02-04.png`.

### Step 3 - Grep the visual atoms

Extract concrete values, not impressions. Use one of:

- DOM inspection on the live URL: read `getComputedStyle` for hero, body,
  primary CTA, secondary CTA. Record `color`, `background-color`,
  `font-family`, `font-size`, `font-weight`, `line-height`, `border-radius`,
  `box-shadow`.
- Screenshot color-pick: sample at least three hero pixels per surface.
- PDF or deck: read declared spec pages.

Convert all colors to OKLch. Record exact hex AND OKLch.

Minimum captured set:

| Field             | Source                           |
|-------------------|----------------------------------|
| Primary text      | body p computed color            |
| Background        | body computed background-color   |
| Primary surface   | header or hero background        |
| Accent            | primary CTA background           |
| Accent on dark    | primary CTA in dark mode if any  |
| Display font      | h1 computed font-family + weight |
| Text font         | body p computed font-family      |
| Mono font         | code computed font-family if any |
| Border radius     | card border-radius               |
| Elevation         | card box-shadow                  |

### Step 4 - Codify into brand-spec.md

Write the artifact at `docs/ux/brand-spec-<issue>.md` with this fixed
structure:

```
# Brand Spec - <project name> (issue #<n>)

## Sources
- <URL or filename> -- captured <date>
- <secondary source> -- captured <date>

## Palette
| Token       | Hex      | OKLch                | Source         |
|-------------|----------|----------------------|----------------|
| --bg        | #...     | oklch(...)           | body bg        |
| --surface   | #...     | oklch(...)           | header bg      |
| --text      | #...     | oklch(...)           | body p color   |
| --muted     | #...     | oklch(...)           | meta text      |
| --accent    | #...     | oklch(...)           | primary CTA bg |
| --on-accent | #...     | oklch(...)           | primary CTA fg |

## Typography
- Display: <family>, <weights>, <observed sizes>
- Text: <family>, <weights>, <observed sizes>
- Mono: <family or "none observed">
- Numeric: tabular vs proportional (observed)

## Radius and Elevation
- Card radius: <px>
- Input radius: <px>
- Elevation level 1: <shadow>
- Elevation level 2: <shadow>

## Motion
- Hover transitions: <duration> <easing> (observed or "none")
- Section reveal: <duration> <easing> (observed or "none")
- prefers-reduced-motion observed: yes/no/unknown

## Voice and Microcopy
- Sentence case vs Title Case observed
- Exclamation marks present: yes/no
- Em-dash density: low/medium/high
- Reading level: scan the home page; record approximate grade level

## Imagery
- Photography: stock / product / mixed / none
- Illustration: present / absent / style notes
- Iconography: deliberate set name / system emoji / none

## Prohibited Patterns
Patterns that violate the observed brand. These become Pass 9 findings.
- E.g. "Brand uses serif headlines; sans-serif headlines are a finding."
- E.g. "Brand uses neutral background; gradient hero is a finding."

## Confidence
- High: directly observed on live source.
- Medium: inferred from one or two artifacts.
- Low: described by user, no artifact captured.

Record one row per field if confidence varies.
```

### Step 5 - Vocalise back to user

Before any design step depends on the spec, post a short summary back to
the user in chat:

```
I read <URL>. I am going to design against:
- Palette: <accent OKLch> on <bg OKLch> with <text OKLch>
- Type: <display family> for display, <text family> for body
- Radius: <px> on cards, <px> on inputs
- Voice: <sentence case / title case>, no exclamation marks
- Prohibited: <one prohibited pattern>

Is this right before I continue?
```

Wait for confirmation or correction. The user's correction overrides the
spec; record both the original observation and the correction in the
artifact under "Corrections".

## Cross-Reference Contract

Downstream skills MUST cite the brand-spec when making decisions:

- `design-system-reasoning` cites the spec when picking a visual direction.
- `prototype-craft` cites the spec when emitting CSS variables.
- `prototype-audit` Pass 9 (anti-slop) cites the spec when classifying a
  pattern as a finding vs an authorized brand element.
- `content-design` cites the spec when writing microcopy.

A design step that proceeds without a brand-spec when the user supplied a
source is itself a finding.

## Self-Review

- [ ] All five steps completed in order, none skipped.
- [ ] At least one source artifact saved under
      `docs/ux/brand-spec-<issue>/sources/`.
- [ ] Palette is in OKLch, not only hex.
- [ ] Confidence column reflects actual evidence per field.
- [ ] Step 5 vocalisation was sent and answered.
- [ ] At least one prohibited pattern is listed (if none, justify).

## References

- `.github/skills/development/browser-automation/SKILL.md` -- for capturing a live URL.
- `.github/skills/design/design-system-reasoning/SKILL.md` -- consumes the spec to pick a direction.
- `.github/skills/design/anti-slop/SKILL.md` -- consumes the spec to allow brand-authorized patterns.
- `.github/templates/DESIGN-SYSTEM-TEMPLATE.md` -- the spec feeds Sections 1-3 and 9.