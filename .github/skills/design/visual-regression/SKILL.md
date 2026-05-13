---
name: "visual-regression"
description: 'Catch unintended visual drift between prototype iterations with deterministic screenshot diffs. Use when iterating on a prototype, before review handoff, or before promoting an SPA prototype to a real build. Default engine is Playwright `toHaveScreenshot` with masking, threshold, and per-OS baselines. Includes Chromatic / Percy guidance for hosted alternatives.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-13"
  updated: "2026-05-13"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor", "tester"]
  frameworks: ["playwright", "storybook", "chromatic", "percy", "vite", "react"]
  output-formats: ["png", "html-report", "junit"]
---

# Visual Regression

> WHEN: A prototype is iterated more than once, or before declaring a prototype review-ready. This skill snapshots the key screens at the canonical breakpoints, diffs new builds against an approved baseline, and fails the audit if drift is unintended. Default engine is Playwright; managed services (Chromatic, Percy, Applitools) are listed for teams that prefer hosted review queues.

## When to Use This Skill

- Iterating a prototype where each change can shift unrelated screens
- Hardening a working SPA prototype that will inform a production build
- Catching CSS regressions from token or theme changes
- Reviewing a PR that touches global styles or shared components

Visual regression complements axe (a11y) and Lighthouse (performance). It does not replace either.

## Authoritative Sources

| Source | What it covers |
|--------|----------------|
| Playwright Test, Visual comparisons | `toHaveScreenshot`, masking, threshold |
| Storybook + Chromatic docs | Component-level visual review |
| BrowserStack Percy docs | Hosted DOM snapshot + diff |
| Applitools Eyes docs | AI-driven layout-aware diff |
| Microsoft accessibility-insights and reflect.run | Adjacent tooling |

## Default Engine: Playwright

Reasoning:

- Already required by `development/browser-automation` for the axe pass.
- Free and runs locally and in CI.
- Deterministic with explicit threshold and animation handling.

### Install (per prototype)

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

### Project layout

```
docs/ux/prototypes/<feature>/
  __screenshots__/
    chromium-darwin/         # baseline images, committed to git
  tests/
    visual.spec.ts
  playwright.config.ts
```

Baselines live next to the prototype, not in `tests/` at the repo root, because they are tied to the prototype version.

### Minimal config

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  projects: [
    { name: "mobile",  use: { viewport: { width: 360,  height: 800  } } },
    { name: "tablet",  use: { viewport: { width: 768,  height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900  } } },
  ],
});
```

### Minimal test

`tests/visual.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const ROUTES = [
  { name: "home",      path: "/" },
  { name: "dashboard", path: "/dashboard" },
  { name: "settings",  path: "/settings" },
];

for (const route of ROUTES) {
  test(`route: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      mask: [
        page.locator("[data-vr-mask]"),
        page.locator("time"),
      ],
      fullPage: true,
    });
  });
}
```

### Run locally

```bash
npm run build && npx vite preview --port 4173 &
npx playwright test --update-snapshots   # first run, accept baseline
npx playwright test                      # subsequent runs, fail on drift
```

Commit the generated baselines in `__screenshots__/<browser-os>/`. They are part of the prototype.

## Determinism Rules

Visual regression is only useful if the only signal is intent. Eliminate noise mechanically:

1. **Disable animation** at the test level via `animations: "disabled"` and a CSS guard:
   ```css
   .vr-mode *, .vr-mode *::before, .vr-mode *::after {
     animation: none !important;
     transition: none !important;
   }
   ```
   Add `vr-mode` class via Playwright `addInitScript`.
2. **Mask volatile content**: timestamps, user avatars, live data. Use `data-vr-mask` attributes.
3. **Stabilize fonts**: wait on `document.fonts.ready` and prefer locally hosted WOFF2 over network fonts.
4. **Fix the viewport per project**: do not rely on default sizes.
5. **Fix the OS in CI**: Playwright generates per-OS baselines. Pin to one OS (usually Linux in CI) and commit only those.
6. **Use `scale: "css"`** so HiDPI machines do not produce different baselines.
7. **Seed any randomness** in the prototype's data layer when the SPA renders sample data.

## CI Integration

GitHub Actions example:

```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run build
- run: npx vite preview --port 4173 &
- run: npx wait-on http://localhost:4173
- run: npx playwright test
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: visual-diff-report
    path: |
      playwright-report
      test-results
```

On failure, the agent or developer downloads the artifact, inspects the diff PNGs (expected, actual, diff), and either fixes the source or accepts the new baseline with `--update-snapshots`. Baseline updates must be reviewed in the PR diff.

## Updating Baselines

- Always update intentionally, with a commit message that names which screens shifted and why.
- One PR, one baseline update batch. Mixed code + baseline PRs lose review value.
- Reject baseline updates that include unrelated drift; fix the root cause first.

## Acceptance Thresholds

| Mode | `maxDiffPixelRatio` | When |
|------|---------------------|------|
| Strict | 0 | Component / Storybook level |
| Default | 0.01 | Route-level prototype |
| Tolerant | 0.05 | Cross-OS smoke (avoid using as a primary gate) |

Stay at default. Increasing tolerance hides bugs.

## Alternatives (hosted)

Use when the team prefers a managed review queue:

| Tool | Strength | Caveat |
|------|----------|--------|
| Chromatic | Tight Storybook integration, baseline review UI | Component-level, requires Storybook |
| Percy (BrowserStack) | DOM snapshot, multi-browser hosting | Per-snapshot pricing |
| Applitools Eyes | Layout-aware diff, ignores antialiasing automatically | Highest cost; vendor lock-in |

When using a hosted service, keep the same determinism rules and document the service choice in the prototype's `README.md`.

## Anti-Patterns

| Pattern | Why | Fix |
|---------|-----|-----|
| Snapshotting full pages with live data | Diffs every run | Mask or seed data |
| Mixing OS baselines in one folder | Renders differ per OS | One OS, one folder |
| Using `toMatchSnapshot` for visual diffs | That is for serializers, not images | Use `toHaveScreenshot` |
| Updating baselines without review | Hides real regressions | Treat baselines like code |
| Skipping the animation guard | Random flakes | Apply `vr-mode` class + Playwright option |
| Snapshotting one viewport only | Misses responsive bugs | Run mobile / tablet / desktop projects |

## Reporting

The prototype-audit pass that consumes this skill writes to `docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md`:

```markdown
## Pass 8: Visual Regression
- Status: PASS | FIXED | BLOCKED
- Routes covered: <list>
- Diff results: <n routes>/<n total> within threshold
- Baseline updates: <count> (link to commit)
- Findings:
  - <route> @ <viewport>: <maxDiffPixelRatio>; cause: <text>; resolution: <text or escalation>
- Verification: replay run after fixes
```

## Done Criteria

- Baselines exist for every primary route at mobile, tablet, desktop.
- All routes pass under the default threshold or have an explicit, reviewed baseline update.
- Determinism rules applied (animations off, fonts ready, volatile content masked).
- CI runs the suite on every PR that touches the prototype.

## Skills to Compose With

- `development/browser-automation` -- shares the Playwright runtime
- `design/accessibility` -- complementary: axe covers a11y, visual covers layout
- `design/prototype-audit` -- this skill is the visual regression pass
- `testing/e2e-testing` -- broader Playwright patterns
