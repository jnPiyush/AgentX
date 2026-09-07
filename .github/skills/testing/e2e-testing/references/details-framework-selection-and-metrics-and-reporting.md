# e2e-testing: Framework Selection through Metrics and Reporting

> MUST read before work involving **framework selection through metrics and reporting**. This reference preserves complete source guidance relocated for context-budget compliance.

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
