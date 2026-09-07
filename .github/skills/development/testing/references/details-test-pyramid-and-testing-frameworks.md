# testing: Test Pyramid through Testing Frameworks

> MUST read before work involving **test pyramid through testing frameworks**. This reference preserves complete source guidance relocated for context-budget compliance.

## Test Pyramid

```
 /\
 /E2E\ 10% - Few (expensive, slow, brittle)
 /------\
 / Intg \ 20% - More (moderate cost/speed)
 /----------\
 / Unit \ 70% - Many (cheap, fast, reliable)
 /--------------\
```

**Why**: Unit tests catch bugs early, run fast, provide precise feedback. E2E tests validate workflows but are slow and flaky.

---

## Test Coverage

### Coverage Metrics

```
Coverage Types:
 - Line Coverage: % of code lines executed
 - Branch Coverage: % of if/else branches taken
 - Function Coverage: % of functions called
 - Statement Coverage: % of statements executed

Target: 80%+ overall coverage
```

**Coverage Tools by Language:**
- **.NET**: Coverlet, dotCover
- **Python**: coverage.py, pytest-cov
- **Node.js**: Istanbul (nyc), Jest
- **Java**: JaCoCo, Cobertura
- **PHP**: PHPUnit --coverage

### What to Test

**[PASS] Always Test:**
- Business logic and algorithms
- Data transformations
- Validation rules
- Error handling paths
- Edge cases and boundary conditions
- Security-critical code

**[FAIL] Don't Test:**
- Third-party library internals
- Framework code
- Simple getters/setters (unless logic involved)
- Configuration files
- Auto-generated code

---

## Anti-Patterns

- **Test After Ship**: Writing tests after code is merged and deployed -> Write tests before or alongside implementation (TDD or test-with)
- **Ice Cream Cone**: Mostly E2E tests with few unit tests (inverted pyramid) -> Follow the test pyramid: 70% unit, 20% integration, 10% E2E
- **Flaky Acceptance**: Tests that pass or fail randomly due to timing or shared state -> Remove timing dependencies, isolate test data, use deterministic fixtures
- **Testing Implementation**: Tests coupled to private methods or internal structure -> Test public behavior and contracts; refactoring should not break tests
- **Assertion-Free Tests**: Tests that execute code but never assert expected outcomes -> Every test MUST have at least one meaningful assertion
- **Shared Mutable State**: Tests that depend on or modify global/shared state -> Reset state in beforeEach/setUp; use isolated test databases or containers
- **Coverage Gaming**: Writing trivial tests to hit coverage numbers without testing real logic -> Focus coverage on business logic, error paths, and edge cases

---

## Testing Frameworks

**Unit Testing:**
- **.NET**: xUnit, NUnit, MSTest
- **Python**: pytest, unittest
- **Node.js**: Jest, Mocha, Vitest
- **Java**: JUnit, TestNG
- **PHP**: PHPUnit

**Integration Testing:**
- **API Testing**: REST Assured, Supertest, Postman/Newman
- **Database Testing**: Testcontainers, DbUnit

**E2E Testing:**
- **Browser**: Playwright, Cypress, Selenium, Puppeteer
- **Mobile**: Appium, Detox

---

## Resources

**Testing Guides:**
- [Test Pyramid - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Testing Best Practices](https://testingjavascript.com)
- [Google Testing Blog](https://testing.googleblog.com)

**Books:**
- "xUnit Test Patterns" by Gerard Meszaros
- "The Art of Unit Testing" by Roy Osherove
- "Growing Object-Oriented Software, Guided by Tests" by Steve Freeman

---

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`check-coverage.ps1`](../scripts/check-coverage.ps1) | Check test coverage against threshold (80% default) | `./scripts/check-coverage.ps1 [-Threshold 90]` |
| [`check-coverage.sh`](../scripts/check-coverage.sh) | Cross-platform coverage checker (bash) | `./scripts/check-coverage.sh --threshold 80` |
| [`check-test-pyramid.ps1`](../scripts/check-test-pyramid.ps1) | Verify test distribution matches pyramid ratios | `./scripts/check-test-pyramid.ps1` |
| [`scaffold-playwright.py`](../scripts/scaffold-playwright.py) | Generate Playwright e2e test scaffold (TS or Python) | `python ../scripts/scaffold-playwright.py --lang typescript --url http://localhost:3000` |

## References

- [Test Type Examples](test-type-examples.md)
- [Test Org Ci Pitfalls](test-org-ci-pitfalls.md)