---
description: 'C# and .NET specific coding instructions for production code.'
applyTo: '**.cs, **.csx'
---

# C# / .NET Instructions

> Auto-loads when editing C# files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/languages/csharp/SKILL.md](../skills/languages/csharp/SKILL.md)

## Key Rules

- Use file-scoped namespaces
- Use primary constructors where appropriate (.NET 8+)
- Prefer `record` for DTOs and immutable types
- Enable nullable reference types (`<Nullable>enable</Nullable>`)
- PascalCase for classes/methods/properties, _camelCase for private fields
- Always use `Async` suffix for async methods
- Use `ConfigureAwait(false)` in library code
- Never use `.Result` or `.Wait()` -- always await
- Catch specific exceptions, re-throw with `throw;`
- xUnit for tests, Arrange-Act-Assert pattern
- Name tests: `MethodName_Scenario_ExpectedResult`

## Critical Rules (Embedded -- Always Active)

### Security
- Validate/sanitize ALL inputs at controller/endpoint boundaries
- Use EF Core parameterized queries or Dapper `@param` syntax -- NEVER string concatenation
- Secrets via `IConfiguration` + Azure Key Vault -- NEVER hardcode
- Use `[Authorize]` attribute on all non-public endpoints

### Testing
- 80%+ code coverage required
- Pyramid: 70% unit (`xUnit`), 20% integration (`WebApplicationFactory`), 10% e2e
- AAA pattern (Arrange-Act-Assert) in every test
- Use `Verify` or `FluentAssertions` for readable assertions

### Error Handling
- Catch specific exceptions (`InvalidOperationException`, `ArgumentNullException`, etc.)
- Re-throw with `throw;` (not `throw ex;`) to preserve stack trace
- Use `ILogger<T>` with structured logging and correlation IDs
- Implement `IAsyncDisposable` for async resource cleanup

