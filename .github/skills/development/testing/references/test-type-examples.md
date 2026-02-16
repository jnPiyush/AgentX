# Unit, Integration & E2E Testing Examples

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
 testDatabase = createTestDatabase() # In-memory or test DB
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
