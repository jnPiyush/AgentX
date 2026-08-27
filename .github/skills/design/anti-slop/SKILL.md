---
name: "anti-slop"
description: 'Identify and prevent AI design slop in generated UI -- forbidden visual tells (purple/teal gradients, generic system emoji, soft pastel everything, fake metrics, hand-drawn cartoon humans, rounded-2xl-everywhere) and enforce honest placeholders. Use after generating any HTML/CSS prototype, marketing surface, or product screen, and as a hard gate inside the prototype-audit Pass 9 (self-critique).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-04"
  updated: "2026-08-27"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue"]
  output-formats: ["markdown"]
---

<!--
Source: Anti-AI-slop blacklist and honest-placeholders rule adapted from
  alchaincyf/huashu-design's "anti-slop checklist", via
  nexu-io/open-design (Apache-2.0). See repository NOTICE.
-->

# Anti-Slop

> WHEN: After any AI-generated UI surface is produced -- prototype, marketing
> page, dashboard, or component library. This skill is a NAMED BLACKLIST plus
> a placeholder-honesty rule. Findings are concrete: each rule cites the
> visible symptom and the corrective replacement.

## When to Use This Skill

- After UX Designer or Engineer agents emit HTML/CSS
- Before declaring a prototype review-ready (Pass 9 of prototype-audit)
- During Reviewer's visual-pass on a UI-bearing PR
- When a user feedback says the UI feels "generic" or "AI-made"

## The Forbidden Tells

These are the patterns that mark a UI as AI-generated. Each is treated as a
P0 finding -- the audit BLOCKS until the tell is removed or an explicit
waiver is recorded with rationale.

### Ownership: delegated vs retained

Five tells now have a deterministic rule in the Impeccable detector, which runs
as Pass 0 of `prototype-audit` before any LLM judgement. T6 is delegated to
Impeccable's judgement-based critique. Four tells stay AgentX-owned because
they concern fabrication and emoji rather than visual style.

| Tell | Owner | Deterministic rule |
|------|-------|--------------------|
| T1 purple-teal-pink gradient | delegated | AI color palette |
| T4 hand-drawn cartoon humans | delegated | Amateurish hand-drawn SVG, Shape-assembled illustration |
| T5 rounded-2xl everything | delegated | Extreme border-radius, Radius outside DESIGN.md |
| T6 glassmorphism on text | delegated judgement | Glassmorphism everywhere |
| T7 aurora background blobs | delegated | Radial halo, Decorative spotlight glow |
| T9 AI-voiced microcopy | delegated | Buzzword, Aphoristic cadence, Em-dash overuse, Theater framing |
| **T2 generic system emoji** | **AgentX** | none upstream |
| **T3 fake metrics and testimonials** | **AgentX** | none upstream |
| **T8 unearned trust badges** | **AgentX** | none upstream |
| **T10 emoji-prefixed headings** | **AgentX** | none upstream |

The delegated descriptions below are retained deliberately. When Pass 0 is
`DEGRADED` the detector did not run, and the full T1-T10 list is the fallback
check. Do not delete them.

### T1. Purple-teal-pink gradient hero

Symptom: hero section uses a linear-gradient with two of {purple, teal,
pink, indigo, fuchsia}. Often paired with white sans-serif headline.

Why it reads as slop: this is the default of every consumer-LLM web
generator from 2023-2025. It signals "I asked an AI for a landing page".

Replacement: pick one accent from the chosen visual direction's palette
and use it on at most one surface element. Background stays neutral.

### T2. Generic system emoji as iconography

Symptom: section cards labeled with the platform emoji set (rocket, sparkles,
bolt, target, checkmark) at large sizes.

Why it reads as slop: emoji rendering varies per OS, scales poorly, and
signals zero icon-system effort.

Replacement: pick a deliberate icon set (Lucide, Phosphor, Tabler, or a
project-specific SVG set) and load only the icons used. Render at the same
stroke weight throughout.

### T3. Fake metrics and invented testimonials

Symptom: "10x faster", "99.99% reliable", "500+ teams", "Trusted by
Fortune 500", or AI-generated quote bubbles with stock-photo avatars and
made-up names.

Why it reads as slop: the numbers are not sourced, the names are not
verifiable, and reviewers correctly assume the entire surface is invented.

Replacement: see Honest Placeholders below. Either cite a real number with
a footnote, or use a labeled grey placeholder (`-- ` or `[metric pending]`)
that signals the value is not yet written.

### T4. Hand-drawn cartoon humans

Symptom: SVG illustrations of smiling people with disproportionate limbs,
floating laptops, or oversized plants. Often pastel.

Why it reads as slop: same illustration library appears in every AI
landing page. Trust-sensitive products (finance, healthcare, legal)
become unsellable on this alone.

Replacement: prefer no illustration over generic illustration. If a
visual is needed, use a screenshot of the actual product, a typographic
treatment, or a deliberate geometric system.

### T5. Rounded-2xl everything

Symptom: every card, button, input, and image uses `rounded-2xl` (16px+).
Layout reads as one giant pillow.

Why it reads as slop: signals "I accepted the Tailwind default for every
element". Indicates no radius scale was chosen.

Replacement: define a radius scale (e.g. `--radius-sm 4`, `--radius 8`,
`--radius-lg 12`, `--radius-pill 9999`) and apply by component class.
Inputs and chips typically take `--radius-sm`; cards take `--radius`;
only pills take `--radius-pill`.

### T6. Glassmorphism on text surfaces

Symptom: `backdrop-filter: blur` with semi-transparent white on body
content. Contrast fails immediately.

Why it reads as slop: aesthetic for the screenshot, unreadable in use.

Replacement: glass effects only on overlays and floating navigation, with
a solid-color fallback via `@supports not (backdrop-filter: blur(1px))`.
Body text NEVER on a glass surface.

### T7. Aurora background blobs

Symptom: large blurred radial gradients in three colors animating slowly
in the background of a hero or dashboard.

Why it reads as slop: same as T1 -- generator default. Plus it fails
`prefers-reduced-motion` if it animates.

Replacement: solid background, or a single static gradient with no motion.

### T8. Trust badges and award rows on a v0 prototype

Symptom: "As featured in" with TechCrunch / Forbes / Y Combinator logos
the product has never been featured in.

Replacement: remove the row entirely until real placements exist.

### T9. AI-voiced microcopy

Symptom: "Welcome aboard!", "Awesome!", "Oops, something went wrong!",
exclamation marks throughout, em-dashes joining every clause, and the
phrase "in seconds" or "with a single click" used multiple times.

Replacement: see `design/content-design/SKILL.md`. Sentence case, no
exclamation marks in production microcopy, errors say what happened and
what to do next.

### T10. Emoji-prefixed section headings in product UI

Symptom: "[sparkle] Features", "[rocket] Pricing", "[chart] Insights".

Replacement: drop the emoji. If a section needs a visual marker, use a
deliberate icon at the same stroke weight as the typography.

## Honest Placeholders Rule

Until real data exists, ALL data in a prototype MUST be visibly
placeholder. Three permitted patterns:

1. **Dashed em-dash**: `--` in the spot where a number will go. Renders as
   "the value is intentionally unset".
2. **Labeled grey block**: a 1-line grey rectangle with the label
   `[metric pending]`, `[user name]`, `[product logo]`.
3. **Real but cited**: an actual value with a footnote like
   `<sup>1</sup>` linking to the source. Sources MUST be reviewable.

NEVER do: invented but plausible numbers, AI-generated names, stock-photo
avatars with random names, "Acme Inc" logos in a customer wall.

Why this matters: a prototype with invented data trains the team and the
stakeholder to read AI-confidence as evidence. Honest placeholders force
the next step (find the real number) instead of skipping it.

## Detection Procedure

For each emitted UI surface, scan in this order:

1. Open the page. Take a screenshot.
2. Check Pass 0 status. If it passed, run only the AgentX-retained tells
   (T2, T3, T8, T10). If it was `DEGRADED`, run the full T1-T10 list --
   nothing deterministic covered them. Each hit is one finding.
3. Run the honest-placeholders check: list every number, name, logo,
   testimonial, avatar, and metric on the page. For each, classify as
   real-and-cited, em-dash, labeled-grey-block, or invented. Each
   invented item is one finding.
4. Sum findings. Zero is required to pass. P0 findings block emit.

Record findings under Pass 9 of the prototype-audit report.

## Waiver Protocol

This protocol is the authoritative waiver path for design findings, including
findings raised by the Impeccable detector. `impeccable ignores` and inline
`impeccable-disable` comments MUST NOT be used as the primary record -- a rule
silenced upstream never reaches the audit report or the reviewer.

A forbidden tell may be retained only when:

- The brand-spec extracted from a real source explicitly mandates it
  (e.g. the company's actual brand uses a purple-pink gradient logo).
- An accessibility check still passes.
- The waiver is recorded in the prototype-audit report with the rule id,
  the rationale, and the citation that authorizes it.

Without those three conditions, the finding stands.

**Where waivers live.** Record them in
`docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md`, not in the target app's
root `DESIGN.md`. Impeccable regenerates that file from code on
`/impeccable document`, so hand-written waivers placed there are silently
lost. The AgentX design-system document from
`.github/templates/DESIGN-SYSTEM-TEMPLATE.md` Section 9 remains the right home
for durable project-level anti-pattern decisions; the two files are distinct
despite the similar name.

An Impeccable ignore may mirror an existing AgentX waiver so repeat scans stay
quiet. When it does, cite the AgentX waiver in its `--reason` string. A rule
that is always waived is a `DESIGN.md` bug -- fix the design language rather
than accumulating ignores.

## Self-Review

Before declaring an anti-slop pass complete:

- [ ] Pass 0 status was checked before deciding which tells to run.
- [ ] The AgentX-retained tells (T2, T3, T8, T10) were checked explicitly.
- [ ] Every number, name, and logo on the page was classified.
- [ ] Findings are recorded with the visible symptom and the replacement.
- [ ] Waivers live in the audit report and cite what authorizes them.
- [ ] No Impeccable ignore exists without a matching AgentX waiver.

## References

- `.github/skills/design/design-system-reasoning/SKILL.md` -- selecting a direction so anti-slop has a positive target to aim at.
- `.github/skills/design/design-system-reasoning/references/visual-directions.md` -- concrete direction palettes to replace defaults.
- `.github/skills/design/content-design/SKILL.md` -- microcopy rules referenced by T9.
- `.github/skills/design/prototype-audit/SKILL.md` -- Pass 9 invokes this skill.
- `.github/skills/design/impeccable-integration/SKILL.md` -- Pass 0 detector that covers the delegated tells.
- `.github/templates/DESIGN-SYSTEM-TEMPLATE.md` Section 9 -- project-specific anti-patterns.
