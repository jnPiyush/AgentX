---
name: "csharp"
description: 'Write production-ready C# and .NET code following modern best practices. Use when building .NET applications, writing async/await code, using Entity Framework Core, implementing dependency injection, configuring nullable reference types, or optimizing C# performance.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["csharp"]
 frameworks: ["dotnet", "aspnet-core"]
 platforms: ["windows", "linux", "macos"]
---

# C# / .NET Development

> **Purpose**: Production-ready C# and .NET development standards for building secure, performant, maintainable applications. 
> **Audience**: Engineers building .NET applications with C#, ASP.NET Core, Entity Framework Core. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) .NET development patterns.

---

## When to Use This Skill

- Building .NET applications with C#
- Writing async/await code patterns
- Using Entity Framework Core for data access
- Implementing dependency injection
- Configuring nullable reference types

## Decision Tree

```
C# Project Decision
+-- Building a web API?
|   +-- REST API? -> ASP.NET Core Minimal API or Controllers
|   +-- gRPC service? -> ASP.NET Core gRPC
+-- Data access needed?
|   +-- Relational DB? -> Entity Framework Core
|   +-- NoSQL / document? -> Azure Cosmos DB SDK
|   +-- Simple queries? -> Dapper
+-- Background processing?
|   +-- Scheduled jobs? -> IHostedService / BackgroundService
|   +-- Message-driven? -> Azure Service Bus + Worker Service
+-- Desktop / cross-platform UI?
|   +-- Cross-platform? -> .NET MAUI
|   +-- Windows only? -> WPF or WinForms
+-- Library / shared code? -> .NET Class Library with NuGet packaging
```

## Prerequisites

- .NET 8+ SDK installed
- C# 12+ language features
- IDE with C# support

## Core Rules

1. **Async All the Way** - Use `async`/`await` throughout the call chain; never call `.Result` or `.Wait()` on tasks
2. **Enable Nullable References** - Set `<Nullable>enable</Nullable>` in `.csproj`; treat all warnings as errors
3. **Constructor Injection** - Use constructor injection with interfaces for all dependencies; avoid service locator pattern
4. **Structured Logging** - Use `ILogger<T>` with message templates (`{UserId}`), not string interpolation
5. **Pass CancellationToken** - Accept and forward `CancellationToken` in all async methods
6. **Catch Specific Exceptions** - Catch the most specific exception type; never catch bare `Exception` without re-throwing
7. **Use Modern C# Features** - Prefer primary constructors, file-scoped namespaces, pattern matching, and raw string literals
8. **Validate Inputs Early** - Validate method arguments at entry points using guard clauses or `ArgumentException`

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **Sync over async** | Using `.Result` or `.Wait()` | Always use `await` |
| **No cancellation** | Long operations can't be cancelled | Pass `CancellationToken` |
| **N+1 queries** | Loading related data in loop | Use `.Include()` for eager loading |
| **Magic strings** | Hardcoded strings everywhere | Use `nameof()` or constants |
| **No null checks** | NullReferenceException | Enable nullable reference types |
| **Poor logging** | Unstructured log messages | Use structured logging with parameters |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deadlock with async code | Use async/await all the way up, never call .Result or .Wait() on async methods |
| EF Core migration errors | Run dotnet ef migrations list to check state, recreate if corrupted |
| Nullable warnings everywhere | Enable Nullable in .csproj, fix warnings incrementally |

## Workflow

1. Confirm framework and project conventions.
2. Define typed contracts and lifetimes.
3. Implement the narrow behavior with async and disposal correctness.
4. Run format/analyzers, build, and focused tests.

## Verification Checklist

- [ ] dotnet build is warning-clean under policy.
- [ ] Focused dotnet test selectors pass.
- [ ] Nullable and cancellation paths are covered.
- [ ] No resource lifetime leak remains.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Quick Reference, C# Language Version](references/details-quick-reference-and-c-language-version.md) - MUST read before work involving quick reference, c# language version.

Existing focused references are reused, not duplicated:

- [C# Async Programming, Nullable Types & DI](references/async-nullable-di.md) - MUST read before applying the focused c# async programming, nullable types & di guidance.
- [Entity Framework Core, Error Handling & Testing](references/efcore-errors-testing.md) - MUST read before applying the focused entity framework core, error handling & testing guidance.
- [C# Logging, Performance & Security](references/logging-perf-security.md) - MUST read before applying the focused c# logging, performance & security guidance.
