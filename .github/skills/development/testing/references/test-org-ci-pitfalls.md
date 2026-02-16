# Test Organization, CI/CD & Common Pitfalls

## Test Organization

### Test File Structure

```
Project Structure:
 src/
 services/
 UserService
 PaymentService
 repositories/
 UserRepository
 
 tests/
 unit/
 services/
 UserService.test
 PaymentService.test
 repositories/
 UserRepository.test
 integration/
 api/
 UserEndpoints.test
 PaymentEndpoints.test
 e2e/
 checkout/
 CheckoutFlow.test
```

### Test Naming

**Descriptive Test Names:**
```
[PASS] Good:
 - test_getUser_withValidId_returnsUser
 - test_processPayment_whenInsufficientFunds_throwsError
 - test_calculateDiscount_forNewUser_applies10PercentOff

[FAIL] Bad:
 - test1
 - testGetUser
 - testPayment
```

---

## Continuous Testing

### Run Tests in CI/CD

**CI Pipeline:**
```yaml
steps:
 1. Checkout code
 2. Install dependencies
 3. Run linter
 4. Run unit tests
 5. Run integration tests
 6. Generate coverage report
 7. Fail if coverage < 80%
 8. Run E2E tests (optional, can be separate pipeline)
```

### Test Automation

- Run tests on every commit
- Block PRs if tests fail
- Run tests in parallel for speed
- Retry flaky tests automatically
- Generate test reports
- Track test metrics over time

---

## Common Testing Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **Flaky tests** | Tests pass/fail randomly | Fix timing issues, use retries, improve test isolation |
| **Slow tests** | Test suite takes too long | Parallelize, use in-memory DBs, mock external services |
| **Brittle tests** | Tests break with minor changes | Test behavior not implementation, use stable selectors |
| **Over-mocking** | Too many mocks, tests don't catch real bugs | Balance mocks with integration tests |
| **Under-testing** | Low coverage, bugs slip through | Follow test pyramid, aim for 80%+ coverage |
| **Untestable code** | Hard to write tests | Refactor for dependency injection, smaller functions |

---
