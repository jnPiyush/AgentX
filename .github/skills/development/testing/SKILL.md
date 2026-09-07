---
name: "testing"
description: 'Apply testing strategies including test pyramid, unit/integration/e2e testing, and coverage requirements. Use when writing unit tests, designing integration test suites, implementing end-to-end tests, measuring test coverage, or setting up continuous testing pipelines.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Testing

> **Purpose**: Language-agnostic testing strategies ensuring code quality and reliability. 
> **Goal**: 80%+ coverage with 70% unit, 20% integration, 10% e2e tests. 
> **Note**: For language-specific examples, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Writing unit tests for new code
- Designing integration test suites
- Implementing end-to-end test automation
- Measuring and improving test coverage
- Setting up continuous testing in CI/CD pipelines

## Prerequisites

- Testing framework installed (pytest, Jest, xUnit, etc.)
- CI/CD pipeline for automated test execution

## Rationalization Table

If you find yourself thinking one of these, push back against it. These are the common ways agents and humans skip the discipline.

| Rationalization | Reality |
|-----------------|---------|
| "The change is small, tests are overkill." | Small changes hide the highest-leverage regressions because reviewers under-scrutinize them. Add at least one regression test per behavioral change. |
| "I'll add tests after the feature works." | Tests written after code are shaped to pass current code, not to specify behavior. Write the failing test first; confirm it fails for the expected reason; then code. |
| "This code is too hard to test, so we'll skip it." | "Hard to test" almost always means "badly factored". Refactor for testability instead of waiving the requirement. |
| "Coverage is at 80%, we're fine." | Coverage measures lines, not behavior. Branches, error paths, and boundary inputs can all be untested at 80% line coverage. Inspect what is covered, not just the number. |
| "The test is flaky, just rerun it." | A flaky test is a bug report. Fix the timing, the shared state, or the assertion. Do not retry until green. |
| "This is a refactor, behavior is identical." | Then the existing tests must all stay green without modification. If you had to edit tests to keep them green, the refactor changed behavior. |

## Decision Tree

```
Writing or reviewing tests?
+- New feature/story?
| +- Has acceptance criteria? -> Write e2e test first, then unit tests
| - No criteria? -> Write unit tests for public API surface
+- Bug fix?
| - Write regression test FIRST (red), then fix (green)
+- Refactoring?
| - Ensure existing tests pass -> refactor -> verify green
+- What type of test?
| +- Pure logic, no I/O? -> Unit test (70% of total)
| +- Database/API/file I/O? -> Integration test (20%)
| - Full user workflow? -> E2E test (10%)
- Coverage below 80%?
 - Run: scripts/check-coverage.ps1 -> add tests for uncovered paths
```

## Core Rules

### Write Testable Code

**Testable Code Characteristics:**
```
[PASS] Single Responsibility Principle
[PASS] Dependency Injection
[PASS] Pure Functions (no side effects)
[PASS] Small, focused methods
[PASS] Minimal global state
[PASS] Clear interfaces

[FAIL] Tightly coupled code
[FAIL] Hidden dependencies
[FAIL] God classes
[FAIL] Hard-coded dependencies
[FAIL] Static methods everywhere
```

### Test Fixtures

**Setup and Teardown:**
```
class UserServiceTests:
 # Run once before all tests
 beforeAll():
 testDatabase.connect()
 
 # Run before each test
 beforeEach():
 testDatabase.clear()
 seedTestData()
 
 # Run after each test
 afterEach():
 testDatabase.clear()
 
 # Run once after all tests
 afterAll():
 testDatabase.disconnect()
 
 test "getUser returns correct user":
 # Test uses clean database state
 user = service.getUser(1)
 assert user.name == "Test User"
```

### Parameterized Tests

**Data-Driven Testing:**
```
testCases = [
 {input: 0, expected: 0},
 {input: 1, expected: 1},
 {input: -1, expected: -1},
 {input: 100, expected: 100}
]

for each testCase in testCases:
 test "abs({testCase.input}) returns {testCase.expected}":
 result = abs(testCase.input)
 assert result == testCase.expected
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Flaky tests in CI | Remove timing dependencies, use deterministic test data, add retries for known flaky tests |
| Low coverage despite many tests | Focus on branch coverage not just line coverage, test edge cases |
| Integration tests too slow | Use test containers, parallelize test suites, mock external services |

## Workflow

1. Translate acceptance criteria into test cases.
2. Choose the lowest sufficient layer and existing framework.
3. Run the focused selector, then widen only when risk or failures require it.
4. Report coverage and any untested risk honestly.

## Verification Checklist

- [ ] New behavior has positive and negative cases.
- [ ] Focused tests pass repeatedly.
- [ ] Required integration boundaries are exercised.
- [ ] Coverage meets policy without exclusions.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Test Pyramid through Testing Frameworks](references/details-test-pyramid-and-testing-frameworks.md) - MUST read before work involving test pyramid through testing frameworks.

Existing focused references are reused, not duplicated:

- [Test Organization, CI/CD & Common Pitfalls](references/test-org-ci-pitfalls.md) - MUST read before applying the focused test organization, ci/cd & common pitfalls guidance.
- [Unit, Integration & E2E Testing Examples](references/test-type-examples.md) - MUST read before applying the focused unit, integration & e2e testing examples guidance.
