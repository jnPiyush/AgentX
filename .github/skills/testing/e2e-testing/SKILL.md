---
name: "e2e-testing"
description: 'Design and implement end-to-end tests that validate complete user workflows across the full stack. Use when building browser automation, testing user journeys, cross-browser validation, visual regression testing, or verifying system behavior from the user perspective.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["playwright", "cypress", "selenium", "puppeteer", "testcafe"]
  languages: ["typescript", "javascript", "python", "csharp", "java"]
  platforms: ["web", "mobile", "desktop", "api"]
---

# End-to-End Testing

> **Purpose**: Validate complete user workflows from UI through backend to database and back.
> **Scope**: Browser automation, user journey testing, cross-browser, visual regression, accessibility.

---

## When to Use This Skill

- Validating user-facing workflows end-to-end
- Building browser automation test suites
- Cross-browser and cross-device testing
- Visual regression testing for UI changes
- Smoke testing after deployments
- Accessibility compliance validation (WCAG 2.1 AA)

## When NOT to Use

- Testing isolated business logic (use unit tests)
- Testing API contract compliance only (use integration testing)
- Load testing under concurrent users (use performance testing)
- Security vulnerability scanning (use security testing)

## Prerequisites

- Application deployed to a test environment
- Test user accounts and credentials configured
- Browser automation framework installed
- Test data seeded or factories available

## Decision Tree

```
What e2e scenario are you testing?
+- User login/auth flow?
|  -> Auth E2E (session, tokens, MFA, SSO)
+- Form submission / data entry?
|  -> Form E2E (validation, submission, confirmation)
+- Multi-step workflow (checkout, wizard)?
|  -> Workflow E2E (state transitions, progress, completion)
+- Search / filter / pagination?
|  -> Data E2E (results, sorting, edge cases, empty states)
+- File upload / download?
|  -> File E2E (size limits, formats, progress, errors)
+- Real-time updates (WebSocket, SSE)?
|  -> Real-time E2E (connection, updates, reconnect)
+- Cross-browser compatibility?
|  -> Matrix E2E (Chrome, Firefox, Safari, Edge, mobile)
+- Visual appearance?
|  -> Visual regression (screenshot comparison, responsive)
```

---

## Framework Selection

| Framework | Best For | Language | Speed | Reliability |
|-----------|----------|----------|-------|-------------|
| **Playwright** | Modern web apps, cross-browser | TS/JS/Python/C#/Java | Fast | High |
| **Cypress** | Single-domain SPAs, dev experience | JS/TS | Medium | High |
| **Selenium** | Legacy apps, wide browser support | Any | Slow | Medium |
| **Puppeteer** | Chrome-only, PDF/screenshot | JS/TS | Fast | High |
| **TestCafe** | No WebDriver needed, simple setup | JS/TS | Medium | Medium |

**Recommendation**: Use **Playwright** as the default choice for new projects.

---

## Test Structure

### Page Object Model (POM)

```
e2e/
  fixtures/          # Test data and setup
  pages/             # Page objects (abstraction layer)
    login.page.ts
    dashboard.page.ts
    checkout.page.ts
  specs/             # Test specifications
    auth.spec.ts
    checkout.spec.ts
    search.spec.ts
  utils/             # Helpers, custom commands
  playwright.config.ts
```

### Page Object Pattern

```typescript
// pages/login.page.ts
export class LoginPage {
  constructor(private page: Page) {}

  // Locators - resilient selectors
  private emailInput = () => this.page.getByLabel('Email');
  private passwordInput = () => this.page.getByLabel('Password');
  private submitButton = () => this.page.getByRole('button', { name: 'Sign in' });
  private errorMessage = () => this.page.getByRole('alert');

  // Actions
  async login(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }

  // Assertions
  async expectError(message: string): Promise<void> {
    await expect(this.errorMessage()).toContainText(message);
  }
}
```

### Test Specification

```typescript
// specs/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.login('user@test.com', 'ValidPass123!');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('user@test.com', 'wrong');
    await loginPage.expectError('Invalid email or password');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });
});
```

---

## Resilient Selectors

Priority order for element selection (most to least reliable):

| Priority | Selector Type | Example | Reliability |
|----------|--------------|---------|-------------|
| 1 | Test ID | `getByTestId('submit-btn')` | Highest |
| 2 | Role + name | `getByRole('button', { name: 'Submit' })` | High |
| 3 | Label | `getByLabel('Email address')` | High |
| 4 | Placeholder | `getByPlaceholder('Enter email')` | Medium |
| 5 | Text | `getByText('Welcome back')` | Medium |
| 6 | CSS class | `.btn-primary` | Low (fragile) |
| 7 | XPath | `//div[@class="form"]//button` | Lowest |

**Rule**: NEVER use CSS class or XPath selectors in new tests. Use semantic selectors (role, label, test ID).

---

## Cross-Browser Testing

### Browser Matrix

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
```

---

## Visual Regression Testing

```typescript
test('dashboard renders correctly', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixelRatio: 0.01,  // 1% tolerance
  });
});
```

---

## Accessibility Testing

```typescript
import AxeBuilder from '@axe-core/playwright';

test('page should pass accessibility checks', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Handling Flaky Tests

| Cause | Solution |
|-------|----------|
| Timing issues | Use `waitFor` / auto-waiting instead of `sleep` |
| Dynamic content | Wait for specific element states, not timers |
| Test data conflicts | Isolate test data per test, use factories |
| Network variability | Mock external services, use `route.fulfill()` |
| Animation | Disable animations in test mode |
| Race conditions | Use `expect` with built-in retry/timeout |

**Rule**: NEVER use `sleep()` or `wait(ms)` in e2e tests. Always wait for a specific condition.

---

## CI Integration

```yaml
# .github/workflows/e2e.yml
e2e-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npx playwright install --with-deps
    - run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

---

## Metrics and Reporting

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pass rate | >= 95% | Passing tests / total tests |
| Execution time | < 15 min total suite | CI pipeline duration |
| Flaky rate | < 2% | Flaky tests / total tests |
| Coverage (user journeys) | 100% critical paths | Mapped to acceptance criteria |

---

## Core Rules

1. **Page Object Model** - Encapsulate page interactions in page objects; tests call methods, not raw selectors.
2. **Semantic Selectors Only** - Use `getByRole`, `getByLabel`, `getByTestId`; never use CSS class or XPath selectors in new tests.
3. **No Sleep Calls** - Never use `sleep()` or `wait(ms)`; always wait for a specific element state or network condition.
4. **Test Isolation** - Each test must be independent; no shared state, no execution-order dependencies.
5. **Critical Paths First** - Cover login, checkout, signup, and core workflows before edge cases.
6. **Environment Independence** - Tests must run against any environment via configuration (local, staging, CI).
7. **Stable Test Data** - Use factories and fixtures for test data; never depend on production data.
8. **Fail-Fast Reporting** - Upload trace/video artifacts on failure; generate HTML reports in CI.
9. **Cross-Browser Matrix** - Run against Chromium, Firefox, and WebKit at minimum; include one mobile viewport.
10. **Accessibility Built-In** - Include axe-core accessibility checks in every critical-path test.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Test every minor UI detail in e2e | Focus on critical user workflows |
| Use `sleep()` for synchronization | Wait for specific conditions |
| Share state between tests | Isolate each test completely |
| Use fragile CSS selectors | Use semantic selectors (role, label, testid) |
| Run e2e tests only before release | Run on every PR in CI |
| Ignore flaky tests | Fix immediately or quarantine |
| Hard-code test data | Use factories and fixtures |
| Skip mobile testing | Include mobile viewports in matrix |
