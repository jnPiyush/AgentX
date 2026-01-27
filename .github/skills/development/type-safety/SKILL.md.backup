---
name: type-safety
description: 'Leverage type systems to catch errors early with nullable reference types, static analysis, and strong typing patterns in C# and TypeScript.'
---

# Type Safety

> **Purpose**: Use type systems to catch errors early and improve code quality.

---

## C# Type System

```csharp
using System.Collections.Generic;
using System.Linq;

#nullable enable

// Basic types with null safety
public string Greet(string name)
{
    return $"Hello, {name}";
}

// Collections with type safety
public Dictionary<string, int> ProcessItems(List<int> items)
{
    return new Dictionary<string, int>
    {
        { "total", items.Sum() },
        { "count", items.Count }
    };
}

// Nullable reference types
public User? FindUser(int userId)
{
    return db.Query<User>().FirstOrDefault(u => u.Id == userId);
}

// Generics with constraints
public class Repository<T> where T : class
{
    public T? FindById(int id)
    {
        // Implementation
        return default(T);
    }
    
    public async Task<T?> FindByIdAsync(int id)
    {
        // Async implementation
        return await Task.FromResult<T?>(default(T));
    }
}

// Record types for immutable data
public record User(int Id, string Email, string Name, int? Age = null);

// Value types vs reference types
public struct Point
{
    public int X { get; init; }
    public int Y { get; init; }
}
```

---

## Example: DTO + enum + typed client

```csharp
using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public sealed record UserDto(int Id, string Email, string Name, int? Age = null);

public enum UserRole
{
    Admin,
    User
}

/// <summary>
/// Typed HTTP client; prefer registering via IHttpClientFactory.
/// </summary>
public sealed class UsersClient
{
    private readonly HttpClient _httpClient;

    public UsersClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<UserDto> FetchUserAsync(int id, CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await _httpClient.GetAsync($"/api/users/{id}", cancellationToken);
        response.EnsureSuccessStatusCode();

        string json = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<UserDto>(json)
            ?? throw new InvalidOperationException("Failed to deserialize user");
    }
}
```

---

## Advanced Type Safety Features

```csharp
// Pattern matching with type checks
public decimal CalculateArea(object shape)
{
    return shape switch
    {
        Circle c => Math.PI * c.Radius * c.Radius,
        Rectangle r => r.Width * r.Height,
        Square s => s.Side * s.Side,
        null => throw new ArgumentNullException(nameof(shape)),
        _ => throw new ArgumentException("Unknown shape", nameof(shape))
    };
}

// Non-nullable reference types enforcement
#nullable enable
public class UserService
{
    private readonly IUserRepository _repository;  // Must be initialized
    
    public UserService(IUserRepository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }
    
    public User GetUser(string? email)  // Nullable parameter
    {
        if (email is null)
            throw new ArgumentNullException(nameof(email));
            
        return _repository.FindByEmail(email) 
            ?? throw new KeyNotFoundException($"User with email {email} not found");
    }
}

// Discriminated unions using abstract classes
public abstract record Result<T>
{
    public record Success(T Value) : Result<T>;
    public record Failure(string Error) : Result<T>;
}

// Usage
public Result<User> ValidateUser(string email, string password)
{
    if (string.IsNullOrWhiteSpace(email))
        return new Result<User>.Failure("Email is required");
        
    var user = _repository.FindByEmail(email);
    return user is not null 
        ? new Result<User>.Success(user)
        : new Result<User>.Failure("User not found");
}
```

---

## Type Checking

```bash
# C# compiler performs type checking at build time
dotnet build

# Enable nullable reference types in .csproj
# <Nullable>enable</Nullable>

# Treat warnings as errors for stricter checking
dotnet build /p:TreatWarningsAsErrors=true

# Run code analysis
dotnet build /p:EnableNETAnalyzers=true /p:AnalysisLevel=latest
```

---

## Configuration in .csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisLevel>latest</AnalysisLevel>
  </PropertyGroup>
</Project>
```

---

**Related Skills**:
- [Core Principles](01-core-principles.md)
- [Testing](02-testing.md)

