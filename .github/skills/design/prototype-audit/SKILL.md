---
name: "prototype-audit"
description: 'Mechanically audit a UX prototype or front-end build through ten self-healing passes -- deterministic design-language conformance, accessibility, performance, content, responsive layout, routes, build hygiene, usability heuristics, visual regression, and anti-slop critique. Use before declaring any prototype review-ready, or whenever the prototype-auditor sub-agent is invoked. Each pass follows check -> diagnose -> fix -> verify with a maximum of three fix cycles per pass before escalating.'
metadata:
   author: "AgentX"
   version: "1.0.0"
   created: "2026-05-12"
   updated: "2026-08-27"
compatibility:
  agents: ["ux-designer", "reviewer", "prototype-auditor", "engineer"]
  frameworks: ["html-css", "react", "vue", "tailwind"]
  output-formats: ["markdown"]
---

# Prototype Audit

> WHEN: A UX prototype (static HTML or working SPA) is about to be reviewed, demoed, or shipped to stakeholders. This skill is the mechanical procedure the `prototype-auditor` internal sub-agent runs. The output is a structured report at `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md`.

## Inputs

- Prototype root directory (static HTML folder or SPA `dist/`).
- A live preview URL or a pinned project-local preview server over the build
   output (for example, `npm exec --offline -- serve`).
- Issue number for the report filename.
- The `accessibility/SKILL.md` checklist as ground truth for Pass 1.
- `DESIGN.md` and the project-local Impeccable detector for Pass 0, when present.

## Output

`docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` with one section per pass:

```markdown
## Pass <N>: <Name>
- Status: PASS | FIXED | BLOCKED | DEGRADED
- Cycles used: 0..3
- Findings:
  - <finding> -- <fix applied or escalation reason>
- Verification: <how it was reconfirmed>
```

## Loop contract

Each pass runs at most three fix cycles:

1. **Check** -- run the tool or inspection for this pass.
2. **Diagnose** -- map each failure to a known recipe in the auto-fix library or mark it `escalate`.
3. **Fix** -- apply the recipe or open a finding entry.
4. **Verify** -- re-run the check. Stop on PASS. If still failing after three cycles, mark BLOCKED and continue to the next pass.

A BLOCKED finding does not stop the audit; it surfaces in the report and blocks the eventual review approval.

## Pass 0: Design-language conformance (deterministic)

Reference: `design/impeccable-integration/SKILL.md`.

Runs first, before any LLM judgement, so later passes critique a surface that
already conforms to its own design language.

Tool: the project-local Impeccable detector (pinned devDependency, not bare
`npx`).

```bash
npm exec --offline -- impeccable detect --json <prototype-root>
```

Status for this pass is `PASS`, `FIXED`, `BLOCKED`, or `DEGRADED`:

- Exit `0`, or all findings waived -> `PASS`
- Exit `2`, findings fixed within three cycles -> `FIXED`
- Exit `2`, findings unresolved and unwaived -> `BLOCKED`
- Detector could not run -> `DEGRADED`, and the audit continues on AgentX-only
  checks with the reason recorded verbatim

`DEGRADED` is not a pass. It records that 59 deterministic rules and the 4
design-system conformance rules did not run, so a reader can tell which bar
this prototype was actually held to.

Waivers go through the `anti-slop` Waiver Protocol, never through
`impeccable ignores` alone. See
[Impeccable Integration](../impeccable-integration/SKILL.md) for the rule.

## Pass 1: Accessibility

Reference: `design/accessibility/SKILL.md`.

Tools: axe-core (CLI or playwright), manual keyboard pass, manual screen-reader smoke test.

Check list (mechanical):

- axe-core `serious` + `critical` violations
- Missing `alt` on `<img>` and meaningful `<svg role="img">`
- Icon-only buttons missing `aria-label`
- Progress / loading regions missing `role="progressbar"` with valuenow/min/max
- `outline: none` without a `:focus-visible` replacement
- Modal without focus trap
- Color contrast under 4.5:1 (body) or 3:1 (large text)
- Reduced-motion guard CSS present and effective
- Skip link as first focusable element

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| `<img>` missing alt | Generate from filename or visible caption; mark decorative if purely ornamental |
| Icon-only `<button>` | Add `aria-label` from the parent action label |
| Missing progressbar role | Wrap with `role="progressbar"` + `aria-valuenow/min/max` |
| `outline: none` | Add `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` |
| Glass surface with poor contrast | Add `@supports not (backdrop-filter: blur(1px)) { ... }` fallback to solid surface |
| Touch target under 44 px | Add `min-height: 44px; min-width: 44px;` to the rule |

## Pass 2: Performance

Tools: Lighthouse (preferable in CI), `npm run build` bundle stats.

Check list:

- Initial route bundle <= 250 KB gzip
- Lighthouse Performance >= 85 on the production preview
- No render-blocking custom font; use `font-display: swap`
- Images below the fold use `loading="lazy"`
- Heavy routes split with `React.lazy` + `Suspense`
- No layout shift on initial render (CLS = 0)

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| Route bundle bloated | Replace barrel imports (`import { X } from "lib"`) with deep imports |
| Lazy route missing fallback | Wrap with `<Suspense fallback={<Skeleton />}>` |
| Image without `loading="lazy"` | Add the attribute below the fold; remove above the fold |
| Font flash | Add `font-display: swap` and preload the WOFF2 |

## Pass 3: Content

Check list:

- No `Lorem ipsum`, `TODO`, `FIXME`, `lorem`, `xxx`, or placeholder copy in shipped surfaces
- No broken `<a href>` to internal routes
- All headings form a sequential outline (no skipped levels)
- Page titles unique per route
- Form labels match field intent

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| Placeholder copy | Replace with reviewed copy from `src/data/` or open a content finding |
| Broken internal link | Update to canonical route OR add to the 404 list for content review |
| Skipped heading level | Demote/promote heading to fit the outline |
| Duplicate page titles | Add a `<Title>` component that combines page name + app name |

## Pass 4: Responsive layout

Test breakpoints: 360, 640, 1024, 1440, 1920 px.

Check list:

- No horizontal scroll on any breakpoint (except inside explicit `overflow-x: auto` containers like `<pre>`)
- Touch targets remain >= 44x44 on small breakpoints
- Navigation collapses gracefully (hamburger or stacked) below 640 px
- Tables wrap or scroll horizontally with a visible affordance below 1024 px

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| Horizontal scroll from a `<pre>` | Add `overflow-x: auto; max-width: 100%;` to the rule |
| Image overflows | Add `max-width: 100%; height: auto;` |
| Nav overflows | Switch to a stacked or sheet pattern below 640 px |
| Table overflows | Wrap with `<div style="overflow-x:auto">` and add a scroll-hint shadow |

## Pass 5: Routes

For SPAs only. Skip for static HTML.

Check list:

- Every link in the rendered DOM resolves to a known route
- A catch-all `*` route renders a real 404 page (not blank)
- Each route has a unique `<title>`
- Deep-linking works: opening a non-root route directly does not 404 against the static server

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| No `*` route | Add `<Route path="*" element={<NotFound />} />` |
| Static host 404 on refresh | Add a SPA rewrite (`/* -> /index.html`) in `vercel.json` / `_redirects` / `staticwebapp.config.json` |
| Missing per-route title | Adopt a `<Helmet>` or `<Title>` component pattern |

## Pass 6: Build hygiene

Check list:

- `npm run build` exits 0 with zero TypeScript errors and zero warnings
- `npm run lint` exits 0
- No `console.log` left in shipped code
- No committed secrets (API keys, tokens) -- scan with the AgentX secret-scan tool
- `package.json` and lockfile are in sync

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| TypeScript error | Fix locally; never disable strict mode for the audit |
| Stray `console.log` | Remove or guard with `if (import.meta.env.DEV)` |
| Lockfile drift | Run `npm install` and commit the updated lock |
| Committed secret | Rotate the secret upstream first, then remove from history |

## Pass 7: Usability heuristics

Reference: `design/usability-heuristics/SKILL.md`.

Check list:

- Each of Nielsen H1-H10 inspected against the top 3-5 user tasks
- Every finding scored on the 0-4 severity rubric
- No severity 3 (major) or 4 (catastrophic) finding left unfixed without an explicit accepted waiver
- Content failures (vague errors, missing empty states, jargon) cross-checked against `design/content-design`

Auto-fix recipes: defer to the heuristic-specific patterns in `design/usability-heuristics/SKILL.md` -- this audit only enforces that the inspection was run and scored, not how each fix is implemented.

## Pass 8: Visual regression (optional, recommended)

Reference: `design/visual-regression/SKILL.md`.

Skip only when the prototype is a single throwaway HTML file with no iteration planned.

Check list:

- Baselines exist for every primary route at mobile (360), tablet (768), and desktop (1440)
- Playwright `toHaveScreenshot` suite runs to completion with `maxDiffPixelRatio <= 0.01`
- Determinism rules applied (animations disabled, fonts settled, volatile content masked)
- Any baseline update in this audit cycle is reviewable in the PR diff with a justification

Auto-fix recipes:

| Symptom | Recipe |
|---------|--------|
| Animation flake | Add `vr-mode` class + `animations: "disabled"` and re-run |
| Font flake | `await page.evaluate(() => document.fonts.ready)` before screenshot |
| Live data flake | Mask the volatile region with `data-vr-mask` and re-run |
| Intentional layout change | Update baseline with `--update-snapshots`; document in audit report |

<!--
Source: 5-dimension pre-emit self-critique rubric and anti-slop pass
  adapted from alchaincyf/huashu-design via nexu-io/open-design
  (Apache-2.0). See repository NOTICE.
-->

## Pass 9: Anti-slop self-critique (pre-emit hard gate)

Before the prototype is emitted for review, run the 5-dimension self-critique
from the `anti-slop` skill. Each dimension is scored 1-5; anything under 3/5
on any axis is a P0 hard-gate finding and the prototype must be revised
before Pass 9 is re-run. Anything at 3/5 is a P1 (should-fix). 4/5 and 5/5
are passing.

**Severity convention** (applies to all 10 passes):

- **P0** -- hard gate. Prototype is not review-ready until resolved.
- **P1** -- should-fix before review unless explicitly waived in the audit
  report with rationale.
- **P2** -- nice-to-have. Logged for follow-up.

### The five dimensions

1. **Philosophy** -- Does the surface have a defended point of view? Generic
   SaaS template = 1. Clearly derived from a brand spec or visual direction
   = 5.
2. **Hierarchy** -- Can a first-time viewer name the primary action within
   one second? Every element competing = 1. One CTA wins decisively = 5.
3. **Execution** -- Spacing, alignment, contrast, and typography quality.
   Default Tailwind everywhere with no scale = 1. Disciplined tokens and
   intentional rhythm = 5.
4. **Specificity** -- Does the prototype use real (or honestly-placeholder)
   content and product-specific concepts? Lorem ipsum + stock metrics = 1.
   Product-true content with cited placeholders = 5.
5. **Restraint** -- Did the build avoid the tells Pass 0 cannot see? Scope
   this to the AgentX-retained set: emoji as iconography (T2), fabricated
   metrics and testimonials (T3), unearned trust badges (T8), and
   emoji-prefixed headings (T10), plus judgement-only glassmorphism,
   hierarchy, and composition concerns. Visual tells with a deterministic
   rule, including extreme radius and hand-drawn SVG, are Pass 0's job -- do
   not re-litigate them here. Any retained violation present unwaived = 1.
   None present = 5.

### Procedure

1. Confirm Pass 0 status. Run the AgentX-retained tell check (T2, T3, T8,
   T10) and the honest-placeholders check. If Pass 0 was `DEGRADED`, also
   run the full T1-T10 list, since no deterministic rule covered them.
2. Score each of the five dimensions 1-5 with a one-line justification
   each.
3. If a brand-spec exists for the issue, score against the brand-spec
   prohibited-patterns list, not generic taste.
4. Any dimension below 3/5 = P0; fix and re-run from step 1.
5. Record final scores and justifications in the audit report under
   "Pass 9: Anti-slop self-critique".

Maximum three revision cycles before escalating to the user.

## Reporting template

Write `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` using the
[prototype audit report template](references/report-template.md).

## Done Criteria

- All passes have a status of PASS or FIXED; Pass 0 may be DEGRADED only when
   the report records the reason and the full AgentX fallback checks, and any
   BLOCKED findings must be explicitly accepted in the review document.
- No severity 3 or 4 usability finding (Pass 7) remains open without a documented waiver.
- Auto-fix recipes were applied through the prototype source, not by patching the build output.
- Verification step recorded for every fix.
- Report committed to `docs/artifacts/reviews/`.

## Skills to Compose With

- `design/accessibility` (Pass 1 ground truth)
- `design/usability-heuristics` (Pass 7 ground truth)
- `design/content-design` (cross-check for Pass 3 and Pass 7)
- `design/visual-regression` (Pass 8 ground truth)
- `development/browser-automation` (runtime for axe, Lighthouse, Playwright)
- `design/working-prototype-app` (route + build context)
- `design/prototype-craft` (visual fixes for contrast / motion)
- `development/browser-automation` (axe-core + Lighthouse automation)
- `development/error-handling` (auto-fix loop discipline)