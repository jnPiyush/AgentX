---
description: 'C# and .NET specific coding instructions for production code.'
applyTo: '**.cs, **.csx'
---

# C# / .NET Instructions

> Auto-loads when editing C# files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/development/csharp/SKILL.md](../skills/development/csharp/SKILL.md)

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

