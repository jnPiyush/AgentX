# csharp: Quick Reference, C# Language Version

> MUST read before work involving **quick reference, c# language version**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## Resources

- **Official Docs**: [learn.microsoft.com/dotnet](https://learn.microsoft.com/dotnet)
- **C# Guide**: [learn.microsoft.com/csharp](https://learn.microsoft.com/csharp)
- **ASP.NET Core**: [learn.microsoft.com/aspnet/core](https://learn.microsoft.com/aspnet/core)
- **EF Core**: [learn.microsoft.com/ef/core](https://learn.microsoft.com/ef/core)
- **Testing**: [xunit.net](https://xunit.net), [nunit.org](https://nunit.org)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`scaffold-solution.ps1`](../scripts/scaffold-solution.ps1) | Create .NET solution with API/Core/Infrastructure + xUnit tests | `./scripts/scaffold-solution.ps1 -Name MyApp [-Framework net9.0]` |

## References

- [Async Nullable Di](async-nullable-di.md)
- [Efcore Errors Testing](efcore-errors-testing.md)
- [Logging Perf Security](logging-perf-security.md)