# UX Spec: AgentX Marketing Landing Page

> Modeled on the structural pattern of [workpilot.newfuture.cc](https://workpilot.newfuture.cc/), adapted to AgentX's actual product story.
> Prototype: [docs/ux/prototypes/landing/index.html](prototypes/landing/index.html)

## Overview

A single-page marketing site that explains what AgentX is, why its discipline matters, what it can do, who the agents are, and how to install it. Goal: get a curious developer from "I clicked a link" to "I ran the install command" in under 60 seconds.

## User Research

- **Primary persona**: Senior developer or eng manager evaluating AI dev tooling. Skeptical of "vibe-coded" agents. Cares about coverage gates, review quality, and not losing audit trails.
- **Secondary persona**: AI-curious developer who already uses Copilot or Claude Code and wants more structure than ad-hoc chat.
- **Top jobs to be done**:
  1. Quickly understand the product category ("multi-agent SDLC framework", not "another autocomplete").
  2. See proof of discipline (loop, gates, reviews) before committing time.
  3. Find the install command and run it.

## Design Research (Competitive Audit)

| Site | Pattern Borrowed | Why |
|------|------------------|-----|
| workpilot.newfuture.cc | Five-section flow: Security -> Features -> Ecosystem -> Install -> CTA | Same pattern fits any "self-hosted, security-conscious AI assistant" pitch. |
| linear.app | Type scale, gradient accents on dark background | Establishes a high-craft baseline expected of dev-tooling sites in 2025. |
| anthropic.com / claude.ai docs | Sober, technical body copy; chip-row of features | Avoids overpromising. Engineers respond to specifics, not adjectives. |

**Patterns selected**:

- Sticky condensed nav with anchor links (industry standard, removes friction).
- Hero with single primary CTA + GitHub secondary; powered-by chip row (provides social proof without testimonials).
- Bento-style capabilities grid with one tall "demo" card -- gives weight to a single proof artifact instead of four equal cards.
- Tabbed install block (PowerShell / Bash / Local / Profiles) with a copy button per tab.

**Patterns rejected**:

- Carousel/slideshow features (research: low engagement, accessibility tax).
- Animated background video (network cost, distraction, fails reduced-motion).

## User Flows

```
Land on Hero
  -> read tagline + sub
    -> click "Install" (CTA)         -> jump to #install
    -> click "GitHub"                -> external repo
    -> scroll
       -> Discipline section         -> click "Golden Principles" link
       -> Capabilities section       -> read demo terminal
       -> Agents grid                 -> identify the role they care about
       -> Install                     -> pick OS tab, click copy, paste in terminal
       -> Final CTA                   -> reinforces install
```

Error / fallback states:
- Clipboard API unavailable -> copy button shows "press Ctrl+C" hint.
- JavaScript disabled -> tabs degrade to first tab visible (PowerShell), all anchor links still work.
- Reduced motion -> no hover-translate; no scroll smoothing.

## Wireframes (Mid-Fi)

Implemented directly in the prototype. Sections in order:

1. **Sticky nav** (logo, anchor links, GitHub, primary CTA).
2. **Hero** (chip with version, H1 with gradient accent, sub, two CTAs, powered-by chips, terminal preview card).
3. **Discipline** (4 gate cards + chip row of additional gates).
4. **Capabilities** (bento: 1 tall live-demo + 4 equal cards).
5. **Agents** (12-card grid: 11 visible roles + "+9 internal").
6. **Install** (tab block + first-five-minutes sidecard).
7. **Final CTA** (gradient-bordered card).
8. **Footer** (logo, version, links).

## Component Specifications

| Component | Variants | States |
|-----------|----------|--------|
| Button -- primary | Hero, Install, CTA | default, hover (slight lift + brightness), active, focus-visible (cyan ring), disabled |
| Button -- ghost | Nav, secondary CTAs | default, hover (border -> cyan), focus-visible |
| Card | Discipline, Capability, Agent | default, hover (border -> cyan/35) |
| Chip | Powered-by, gates row, version | default; with optional cyan dot for "live" |
| Tab | Install OS picker | default, active (cyan tint + border) |
| Code block | Hero terminal, Install, Capability demo | with copy button (idle / copied / fallback) |

## Design System

- **Grid**: 12-col responsive, max-width 1280px (`max-w-7xl`), 24px gutter.
- **Typography**: Inter (body) + JetBrains Mono (code). H1 uses `clamp(2.4rem, 6vw, 5.5rem)`.
- **Color tokens** (CSS variables effectively, expressed via Tailwind `theme.extend`):
  - Background: `#070912` with cyan + violet radial mesh.
  - Surface: `#111728` cards over `rgba(255,255,255,0.04)` glass.
  - Accent: cyan `#22d3ee` -> violet `#a855f7` gradient.
  - Text: white headlines, `slate-300/400` body, `slate-500` muted.
- **Spacing**: 8-point scale (Tailwind defaults).
- **Elevation**: low-noise; cards use border + soft inner highlight, no heavy drop shadows.

## Interactions & Animations

- All transitions <= 200ms.
- Hover lift on primary buttons: `translateY(-1px)` + filter brightness.
- Tab switch: instant pane swap (no fade -- avoids flicker on slow render).
- Smooth scroll for anchor links; disabled under `prefers-reduced-motion`.

## Accessibility (WCAG 2.1 AA)

- Semantic landmarks: `<header>`, `<nav aria-label="Primary">`, `<section>` x6, `<footer>`.
- Heading hierarchy: one H1, then H2 per section, H3 for card titles.
- Color contrast verified for body text (`slate-300` on `#070912`) and chips.
- Focus-visible: 2px cyan outline with 3px offset on every interactive element.
- All decorative SVGs have `aria-hidden="true"`; functional buttons have visible labels.
- Reduced-motion media query disables transforms and smooth scroll.
- Tab UI uses real `<button>` elements; install panes are `hidden`-toggled (screen readers ignore hidden panes).
- No reliance on color alone -- gates use `[PASS]` / `[FAIL]` tokens, not green/red squares.

## Responsive Design

- Mobile (<640px): single-column stacks; nav links collapse out of view (logo + GitHub + Get-started remain).
- Tablet (640-1024px): 2-column card grids.
- Desktop (>=1024px): 4-column for Discipline and Agents; 3-column bento for Capabilities; install block uses 1fr + 360px sidecard.
- Hero terminal preview gracefully reflows to single column on small screens.

## Interactive Prototype

Self-contained HTML at `docs/ux/prototypes/landing/index.html`. No build step. Tailwind via CDN, JetBrains Mono + Inter via Google Fonts. Open in any modern browser.

## Implementation Notes (for Engineer)

- The prototype is presentation-only; no analytics, no telemetry.
- For production: replace Tailwind CDN with a built CSS bundle (Tailwind CLI or PostCSS) for performance and CSP.
- Replace fictional version chip (`v8.4.36`) with a build-time inject from `version.json`.
- The "Powered by" chip names model versions for marketing flavor; sync with whatever AgentX actually defaults to at release time.
- Every link to repo docs (`docs/GUIDE.md`, `docs/WORKFLOW.md`, etc.) currently uses repo-relative paths; rewrite to absolute `https://github.com/jnPiyush/AgentX/blob/master/docs/...` when hosted standalone.
- Replace `https://github.com/jnPiyush/AgentX` placeholders with the canonical repo URL if it changes.

## Open Questions

1. Hosting target: GitHub Pages from `docs/ux/prototypes/landing/`, or a dedicated subdomain?
2. Do we want a "Demo" or "Playground" tab that links to a Codespaces template?
3. Should we add a testimonials / used-by row, or keep it intentionally minimal until we have real signal?

## References

- Reference site: https://workpilot.newfuture.cc/
- AgentX guide: [docs/GUIDE.md](../GUIDE.md)
- Workflow reference: [docs/WORKFLOW.md](../WORKFLOW.md)
- Quality score: [docs/QUALITY_SCORE.md](../QUALITY_SCORE.md)
- Skills index: [Skills.md](../../Skills.md)
