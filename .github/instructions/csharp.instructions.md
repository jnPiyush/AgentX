---
description: 'C# and .NET specific coding instructions for production code.'
applyTo: '**.cs, **.csx'
---

# C# / .NET Instructions

## Code Style

- Use file-scoped namespaces
- Use primary constructors where appropriate (.NET 8+)
- Prefer `record` for DTOs and immutable types
- Use `required` modifier for mandatory properties
- Enable nullable reference types (`<Nullable>enable</Nullable>`)

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Class | PascalCase | `UserService` |
| Interface | IPascalCase | `IUserRepository` |
| Method | PascalCase | `GetUserAsync` |
| Property | PascalCase | `FirstName` |
| Private field | _camelCase | `_userRepository` |
| Parameter | camelCase | `userId` |
| Constant | PascalCase | `MaxRetryCount` |

## Async/Await

- Always use `Async` suffix for async methods
- Use `ConfigureAwait(false)` in library code
- Prefer `ValueTask` for frequently-called methods that often complete synchronously
- Never use `.Result` or `.Wait()` - always await

## Error Handling

```csharp
// [PASS] Catch specific exceptions
try
{
 await ProcessAsync();
}
catch (InvalidOperationException ex) when (ex.Message.Contains("specific"))
{
 _logger.LogWarning(ex, "Expected condition occurred");
 // Handle gracefully
}
catch (Exception ex)
{
 _logger.LogError(ex, "Unexpected error in ProcessAsync");
 throw; // Re-throw, don't swallow
}
```

## Dependency Injection

```csharp
// [PASS] Register services with appropriate lifetimes
services.AddScoped<IUserService, UserService>(); // Per-request
services.AddSingleton<ICacheService, CacheService>(); // Application lifetime
services.AddTransient<IEmailService, EmailService>(); // New instance each time
```

## Documentation

```csharp
/// <summary>
/// Retrieves a user by their unique identifier.
/// </summary>
/// <param name="userId">The unique identifier of the user.</param>
/// <returns>The user if found; otherwise, null.</returns>
/// <exception cref="ArgumentException">Thrown when userId is empty.</exception>
public async Task<User?> GetUserAsync(Guid userId)
```

## Testing

- Use xUnit for unit tests
- Use FluentAssertions for readable assertions
- Use Moq or NSubstitute for mocking
- Follow Arrange-Act-Assert pattern
- Name tests: `MethodName_Scenario_ExpectedResult`

