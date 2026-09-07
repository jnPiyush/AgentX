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
## Workflow

1. Define the user outcome and environment fixture.
2. Implement the shortest realistic journey.
3. Run across required browsers and accessibility states.
4. Quarantine no failure without an owner and root-cause plan.

## Error Handling

- Flake: reproduce with trace and fix synchronization or isolation.
- Environment outage: distinguish it from product failure.
- Selector drift: repair the user-facing contract, not a brittle DOM path.

## Verification Checklist

- [ ] Critical journey passes repeatedly.
- [ ] Artifacts exist for failures.
- [ ] Data cleanup is reliable.
- [ ] Browser and accessibility coverage matches policy.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Framework Selection through Metrics and Reporting](references/details-framework-selection-and-metrics-and-reporting.md) - MUST read before work involving framework selection through metrics and reporting.
