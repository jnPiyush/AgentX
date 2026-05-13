---
name: "prototype-audit"
description: 'Mechanically audit a UX prototype or front-end build through six self-healing passes -- accessibility, performance, content, responsive layout, routes, and build hygiene. Use before declaring any prototype review-ready, or whenever the prototype-auditor sub-agent is invoked. Each pass follows check -> diagnose -> fix -> verify with a maximum of three fix cycles per pass before escalating.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-12"
  updated: "2026-05-12"
compatibility:
  agents: ["ux-designer", "reviewer", "prototype-auditor", "engineer"]
  frameworks: ["html-css", "react", "vue", "tailwind"]
  output-formats: ["markdown"]
---

# Prototype Audit

> WHEN: A UX prototype (static HTML or working SPA) is about to be reviewed, demoed, or shipped to stakeholders. This skill is the mechanical procedure the `prototype-auditor` internal sub-agent runs. The output is a structured report at `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md`.

## Inputs

- Prototype root directory (static HTML folder or SPA `dist/`).
- A live preview URL or `npx serve` over the build output.
- Issue number for the report filename.
- The `accessibility/SKILL.md` checklist as ground truth for Pass 1.

## Output

`docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` with one section per pass:

```markdown
## Pass <N>: <Name>
- Status: PASS | FIXED | BLOCKED
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

## Reporting template

The auditor writes `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md` using this skeleton:

```markdown
# Prototype Audit -- Issue <issue>

Prototype: <path or URL>
Auditor: prototype-auditor
Date: <yyyy-mm-dd>

## Summary
- Passes: <n>/6
- Fixed automatically: <count>
- Blocked: <count>

## Pass 1: Accessibility
...
## Pass 2: Performance
...
## Pass 3: Content
...
## Pass 4: Responsive
...
## Pass 5: Routes
...
## Pass 6: Build hygiene
...

## Blocked findings (escalate)
- <finding> -- owner: <agent> -- next action: <text>
```

## Done Criteria

- All six passes have a status of PASS or FIXED, or the BLOCKED findings are explicitly accepted in the review document.
- Auto-fix recipes were applied through the prototype source, not by patching the build output.
- Verification step recorded for every fix.
- Report committed to `docs/artifacts/reviews/`.

## Skills to Compose With

- `design/accessibility` (Pass 1 ground truth)
- `design/working-prototype-app` (route + build context)
- `design/prototype-craft` (visual fixes for contrast / motion)
- `development/browser-automation` (axe-core + Lighthouse automation)
- `development/error-handling` (auto-fix loop discipline)