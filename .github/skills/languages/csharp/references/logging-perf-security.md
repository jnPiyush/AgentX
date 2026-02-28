# C# Logging, Performance & Security

## Logging

```csharp
public class OrderService(ILogger<OrderService> logger)
{
 // [PASS] GOOD: Structured logging with parameters
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

 // [PASS] GOOD: Log source generator (.NET 6+)
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
// [PASS] GOOD: Use Span<T> for memory efficiency
public static int ParseVersion(string version)
{
 ReadOnlySpan<char> span = version.AsSpan();
 int index = span.IndexOf('.');
 return int.Parse(span[..index]);
}

// [PASS] GOOD: Object pooling
public class BufferPool
{
 private static readonly ArrayPool<byte> _pool = ArrayPool<byte>.Shared;

 public byte[] Rent(int size) => _pool.Rent(size);
 public void Return(byte[] buffer) => _pool.Return(buffer);
}

// [PASS] GOOD: StringBuilder for string concatenation
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
// [PASS] GOOD: Input validation
public class CreateUserRequest
{
 [Required]
 [EmailAddress]
 public required string Email { get; init; }

 [Required]
 [MinLength(8)]
 public required string Password { get; init; }
}

// [PASS] GOOD: Password hashing
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

// [PASS] GOOD: SQL injection prevention with parameterized queries
// Entity Framework Core does this automatically
var users = await _context.Users
 .Where(u => u.Email == email) // Safe - parameterized
 .ToListAsync();

// [FAIL] BAD: Never concatenate SQL
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
