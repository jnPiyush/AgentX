<!--
Source: Visual-direction starter set distilled from the "five schools,
twenty design philosophies" framing in alchaincyf/huashu-design, via
nexu-io/open-design (Apache-2.0). See repository NOTICE.
-->

# Visual Directions Reference

> Deterministic starter set of five visual directions. UX Designer and
> Engineer agents pick exactly one direction per project unless the brief
> explicitly requires a hybrid. Each entry is concrete enough to drive
> token decisions without freestyling.

A direction is "wrong" when (a) audience expectation is violated (e.g.
Brutalist for a bank), (b) accessibility cannot be met within the
direction, or (c) the direction collides with extracted brand-spec.
Record the rationale when you reject a direction.

---

## D1. Editorial Monocle

When to use: long-form, content-led, trust-anchored surfaces. Publications,
research portals, policy sites, doc-heavy SaaS landing pages.

Posture: serious, literate, generous whitespace, restrained color.

Palette (OKLch):

| Token       | Light                | Dark                 |
|-------------|----------------------|----------------------|
| `--bg`      | oklch(98% 0.005 80)  | oklch(16% 0.01 80)   |
| `--surface` | oklch(95% 0.01 80)   | oklch(20% 0.012 80)  |
| `--text`    | oklch(18% 0.02 80)   | oklch(92% 0.01 80)   |
| `--muted`   | oklch(48% 0.02 80)   | oklch(68% 0.01 80)   |
| `--accent`  | oklch(40% 0.12 30)   | oklch(70% 0.14 30)   |

Type: serif display (e.g. Source Serif, Newsreader, Fraunces) + neutral
text sans (e.g. Inter Tight, Geist). Mono for inline code only.

Cues: column-based layout; rules and small caps over color; figures
captioned; hover states are subtle weight or color shifts, not motion.

Avoid: gradients, neon accents, oversized hero illustration, emoji icons.

---

## D2. Modern Minimal

When to use: SaaS product UI, dashboards, settings, B2B applications where
the content is the product and chrome must recede.

Posture: calm, efficient, neutral-first, accent used once per screen.

Palette (OKLch):

| Token       | Light                | Dark                 |
|-------------|----------------------|----------------------|
| `--bg`      | oklch(99% 0.003 250) | oklch(14% 0.008 250) |
| `--surface` | oklch(97% 0.005 250) | oklch(18% 0.01 250)  |
| `--text`    | oklch(20% 0.015 260) | oklch(94% 0.008 250) |
| `--muted`   | oklch(50% 0.015 260) | oklch(70% 0.008 250) |
| `--accent`  | oklch(58% 0.16 250)  | oklch(72% 0.16 250)  |

Type: one geometric sans (e.g. Inter, Geist, IBM Plex Sans) at 400/500/600.
No display face.

Cues: 8px grid; outlined cards; 1px hairlines; status colors used only on
status surfaces; primary CTA is the only filled element on a screen.

Avoid: drop shadows above `--elevation-1`; gradient buttons; secondary
buttons styled as filled.

---

## D3. Tech Utility

When to use: developer tools, IaC consoles, observability, terminals,
prompt workbenches.

Posture: dense, monospace-forward, dark-by-default, signal over chrome.

Palette (OKLch):

| Token       | Light                | Dark                 |
|-------------|----------------------|----------------------|
| `--bg`      | oklch(96% 0.005 220) | oklch(12% 0.01 220)  |
| `--surface` | oklch(93% 0.008 220) | oklch(16% 0.012 220) |
| `--text`    | oklch(22% 0.02 220)  | oklch(92% 0.01 220)  |
| `--muted`   | oklch(50% 0.02 220)  | oklch(68% 0.012 220) |
| `--accent`  | oklch(70% 0.18 145)  | oklch(78% 0.18 145)  |

Type: mono for data and identifiers (e.g. JetBrains Mono, Geist Mono);
neutral sans for chrome (e.g. Inter). Display face is the mono.

Cues: monospaced numeric columns; tabular figures (`font-variant-numeric:
tabular-nums`); keyboard-shortcut hints visible; status chips small and
square; charts use one accent + grey scale, never rainbows.

Avoid: pastel palettes; rounded-2xl on data tables; emoji as status icons.

---

## D4. Brutalist

When to use: editorial portfolio, creative-studio site, internal-tool
manifesto pages, and only when the audience expects character. NEVER for
financial, healthcare, or compliance surfaces.

Posture: opinionated, high contrast, raw, deliberate "designed-ness".

Palette (OKLch):

| Token       | Light                | Dark                 |
|-------------|----------------------|----------------------|
| `--bg`      | oklch(98% 0.005 90)  | oklch(10% 0.01 250)  |
| `--surface` | oklch(96% 0.01 90)   | oklch(14% 0.012 250) |
| `--text`    | oklch(10% 0.02 90)   | oklch(96% 0.01 90)   |
| `--accent`  | oklch(68% 0.22 30)   | oklch(72% 0.22 30)   |

Type: one strong display (e.g. Space Grotesk, PP Neue Montreal, Sohne) +
mono for captions.

Cues: thick borders (2-3px) replacing shadows; oversized type; left-aligned;
limited animation; explicit grid lines visible.

Avoid: gradient washes; glassmorphism; soft pastels; rounded-3xl chips.

---

## D5. Soft Warm

When to use: consumer wellness, education, community products, surfaces
where warmth is the brand promise.

Posture: friendly, warm, inviting, gentle motion.

Palette (OKLch):

| Token       | Light                | Dark                 |
|-------------|----------------------|----------------------|
| `--bg`      | oklch(98% 0.012 60)  | oklch(20% 0.015 50)  |
| `--surface` | oklch(95% 0.018 55)  | oklch(24% 0.02 50)   |
| `--text`    | oklch(22% 0.03 40)   | oklch(94% 0.015 60)  |
| `--muted`   | oklch(50% 0.03 40)   | oklch(72% 0.015 60)  |
| `--accent`  | oklch(70% 0.16 40)   | oklch(76% 0.16 40)   |

Type: humanist sans or rounded sans (e.g. Nunito, Plus Jakarta Sans, DM
Sans). Optional friendly serif for headings (e.g. Fraunces with soft axis).

Cues: 16-24px radii; warm off-white surfaces; soft elevation; motion uses
spring easing; illustration uses simple geometric, never AI-generated
hand-drawn humans.

Avoid: stock photography of laughing people; purple/teal gradients; system
emoji as iconography.

---

## Selection Rubric

For a given brief, score each direction 1-5 on:

1. Audience fit (will the target audience expect this?)
2. Content fit (does the direction support the dominant content type?)
3. Constraint fit (regulated? dense data? mobile-first?)
4. Brand fit (does it agree with the extracted brand-spec?)
5. Accessibility headroom (can WCAG AA be hit without fighting the direction?)

Pick the highest scorer. If two tie, pick the more restrained one. Record
the score in the design log so the choice can be defended in review.
