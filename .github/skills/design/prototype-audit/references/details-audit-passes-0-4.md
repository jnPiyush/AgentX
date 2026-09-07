# Prototype Audit - Passes 0 Through 4

> Read this when the [prototype-audit](../SKILL.md) root sends you here for the
> original inputs, output contract, loop contract, or the detailed procedures
> and recipes for Pass 0 through Pass 4. The sections below are preserved
> verbatim from the original root.

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
