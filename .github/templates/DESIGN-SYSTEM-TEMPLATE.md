<!-- Inputs: {project_name}, {date}, {primary_direction} -->
<!--
Source: Nine-section DESIGN.md schema adapted from
  VoltAgent/awesome-design-md (https://github.com/VoltAgent/awesome-design-md)
  via nexu-io/open-design (https://github.com/nexu-io/open-design), Apache-2.0.
  See repository NOTICE for full attribution.
-->

# DESIGN.md -- {project_name}

> Portable design system. Single source of truth for visual language across
> prototypes, production UI, and design hand-offs. Consumed by UX Designer,
> Engineer, Reviewer, and prototype-auditor agents.

Date: {date}
Primary direction: {primary_direction}  <!-- one of the five visual directions -->

---

## 1. Brand

State the brand posture in three lines. No marketing copy.

- Voice: <e.g. "calm, technical, evidence-led; no exclamation marks">
- Audience: <e.g. "platform engineers and SRE leads">
- Constraints: <e.g. "must read serious; no playful illustration; WCAG AA">

If a brand-spec is extracted from an external source, link it:
`docs/ux/brand-spec-{id}.md` (see brand-spec-extraction skill).

## 2. Color

Tokens in OKLch where possible; sRGB hex as a fallback. No invented values.

| Token              | Light                  | Dark                   | Usage                    |
|--------------------|------------------------|------------------------|--------------------------|
| `--bg`             | oklch(98% 0.005 250)   | oklch(14% 0.01 250)    | Page background          |
| `--surface`        | oklch(96% 0.008 250)   | oklch(18% 0.012 250)   | Cards, panels            |
| `--text`           | oklch(20% 0.02 260)    | oklch(94% 0.01 250)    | Body text                |
| `--text-muted`     | oklch(48% 0.02 260)    | oklch(70% 0.01 250)    | Secondary text           |
| `--border`         | oklch(88% 0.01 250)    | oklch(28% 0.01 250)    | Hairlines, dividers      |
| `--accent`         | <project value>        | <project value>        | One accent, used sparingly|
| `--focus-ring`     | oklch(60% 0.18 250)    | oklch(70% 0.18 250)    | `:focus-visible` outline |
| `--success`        | oklch(60% 0.15 145)    | oklch(70% 0.15 145)    | Confirm states only      |
| `--warning`        | oklch(72% 0.16 75)     | oklch(78% 0.16 75)     | Caution states only      |
| `--danger`         | oklch(58% 0.20 25)     | oklch(68% 0.20 25)     | Destructive states only  |

Contrast minima: 4.5:1 body, 3:1 large text, 3:1 non-text UI. No exceptions.

## 3. Typography

One display family, one text family, one monospace. No third face.

- Display: <family>, weights <e.g. 600/700>, fallback `ui-sans-serif, system-ui`
- Text:    <family>, weights <e.g. 400/500>, fallback `ui-sans-serif, system-ui`
- Mono:    <family>, weights <e.g. 400/600>, fallback `ui-monospace, SFMono-Regular`

Scale (rem on 16px base):

| Step | Size  | Line   | Use                 |
|------|-------|--------|---------------------|
| -1   | 0.75  | 1.1    | Captions, legal     |
| 0    | 0.875 | 1.45   | UI default          |
| 1    | 1.0   | 1.5    | Body                |
| 2    | 1.25  | 1.4    | H4                  |
| 3    | 1.5   | 1.3    | H3                  |
| 4    | 2.0   | 1.2    | H2                  |
| 5    | 2.75  | 1.15   | H1                  |
| 6    | 3.75  | 1.05   | Display             |

Banned: Inter as a display face when the brand is editorial or warm; system
emoji as iconography; smart quotes mixed with straight quotes in the same doc.

## 4. Spacing

4px base. Tokens: `--space-0..--space-10` = 0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96.
No arbitrary pixel values in component CSS. If you need a new size, add a token.

## 5. Layout

- Grid: 12-column on >=1024, 8-column on 768-1023, 4-column on <768.
- Container max-width: <e.g. 1200px>; gutter: 24px desktop, 16px mobile.
- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- Density: comfortable (default) and compact (data-dense views) -- pick one per surface, never mix.

## 6. Components

For each component, name the variants and the one variant that is the default.
Do not invent variants the product does not need.

| Component   | Variants                                  | Default     | Notes                          |
|-------------|-------------------------------------------|-------------|--------------------------------|
| Button      | primary, secondary, ghost, danger         | primary     | Min height 40px; 44px on touch |
| Input       | text, password, search, number            | text        | Label-above; no placeholder-as-label |
| Card        | flat, outlined                            | outlined    | No drop shadows below `--elevation-1` |
| Dialog      | modal, drawer                             | modal       | Focus trap; ESC closes; backdrop click closes |
| Toast       | info, success, warning, error             | info        | Auto-dismiss only for info/success |

## 7. Motion

- Duration: `--motion-fast 120ms`, `--motion-base 200ms`, `--motion-slow 320ms`.
- Easing: `--ease-standard cubic-bezier(0.2, 0, 0, 1)`.
- Honor `prefers-reduced-motion: reduce` -- set durations to 0.01ms.
- No looping background animations on text surfaces.
- Hover transitions on color/opacity only, not on size.

## 8. Voice and Content

- Sentence case for UI labels and headings (except brand names).
- Numbers: digits for 10+, words for 0-9 unless adjacent to a unit.
- Errors say what happened and what to do next, never "Oops" or "Whoops".
- Empty states have a one-line explanation and a single primary action.
- No exclamation marks in production microcopy.
- Honest placeholders: `--` or a labeled grey block, never invented metrics like "10x faster".

## 9. Anti-Patterns (Project-Specific)

List the things this project must not do. These complement the global
anti-slop checklist in `.github/skills/design/anti-slop/SKILL.md`.

- <e.g. "No purple gradients -- conflicts with serious-platform posture">
- <e.g. "No hand-drawn SVG humans on the marketing surface">
- <e.g. "No rounded-card-with-left-border accents">
- <add as discovered during reviews>

---

## Change Log

| Date       | Author | Change                                         |
|------------|--------|------------------------------------------------|
| {date}     | {who}  | Initial design system                          |
