---
description: 'C# and .NET development best practices for production-ready code'
---

# C# / .NET Development

> **Purpose**: Production-ready C# and .NET development standards for building secure, performant, maintainable applications.  
> **Audience**: Engineers building .NET applications with C#, ASP.NET Core, Entity Framework Core.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) .NET development patterns.

---

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Async code** | Use `async`/`await` everywhere | `async Task<T> GetDataAsync()` |
| **Null safety** | Enable nullable reference types | `<Nullable>enable</Nullable>` |
| **Error handling** | Use Result types or exceptions | `try-catch` with specific types |
| **DI** | Constructor injection with interfaces | `IServiceCollection` |
| **Testing** | xUnit, NUnit, or TUnit | `[Fact]`, `[Test]` |
| **Logging** | `ILogger<T>` with structured logging | `_logger.LogInformation("User {UserId}", id)` |

---

## C# Language Version

**Current**: C# 14 (.NET 10+)  
**Minimum**: C# 8 (.NET Core 3.1+)

### Modern C# Features (Use These)

```csharp
// File-scoped namespaces (C# 10+)
namespace MyApp.Services;

// Primary constructors (C# 12+)
public class UserService(ILogger<UserService> logger, IUserRepository repo)
{
    public async Task<User> GetUserAsync(int id) => 
        await repo.GetByIdAsync(id);
}

// Required properties (C# 11+)
public class User
{
    public required int Id { get; init; }
    public required string Name { get; init; }
}

// Raw string literals (C# 11+)
string json = """
    {
        "name": "John",
        "age": 30
    }
    """;

// Pattern matching
string GetStatus(Order order) => order switch
{
    { Status: "pending", TotalAmount: > 1000 } => "High value pending",
    { Status: "shipped" } => "In transit",
    { Status: "delivered" } => "Completed",
    _ => "Unknown"
};
```

---

## Async Programming

### Best Practices

```csharp
// ✅ GOOD: Proper async/await
public async Task<List<Product>> GetProductsAsync(CancellationToken ct = default)
{
    return await _dbContext.Products
        .Where(p => p.IsActive)
        .ToListAsync(ct);
}

// ✅ GOOD: ConfigureAwait(false) in library code
public async Task<string> FetchDataAsync()
{
    using var client = new HttpClient();
    var response = await client.GetAsync(url).ConfigureAwait(false);
    return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
}

// ❌ BAD: Blocking on async code
public List<Product> GetProducts()
{
    return GetProductsAsync().Result; // Deadlock risk!
}

// ✅ GOOD: ValueTask for high-perf scenarios
public async ValueTask<User?> GetCachedUserAsync(int id)
{
    if (_cache.TryGetValue(id, out var user))
        return user; // No allocation
    
    return await _repository.GetByIdAsync(id);
}
```

### Async Rules

1. **Always use `async`/`await`** - Never use `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`
2. **Use `Async` suffix** - `GetUserAsync()`, not `GetUser()`
3. **Pass `CancellationToken`** - Support cancellation for long-running operations
4. **ConfigureAwait(false)** - Use in library code to avoid deadlocks
5. **Return Task directly** - If only calling one async method: `return SomeMethodAsync();`

---

## Nullable Reference Types

**Enable in .csproj:**
```xml
<PropertyGroup>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup>
```

### Usage Patterns

```csharp
// ✅ GOOD: Clear nullability intent
public class UserService
{
    public User? FindUser(int id)  // May return null
    {
        return _users.FirstOrDefault(u => u.Id == id);
    }

    public User GetUser(int id)    // Never returns null
    {
        return _users.First(u => u.Id == id);
    }

    // Use null checks at boundaries
    public async Task<IActionResult> GetUserEndpoint(int id)
    {
        User? user = await _service.FindUserAsync(id);
        if (user is null)
            return NotFound();
        
        return Ok(user);
    }
}

// ✅ GOOD: Use 'is null' pattern
if (user is null)
    throw new ArgumentNullException(nameof(user));

// ❌ BAD: Don't use == null
if (user == null) // Less modern
```

---

## Dependency Injection

### Registration

```csharp
// Program.cs (ASP.NET Core 8+)
var builder = WebApplication.CreateBuilder(args);

// Transient: New instance each time
builder.Services.AddTransient<IEmailService, EmailService>();

// Scoped: One instance per request
builder.Services.AddScoped<IUserService, UserService>();

// Singleton: One instance for app lifetime
builder.Services.AddSingleton<ICache, MemoryCache>();

// HttpClient with named client
builder.Services.AddHttpClient("GitHub", client =>
{
    client.BaseAddress = new Uri("https://api.github.com");
    client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
});
```

### Constructor Injection

```csharp
// ✅ GOOD: Primary constructor (C# 12+)
public class OrderService(
    IOrderRepository orderRepo,
    IEmailService emailService,
    ILogger<OrderService> logger)
{
    public async Task ProcessOrderAsync(Order order)
    {
        logger.LogInformation("Processing order {OrderId}", order.Id);
        await orderRepo.SaveAsync(order);
        await emailService.SendConfirmationAsync(order.Email);
    }
}

// ✅ GOOD: Traditional constructor (pre-C# 12)
public class OrderService
{
    private readonly IOrderRepository _orderRepo;
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepo,
        IEmailService emailService,
        ILogger<OrderService> logger)
    {
        _orderRepo = orderRepo;
        _emailService = emailService;
        _logger = logger;
    }
}
```

---

## Entity Framework Core

### DbContext Configuration

```csharp
// Startup/Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
        .LogTo(Console.WriteLine, LogLevel.Information));

// DbContext
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) 
        : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure entities
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Relationships
        modelBuilder.Entity<Order>()
            .HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

### Query Patterns

```csharp
// ✅ GOOD: Async queries with CancellationToken
public async Task<List<User>> GetActiveUsersAsync(CancellationToken ct)
{
    return await _context.Users
        .Where(u => u.IsActive)
        .OrderBy(u => u.Name)
        .ToListAsync(ct);
}

// ✅ GOOD: Projection to avoid over-fetching
public async Task<List<UserDto>> GetUserSummariesAsync()
{
    return await _context.Users
        .Select(u => new UserDto
        {
            Id = u.Id,
            Name = u.Name,
            Email = u.Email
        })
        .ToListAsync();
}

// ✅ GOOD: Include for eager loading
public async Task<Order?> GetOrderWithDetailsAsync(int id)
{
    return await _context.Orders
        .Include(o => o.User)
        .Include(o => o.OrderItems)
            .ThenInclude(oi => oi.Product)
        .FirstOrDefaultAsync(o => o.Id == id);
}

// ❌ BAD: N+1 query problem
foreach (var order in orders)
{
    var user = await _context.Users.FindAsync(order.UserId); // N+1!
}
```

---

## Error Handling

### Exception Patterns

```csharp
// ✅ GOOD: Specific exceptions
public class UserService
{
    public async Task<User> GetUserAsync(int id)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id); // .NET 8+

        var user = await _repository.FindByIdAsync(id);
        if (user is null)
            throw new NotFoundException($"User {id} not found");

        return user;
    }
}

// ✅ GOOD: Global exception handler (ASP.NET Core 8+)
app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        
        var response = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "An error occurred")
        };

        context.Response.StatusCode = response.Item1;
        await context.Response.WriteAsJsonAsync(new { error = response.Item2 });
    });
});

// Custom exceptions
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}
```

---

## Testing

### xUnit Patterns

```csharp
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _mockRepo;
    private readonly UserService _sut; // System Under Test

    public UserServiceTests()
    {
        _mockRepo = new Mock<IUserRepository>();
        _sut = new UserService(_mockRepo.Object);
    }

    [Fact]
    public async Task GetUserAsync_ValidId_ReturnsUser()
    {
        // Arrange
        var expectedUser = new User { Id = 1, Name = "John" };
        _mockRepo.Setup(r => r.FindByIdAsync(1))
            .ReturnsAsync(expectedUser);

        // Act
        var result = await _sut.GetUserAsync(1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("John", result.Name);
        _mockRepo.Verify(r => r.FindByIdAsync(1), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task GetUserAsync_InvalidId_ThrowsException(int id)
    {
        // Act & Assert
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => _sut.GetUserAsync(id));
    }
}
```

---

## Logging

```csharp
public class OrderService(ILogger<OrderService> logger)
{
    // ✅ GOOD: Structured logging with parameters
    public async Task ProcessOrderAsync(Order order)
    {
        logger.LogInformation("Processing order {OrderId} for user {UserId}", 
            order.Id, order.UserId);

        try
        {
            await ProcessInternal(order);
            logger.LogInformation("Order {OrderId} processed successfully", order.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to process order {OrderId}", order.Id);
            throw;
        }
    }

    // ✅ GOOD: Log source generator (.NET 6+)
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Creating user {UserName} with email {Email}")]
    public partial void LogUserCreation(string userName, string email);
}
```

---

## Performance Optimization

```csharp
// ✅ GOOD: Use Span<T> for memory efficiency
public static int ParseVersion(string version)
{
    ReadOnlySpan<char> span = version.AsSpan();
    int index = span.IndexOf('.');
    return int.Parse(span[..index]);
}

// ✅ GOOD: Object pooling
public class BufferPool
{
    private static readonly ArrayPool<byte> _pool = ArrayPool<byte>.Shared;

    public byte[] Rent(int size) => _pool.Rent(size);
    public void Return(byte[] buffer) => _pool.Return(buffer);
}

// ✅ GOOD: StringBuilder for string concatenation
public string BuildReport(List<string> items)
{
    var sb = new StringBuilder();
    foreach (var item in items)
    {
        sb.AppendLine($"- {item}");
    }
    return sb.ToString();
}
```

---

## Security Best Practices

```csharp
// ✅ GOOD: Input validation
public class CreateUserRequest
{
    [Required]
    [EmailAddress]
    public required string Email { get; init; }

    [Required]
    [MinLength(8)]
    public required string Password { get; init; }
}

// ✅ GOOD: Password hashing
public class PasswordService
{
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}

// ✅ GOOD: SQL injection prevention with parameterized queries
// Entity Framework Core does this automatically
var users = await _context.Users
    .Where(u => u.Email == email) // Safe - parameterized
    .ToListAsync();

// ❌ BAD: Never concatenate SQL
// var sql = $"SELECT * FROM Users WHERE Email = '{email}'"; // SQL injection!
```

---

## Configuration

```csharp
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=mydb;Username=user;Password=pass"
  },
  "EmailSettings": {
    "SmtpHost": "smtp.example.com",
    "SmtpPort": 587
  }
}

// Strongly-typed configuration
public class EmailSettings
{
    public required string SmtpHost { get; init; }
    public required int SmtpPort { get; init; }
}

// Registration
builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection("EmailSettings"));

// Usage
public class EmailService(IOptions<EmailSettings> options)
{
    private readonly EmailSettings _settings = options.Value;

    public async Task SendAsync(string to, string subject, string body)
    {
        // Use _settings.SmtpHost, _settings.SmtpPort
    }
}
```

---

## Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **Sync over async** | Using `.Result` or `.Wait()` | Always use `await` |
| **No cancellation** | Long operations can't be cancelled | Pass `CancellationToken` |
| **N+1 queries** | Loading related data in loop | Use `.Include()` for eager loading |
| **Magic strings** | Hardcoded strings everywhere | Use `nameof()` or constants |
| **No null checks** | NullReferenceException | Enable nullable reference types |
| **Poor logging** | Unstructured log messages | Use structured logging with parameters |

---

## Resources

- **Official Docs**: [learn.microsoft.com/dotnet](https://learn.microsoft.com/dotnet)
- **C# Guide**: [learn.microsoft.com/csharp](https://learn.microsoft.com/csharp)
- **ASP.NET Core**: [learn.microsoft.com/aspnet/core](https://learn.microsoft.com/aspnet/core)
- **EF Core**: [learn.microsoft.com/ef/core](https://learn.microsoft.com/ef/core)
- **Testing**: [xunit.net](https://xunit.net), [nunit.org](https://nunit.org)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
