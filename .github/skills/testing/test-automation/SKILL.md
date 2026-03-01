---
name: "test-automation"
description: 'Build and maintain automated test infrastructure for continuous testing. Use when setting up test frameworks, configuring CI test pipelines, implementing parallel test execution, test data management, reporting dashboards, or test environment provisioning.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["jest", "pytest", "xunit", "mocha", "vitest", "nunit", "playwright", "cypress"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "gitlab-ci", "jenkins"]
---

# Test Automation

> **Purpose**: Build robust automated test infrastructure for continuous, reliable, and fast testing.
> **Scope**: Framework setup, CI integration, parallel execution, test data, reporting, environment management.

---

## When to Use This Skill

- Setting up a new test framework for a project
- Configuring CI/CD pipelines for automated testing
- Implementing parallel test execution for speed
- Building test data factories and fixtures
- Creating test reporting dashboards
- Managing test environments (provisioning, teardown)
- Optimizing slow test suites

## When NOT to Use

- Writing specific test cases for a feature (use e2e/integration/unit testing skills)
- Performance benchmarking (use performance testing)
- Security scanning (use security testing)

## Prerequisites

- Source code repository with CI/CD pipeline
- Test framework selected for the tech stack
- Test environment available (or infrastructure-as-code)

## Decision Tree

```
What test automation task?
+- New project setup?
|  +- Which stack?
|  |  +- TypeScript/JS -> Jest or Vitest (unit) + Playwright (e2e)
|  |  +- Python -> pytest + playwright-python
|  |  +- C#/.NET -> xUnit + Playwright for .NET
|  |  +- Java -> JUnit 5 + Selenium/Playwright
|  |  +- Go -> testing package + testify
+- CI pipeline integration?
|  +- GitHub Actions -> .github/workflows/test.yml
|  +- Azure Pipelines -> azure-pipelines.yml
|  +- GitLab CI -> .gitlab-ci.yml
+- Tests too slow?
|  +- Parallelize across workers/shards
|  +- Use test impact analysis (only run affected)
|  +- Cache dependencies and build artifacts
+- Test data management?
|  +- Factories for dynamic data generation
|  +- Fixtures for static seed data
|  +- Database snapshots for integration tests
+- Flaky tests?
|  +- Quarantine, investigate, and fix
|  +- Add retry with reporting (not silent retry)
+- Test reporting?
|  +- JUnit XML for CI integration
|  +- HTML reports for human review
|  +- Coverage reports with thresholds
```

---

## Framework Selection Guide

### Unit Testing

| Stack | Framework | Runner | Assertion | Mocking |
|-------|-----------|--------|-----------|---------|
| TypeScript/JS | **Vitest** | Vitest | Built-in | vi.fn() |
| TypeScript/JS | **Jest** | Jest | Built-in | jest.fn() |
| Python | **pytest** | pytest | assert | unittest.mock / pytest-mock |
| C# | **xUnit** | dotnet test | Assert / FluentAssertions | Moq / NSubstitute |
| Java | **JUnit 5** | Maven/Gradle | AssertJ | Mockito |
| Go | **testing** | go test | testify/assert | testify/mock |

### Integration Testing

| Concern | Tool | Purpose |
|---------|------|---------|
| HTTP APIs | Supertest, httpx, RestAssured | API contract testing |
| Databases | Testcontainers | Isolated DB instances |
| Message queues | Testcontainers | Isolated broker instances |
| External services | WireMock, MSW, responses | HTTP mock servers |

---

## CI Pipeline Configuration

### GitHub Actions

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]  # Parallel shards
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test -- --shard=${{ matrix.shard }}/${{ strategy.job-total }}
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  coverage-merge:
    needs: unit-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - run: npx nyc merge coverage-* merged-coverage.json
      - run: npx nyc report --reporter=text --reporter=lcov
      # Enforce threshold
      - run: npx nyc check-coverage --lines 80 --branches 70 --functions 80
```

### Test Stages

```yaml
# Ordered pipeline - each stage gates the next
stages:
  - lint        # Fast: seconds
  - unit        # Fast: < 2 min
  - integration # Medium: < 5 min
  - e2e         # Slow: < 15 min
  - performance # Slowest: < 30 min (nightly)
```

---

## Parallel Execution

### Sharding Strategy

| Strategy | When to Use | Example |
|----------|------------|---------|
| **File-based sharding** | Large test suites, even file sizes | `--shard=1/4` |
| **Test-based sharding** | Uneven file sizes | Split by test count |
| **Duration-based** | Known slow tests | Split by historical duration |
| **Tag-based** | Different test types | `@smoke`, `@regression`, `@slow` |

### Playwright Sharding

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
});
```

---

## Test Data Management

### Factory Pattern

```typescript
// factories/user.factory.ts
import { faker } from '@faker-js/faker';

export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  };
}

// Usage in tests
const admin = createTestUser({ role: 'admin' });
const user = createTestUser({ email: 'specific@test.com' });
```

### Database Fixtures

```python
# conftest.py
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def db():
    with PostgresContainer("postgres:16") as pg:
        engine = create_engine(pg.get_connection_url())
        yield engine

@pytest.fixture(autouse=True)
def clean_db(db):
    """Reset database state between tests."""
    yield
    db.execute(text("TRUNCATE users, orders CASCADE"))
```

---

## Test Reporting

### JUnit XML (CI Integration)

All major frameworks support JUnit XML output for CI dashboards:

```bash
# Jest
jest --reporters=default --reporters=jest-junit

# pytest
pytest --junitxml=test-results.xml

# dotnet
dotnet test --logger "trx;LogFileName=test-results.trx"

# Playwright
npx playwright test --reporter=junit
```

### Coverage Enforcement

```json
// package.json (Jest)
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

---

## Test Environment Management

| Pattern | When | Tools |
|---------|------|-------|
| **Testcontainers** | Integration tests needing real services | Docker + Testcontainers lib |
| **Docker Compose** | Full stack local testing | docker-compose.test.yml |
| **Ephemeral environments** | PR preview testing | Vercel, Netlify, Azure SWA |
| **Shared staging** | Manual QA and e2e | Dedicated staging environment |

---

## Test Optimization

| Problem | Solution | Impact |
|---------|----------|--------|
| Slow suite (> 10 min) | Parallelize with sharding | 3-4x faster |
| Redundant test runs | Test impact analysis (only run affected) | 50-80% fewer tests |
| Slow dependency install | Cache node_modules/pip cache | 30-60s saved |
| Slow compilation | Incremental builds, SWC/esbuild | 2-5x faster |
| Flaky tests | Quarantine + fix, not retry-and-ignore | Reliable signal |

---

## Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Suite execution time | < 10 min (unit+integration) | > 15 min |
| Flaky test rate | < 2% | > 5% |
| Coverage | >= 80% | < 75% |
| Test-to-code ratio | >= 1:1 | < 0.5:1 |
| CI pass rate | >= 95% | < 90% |

---

## Core Rules

1. **Stage Ordering** - Run tests in order of speed: lint -> unit -> integration -> e2e -> performance.
2. **Parallelize by Default** - Shard test suites across CI workers; sequential runs are acceptable only for ordered integration tests.
3. **Coverage Thresholds in CI** - Enforce minimum coverage (80% lines, 70% branches) as a pipeline gate; fail the build on drops.
4. **Flaky Tests Are Bugs** - Quarantine flaky tests immediately; track and fix root causes within one sprint.
5. **Cache Aggressively** - Cache dependencies, build outputs, and Docker layers using lockfile-keyed cache keys.
6. **Test Data Factories** - Use factory functions for dynamic test data; avoid hard-coded inline fixtures.
7. **JUnit XML for Reporting** - Emit JUnit XML from all frameworks so CI dashboards display consistent results.
8. **Environment Parity** - Use Testcontainers or Docker Compose for local and CI environments; never rely on shared staging for automated tests.
9. **Fail Fast** - Stop the pipeline on the first critical-stage failure; do not waste compute on downstream stages.
10. **Review Test Architecture** - Maintain a test-to-code ratio of at least 1:1; review test quality in code reviews alongside production code.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Run all tests sequentially in CI | Parallelize with sharding |
| Silently retry flaky tests | Report retries, fix root causes |
| Skip tests to speed up CI | Optimize or split into stages |
| Use real external services in CI | Mock or use Testcontainers |
| Merge with failing tests | Block merges until green |
| Ignore coverage drops | Enforce thresholds in CI |
| Test framework lock-in | Abstract behind test utilities |
