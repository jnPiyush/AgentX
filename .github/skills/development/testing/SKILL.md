---
name: testing
description: 'Language-agnostic testing strategies including test pyramid (70% unit, 20% integration, 10% e2e), testing patterns, and 80%+ coverage requirements.'
---

# Testing

> **Purpose**: Language-agnostic testing strategies ensuring code quality and reliability.  
> **Goal**: 80%+ coverage with 70% unit, 20% integration, 10% e2e tests.  
> **Note**: For language-specific examples, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Test Pyramid

```
        /\
       /E2E\      10% - Few (expensive, slow, brittle)
      /------\
     / Intg   \   20% - More (moderate cost/speed)
    /----------\
   /   Unit     \ 70% - Many (cheap, fast, reliable)
  /--------------\
```

**Why**: Unit tests catch bugs early, run fast, provide precise feedback. E2E tests validate workflows but are slow and flaky.

---

## Unit Testing

### Arrange-Act-Assert (AAA) Pattern

```
Test Structure:
  1. Arrange - Set up test data and dependencies
  2. Act - Execute the code being tested
  3. Assert - Verify the expected outcome

Example:
  test "calculateTotal returns sum of item prices":
    # Arrange
    cart = new ShoppingCart()
    cart.addItem(price: 10.00)
    cart.addItem(price: 25.00)
    
    # Act
    total = cart.calculateTotal()
    
    # Assert
    assert total == 35.00
```

### Test Naming Convention

```
Pattern: methodName_scenario_expectedBehavior

Examples:
  - getUser_validId_returnsUser
  - processPayment_invalidAmount_throwsError
  - calculateDiscount_newUser_applies10PercentOff
  - sendEmail_networkFailure_retriesThreeTimes
```

### Mocking Dependencies

**Mocking Pattern:**
```
test "getUser calls database with correct ID":
  # Arrange - Create mock
  mockDatabase = createMock(Database)
  mockDatabase.when("findById", 123).returns({id: 123, name: "John"})
  
  service = new UserService(mockDatabase)
  
  # Act
  user = service.getUser(123)
  
  # Assert
  assert user.name == "John"
  mockDatabase.verify("findById", 123).wasCalledOnce()
```

**Mocking Libraries by Language:**
- **.NET**: Moq, NSubstitute, FakeItEasy
- **Python**: unittest.mock, pytest-mock
- **Node.js**: Sinon, Jest mocks
- **Java**: Mockito, EasyMock
- **PHP**: PHPUnit mocks, Prophecy

### Test Data Builders

**Builder Pattern for Complex Objects:**
```
class UserBuilder:
  function withId(id):
    this.id = id
    return this
  
  function withEmail(email):
    this.email = email
    return this
  
  function build():
    return new User(this.id, this.email, ...)

# Usage in tests
test "createOrder requires valid user":
  user = new UserBuilder()
    .withId(123)
    .withEmail("test@example.com")
    .build()
  
  order = createOrder(user, items)
  assert order.userId == 123
```

---

## Integration Testing

### Test Database Interactions

**Integration Test Pattern:**
```
test "saveUser persists to database":
  # Arrange
  testDatabase = createTestDatabase()  # In-memory or test DB
  repository = new UserRepository(testDatabase)
  user = {email: "test@example.com", name: "Test User"}
  
  # Act
  savedUser = repository.save(user)
  retrievedUser = repository.findById(savedUser.id)
  
  # Assert
  assert retrievedUser.email == "test@example.com"
  
  # Cleanup
  testDatabase.cleanup()
```

**Test Database Strategies:**
- **In-Memory Database** - Fast, isolated (SQLite, H2)
- **Docker Container** - Real database, disposable
- **Test Database** - Separate instance, reset between tests
- **Transactions** - Rollback after each test

### Test API Endpoints

**HTTP API Integration Test:**
```
test "POST /users creates new user":
  # Arrange
  client = createTestClient(app)
  userData = {
    email: "newuser@example.com",
    name: "New User"
  }
  
  # Act
  response = client.post("/users", body: userData)
  
  # Assert
  assert response.status == 201
  assert response.body.email == "newuser@example.com"
  assert response.body.id exists
```

---

## End-to-End (E2E) Testing

### Browser Automation

**E2E Test Pattern:**
```
test "user can complete checkout flow":
  # Arrange
  browser = launchBrowser()
  page = browser.newPage()
  
  # Act
  page.goto("https://example.com")
  page.click("#add-to-cart-button")
  page.goto("/checkout")
  page.fill("#email", "user@example.com")
  page.fill("#credit-card", "4242424242424242")
  page.click("#place-order-button")
  
  # Assert
  page.waitForSelector(".order-confirmation")
  orderNumber = page.textContent(".order-number")
  assert orderNumber isNotEmpty
  
  # Cleanup
  browser.close()
```

**E2E Testing Tools:**
- **Playwright** - Modern, multi-browser
- **Cypress** - Developer-friendly, fast
- **Selenium** - Industry standard, widely supported
- **Puppeteer** - Chrome/Chromium focused

### E2E Best Practices

- Run E2E tests in CI/CD pipeline
- Use test data factories for consistent state
- Implement retry logic for flaky tests
- Run in parallel to reduce execution time
- Use unique test user accounts
- Clean up test data after runs

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

**✅ Always Test:**
- Business logic and algorithms
- Data transformations
- Validation rules
- Error handling paths
- Edge cases and boundary conditions
- Security-critical code

**❌ Don't Test:**
- Third-party library internals
- Framework code
- Simple getters/setters (unless logic involved)
- Configuration files
- Auto-generated code

---

## Testing Best Practices

### Write Testable Code

**Testable Code Characteristics:**
```
✅ Single Responsibility Principle
✅ Dependency Injection
✅ Pure Functions (no side effects)
✅ Small, focused methods
✅ Minimal global state
✅ Clear interfaces

❌ Tightly coupled code
❌ Hidden dependencies
❌ God classes
❌ Hard-coded dependencies
❌ Static methods everywhere
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
✅ Good:
  - test_getUser_withValidId_returnsUser
  - test_processPayment_whenInsufficientFunds_throwsError
  - test_calculateDiscount_forNewUser_applies10PercentOff

❌ Bad:
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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
