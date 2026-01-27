---
name: testing
description: 'Production testing strategies including test pyramid (70% unit, 20% integration, 10% e2e), xUnit, FluentAssertions, Moq patterns, and 80%+ coverage requirements.'
---

# Testing

> **Purpose**: Production testing strategies ensuring code quality and reliability.  
> **Goal**: 80%+ coverage with 70% unit, 20% integration, 10% e2e tests.

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

### Quick Example (xUnit + FluentAssertions + Moq)

```csharp
using Xunit;
using Moq;
using FluentAssertions;

public class PaymentServiceTests
{
    [Fact]
    public async Task ProcessPayment_Success_ReturnsChargeId()
    {
        // Arrange
        var mockStripe = new Mock<IStripeClient>();
        mockStripe.Setup(x => x.ChargeAsync(10000, "usd", "tok_visa"))
            .ReturnsAsync(new ChargeResult { Id = "ch_123", Status = "succeeded" });
        var service = new PaymentService(mockStripe.Object);
        
        // Act
        var result = await service.ProcessPaymentAsync(100m, "tok_visa");
        
        // Assert
        result.Success.Should().BeTrue();
        result.ChargeId.Should().Be("ch_123");
        mockStripe.Verify(x => x.ChargeAsync(10000, "usd", "tok_visa"), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void ProcessPayment_InvalidAmount_ThrowsArgumentException(decimal amount)
    {
        var service = new PaymentService(Mock.Of<IStripeClient>());
        Assert.Throws<ArgumentException>(() => service.ProcessPaymentAsync(amount, "tok"));
    }
}
```

### Key Patterns

**Arrange-Act-Assert (AAA)**:
```csharp
[Fact]
public void Method_Condition_ExpectedBehavior()
{
    // Arrange: Setup
    var sut = new Calculator();
    
    // Act: Execute
    var result = sut.Add(2, 3);
    
    // Assert: Verify
    result.Should().Be(5);
}
```

**Fixtures for Shared Setup**:
```csharp
public class DatabaseFixture : IDisposable
{
    public AppDbContext Context { get; }
    
    public DatabaseFixture()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("TestDb")
            .Options;
        Context = new AppDbContext(options);
        Context.Database.EnsureCreated();
    }
    
    public void Dispose() => Context.Dispose();
}

public class UserRepositoryTests : IClassFixture<DatabaseFixture>
{
    private readonly AppDbContext _context;
    
    public UserRepositoryTests(DatabaseFixture fixture) => _context = fixture.Context;
    
    [Fact]
    public async Task GetUser_ReturnsCorrectUser()
    {
        var repo = new UserRepository(_context);
        var user = await repo.GetByIdAsync(1);
        user.Email.Should().Be("test@example.com");
    }
}
```

---

## Integration Testing

### Database Integration (EF Core + In-Memory)

```csharp
public class UserRepositoryIntegrationTests : IDisposable
{
    private readonly AppDbContext _context;
    
    public UserRepositoryIntegrationTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"TestDb_{Guid.NewGuid()}")
            .Options;
        _context = new AppDbContext(options);
    }
    
    [Fact]
    public async Task CreateAndRetrieveUser_WorksCorrectly()
    {
        var repo = new UserRepository(_context);
        var user = new User { Email = "test@example.com", Name = "Test" };
        await repo.AddAsync(user);
        await _context.SaveChangesAsync();
        
        var retrieved = await repo.GetByEmailAsync("test@example.com");
        retrieved.Should().NotBeNull();
        retrieved.Name.Should().Be("Test");
    }
    
    public void Dispose() => _context.Dispose();
}
```

### API Integration (WebApplicationFactory)

```csharp
public class UserApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    
    public UserApiTests(WebApplicationFactory<Program> factory) => _client = factory.CreateClient();
    
    [Fact]
    public async Task GetUsers_ReturnsOkWithUsers()
    {
        var response = await _client.GetAsync("/api/users");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var users = await response.Content.ReadFromJsonAsync<List<UserDto>>();
        users.Should().NotBeNull();
    }
    
    [Fact]
    public async Task CreateUser_ReturnsCreated()
    {
        var newUser = new { Email = "new@example.com", Name = "New User" };
        var response = await _client.PostAsJsonAsync("/api/users", newUser);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
    }
}
```

---

## End-to-End Testing

### Playwright (Recommended)

```csharp
using Microsoft.Playwright;

public class LoginE2ETests : IAsyncLifetime
{
    private IPlaywright _playwright;
    private IBrowser _browser;
    
    public async Task InitializeAsync()
    {
        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new() { Headless = true });
    }
    
    [Fact]
    public async Task Login_WithValidCredentials_RedirectsToDashboard()
    {
        var page = await _browser.NewPageAsync();
        await page.GotoAsync("https://localhost:5001/login");
        await page.FillAsync("#email", "user@example.com");
        await page.FillAsync("#password", "Password123!");
        await page.ClickAsync("button[type='submit']");
        await page.WaitForURLAsync("**/dashboard");
        await Expect(page).ToHaveTitleAsync("Dashboard");
    }
    
    public async Task DisposeAsync()
    {
        await _browser.CloseAsync();
        _playwright.Dispose();
    }
}
```

---

## Test Coverage

### .NET Coverage

```bash
# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Generate HTML report
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage-report" -reporttypes:Html
```

### Configuration (.csproj)

```xml
<PropertyGroup>
    <CollectCoverage>true</CollectCoverage>
    <CoverletOutputFormat>cobertura</CoverletOutputFormat>
    <Threshold>80</Threshold>
    <ThresholdType>line</ThresholdType>
</PropertyGroup>
```

### Targets

| Target | Minimum | Goal |
|--------|---------|------|
| **Line Coverage** | 80% | 90%+ |
| **Branch Coverage** | 70% | 85%+ |
| **Critical Paths** | 100% | 100% |

---

## Best Practices

### ✅ DO

- **Name tests clearly**: `Method_Condition_ExpectedBehavior`
- **Test one thing**: Each test validates single behavior
- **Keep tests independent**: No shared mutable state
- **Test edge cases**: Null, empty, boundary values
- **Use AAA pattern**: Arrange → Act → Assert
- **Mock external dependencies**: Databases, APIs, file systems
- **Run tests fast**: Unit tests < 100ms, integration < 5s
- **Fail tests early**: First assertion failure should stop test

### ❌ DON'T

- **Test implementation details**: Test behavior, not internals
- **Share state between tests**: Causes flaky tests
- **Ignore flaky tests**: Fix or delete them
- **Test trivial code**: Getters/setters with no logic
- **Use real databases in unit tests**: Use in-memory or mocks
- **Skip assertions**: Every test must verify something
- **Write tests after bugs**: Write tests first (TDD)

---

## Test Organization

```
MyApp.Tests/
├── Unit/
│   ├── Services/
│   │   ├── UserServiceTests.cs
│   │   └── PaymentServiceTests.cs
│   └── Validators/
│       └── UserValidatorTests.cs
├── Integration/
│   ├── Repositories/
│   │   └── UserRepositoryTests.cs
│   └── Api/
│       └── UserApiTests.cs
└── E2E/
    ├── LoginFlowTests.cs
    └── CheckoutFlowTests.cs
```

---

## Common Tools

| Tool | Purpose |
|------|---------|
| **xUnit / NUnit** | Test frameworks |
| **FluentAssertions** | Readable assertions |
| **Moq / NSubstitute** | Mocking frameworks |
| **Bogus** | Test data generation |
| **WebApplicationFactory** | API integration tests |
| **Playwright / Selenium** | E2E browser automation |
| **Coverlet** | Code coverage |
| **Testcontainers** | Docker containers for tests |

---

## Quick Commands

```bash
# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific test
dotnet test --filter "FullyQualifiedName~UserServiceTests"

# Watch mode
dotnet watch test
```

---

**See Also**: [AGENTS.md](../AGENTS.md) • [03-error-handling.md](03-error-handling.md)

**Last Updated**: January 13, 2026

