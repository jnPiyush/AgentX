# Prototype Audit - Passes 5 Through 9

> Read this when the [prototype-audit](../SKILL.md) root sends you here for the
> original procedures and recipes for Pass 5 through Pass 9. The sections below
> are preserved verbatim from the original root.

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
