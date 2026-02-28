# C# Async Programming, Nullable Types & DI

## Async Programming

### Best Practices

```csharp
// [PASS] GOOD: Proper async/await
public async Task<List<Product>> GetProductsAsync(CancellationToken ct = default)
{
 return await _dbContext.Products
 .Where(p => p.IsActive)
 .ToListAsync(ct);
}

// [PASS] GOOD: ConfigureAwait(false) in library code
public async Task<string> FetchDataAsync()
{
 using var client = new HttpClient();
 var response = await client.GetAsync(url).ConfigureAwait(false);
 return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
}

// [FAIL] BAD: Blocking on async code
public List<Product> GetProducts()
{
 return GetProductsAsync().Result; // Deadlock risk!
}

// [PASS] GOOD: ValueTask for high-perf scenarios
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
// [PASS] GOOD: Clear nullability intent
public class UserService
{
 public User? FindUser(int id) // May return null
 {
 return _users.FirstOrDefault(u => u.Id == id);
 }

 public User GetUser(int id) // Never returns null
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

// [PASS] GOOD: Use 'is null' pattern
if (user is null)
 throw new ArgumentNullException(nameof(user));

// [FAIL] BAD: Don't use == null
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
// [PASS] GOOD: Primary constructor (C# 12+)
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

// [PASS] GOOD: Traditional constructor (pre-C# 12)
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
