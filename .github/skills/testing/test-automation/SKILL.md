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
## Workflow

1. Inventory risks and current suite gaps.
2. Choose framework and layer already used by the repository.
3. Add deterministic fixtures and focused cases.
4. Wire bounded CI execution, reporting, and flake monitoring.

## Error Handling

- Flake: quarantine only with an owner, evidence, and expiry.
- Environment failure: report separately from product assertions.
- Parallel collision: isolate the resource or serialize that group.

## Verification Checklist

- [ ] Focused and CI runs pass repeatedly.
- [ ] Parallel execution has no shared-state collision.
- [ ] Reports identify failing behavior and artifacts.
- [ ] Runtime and flake rate stay within policy.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Framework Selection Guide through Metrics](references/details-framework-selection-guide-and-metrics.md) - MUST read before work involving framework selection guide through metrics.
