---
name: "core-principles"
description: 'Apply fundamental coding principles (SOLID, DRY, KISS) and structure projects for maintainability with clean architecture and separation of concerns. Use when refactoring, reviewing patterns, setting up project structure, or organizing modules.'
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2026-02-27"
compatibility:
 languages: ["csharp"]
---

# Core Principles & Code Organization

> **Purpose**: Fundamental principles guiding production code development and project structure. 
> **Focus**: SOLID, DRY, KISS, design patterns, project organization.

---

## When to Use This Skill

- Reviewing code for SOLID principle compliance
- Refactoring code for maintainability
- Choosing appropriate design patterns
- Teaching or evaluating engineering standards
- Setting up a new project structure
- Refactoring monolithic codebases
- Implementing dependency injection
- Organizing modules for team collaboration
- Choosing between architectural patterns

## Prerequisites

- Basic OOP programming knowledge

## SOLID Principles

### Single Responsibility (SRP)
Each class has one reason to change.

```csharp
// [FAIL] Multiple responsibilities
public class User
{
 public string Name { get; set; }
 public void SaveToDatabase() { } // Persistence
 public void SendEmail() { } // Communication
}

// [PASS] Single responsibility
public class User
{
 public string Name { get; set; }
}
public class UserRepository
{
 public void Save(User user) { }
}
public class EmailService
{
 public void SendEmail(User user) { }
}
```

### Open/Closed (OCP)
Open for extension, closed for modification.

```csharp
// [PASS] Extend via abstraction
public interface IPaymentProcessor
{
 Task<PaymentResult> ProcessAsync(decimal amount);
}

public class CreditCardProcessor : IPaymentProcessor { }
public class PayPalProcessor : IPaymentProcessor { }

public class PaymentService
{
 public async Task ProcessPaymentAsync(IPaymentProcessor processor, decimal amount)
 {
 return await processor.ProcessAsync(amount);
 }
}
```

### Liskov Substitution (LSP)
Subtypes must be substitutable for base types.

```csharp
// [PASS] Derived classes extend, don't break behavior
public abstract class Bird
{
 public abstract void Move();
}

public class Sparrow : Bird
{
 public override void Move() => Fly();
}

public class Penguin : Bird
{
 public override void Move() => Walk(); // Different but valid
}
```

### Interface Segregation (ISP)
Many specific interfaces > one general interface.

```csharp
// [FAIL] Fat interface
public interface IWorker
{
 void Work();
 void Eat();
 void Sleep();
}

// [PASS] Segregated interfaces
public interface IWorkable { void Work(); }
public interface IFeedable { void Eat(); }
public interface IRestable { void Sleep(); }
```

### Dependency Inversion (DIP)
Depend on abstractions, not concretions.

```csharp
// [PASS] Depend on interface
public class OrderService
{
 private readonly IOrderRepository _repository;
 
 public OrderService(IOrderRepository repository)
 {
 _repository = repository;
 }
}
```

---

## DRY (Don't Repeat Yourself)

```csharp
// [FAIL] Duplication
public class UserService
{
 public User GetUser(int id)
 {
 var conn = new SqlConnection(connectionString);
 conn.Open();
 // ... query logic
 }
 
 public Order GetOrder(int id)
 {
 var conn = new SqlConnection(connectionString);
 conn.Open();
 // ... query logic
 }
}

// [PASS] Extract common logic
public abstract class BaseRepository
{
 protected SqlConnection GetConnection()
 {
 var conn = new SqlConnection(connectionString);
 conn.Open();
 return conn;
 }
}
```

---

## KISS (Keep It Simple, Stupid)

```csharp
// [FAIL] Overengineered
public class UserValidator
{
 public bool Validate(User user)
 {
 var strategy = ValidatorStrategyFactory
 .CreateStrategy(user.UserType)
 .GetValidationChain()
 .Execute(new ValidationContext(user));
 return strategy.IsValid;
 }
}

// [PASS] Simple
public class UserValidator
{
 public bool Validate(User user)
 {
 return !string.IsNullOrEmpty(user.Email) &&
 user.Email.Contains("@") &&
 user.Age >= 13;
 }
}
```

---

## YAGNI (You Aren't Gonna Need It)

Don't build features "just in case". Build what's needed now.

---

## Best Practices

### [PASS] DO

- **Follow SOLID** - Especially SRP and DIP
- **Keep functions small** - One thing, well
- **Use meaningful names** - Self-documenting code
- **Favor composition** - Over inheritance
- **Write tests** - Design for testability
- **Refactor regularly** - Improve as you go
- **Document complex logic** - Why, not what

### [FAIL] DON'T

- **Violate SOLID** - Leads to rigid, fragile code
- **Duplicate code** - Extract to methods/classes
- **Overcomplicate** - Simple solutions first
- **Build unused features** - YAGNI
- **Skip code reviews** - Catch issues early
- **Ignore tech debt** - Pay it down regularly

---

## Code Organization

> Merged from code-organization skill. Structure projects for clarity, maintainability, and scalability.

### Organization Decision Tree

```
Code organization concern?
+- Starting new project? -> Use standard project structure template
+- File getting too long? -> Extract classes per Single Responsibility
+- Unclear naming? -> Apply naming conventions (PascalCase types, camelCase locals, _prefix privates)
+- Deep nesting? -> Flatten with early returns, extract methods
+- Hard to find code? -> Reorganize by namespace/feature grouping
- Circular dependencies? -> Apply Dependency Inversion, introduce interfaces
```

### C# Project Structure

```
src/
+-- MyApp.Api/           # Entry point, controllers, middleware
+-- MyApp.Core/          # Domain models, interfaces, business logic
+-- MyApp.Infrastructure/ # Data access, external services
+-- MyApp.Shared/        # Cross-cutting concerns, utilities
tests/
+-- MyApp.Api.Tests/
+-- MyApp.Core.Tests/
+-- MyApp.Infrastructure.Tests/
```

### Single Responsibility Examples

```csharp
// [FAIL] Multiple responsibilities
public class UserService
{
    public User CreateUser(string email) { /* ... */ }
    public void SendWelcomeEmail(User user) { /* ... */ }
    public string GenerateReport() { /* ... */ }
}

// [PASS] Single responsibility each
public class UserService
{
    public User CreateUser(string email) { /* ... */ }
}

public class NotificationService
{
    public void SendWelcomeEmail(User user) { /* ... */ }
}

public class UserReportService
{
    public string GenerateReport() { /* ... */ }
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| **Class** | PascalCase | `OrderService` |
| **Interface** | I + PascalCase | `IOrderRepository` |
| **Method** | PascalCase | `GetOrderById()` |
| **Property** | PascalCase | `OrderDate` |
| **Local variable** | camelCase | `orderCount` |
| **Private field** | _camelCase | `_orderRepository` |
| **Constant** | PascalCase | `MaxRetryCount` |

### Code Organization Troubleshooting

| Issue | Solution |
|-------|----------|
| File over 500 lines | Split into partial classes or extract helper classes |
| Too many constructor parameters | Apply facade pattern or restructure dependencies |
| Feature code scattered | Reorganize by feature folders instead of technical layers |

---

**See Also**: [Testing](../../development/testing/SKILL.md)

**Last Updated**: February 27, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Over-engineering with patterns | Apply YAGNI - only use patterns when complexity warrants them |
| DRY violation detected | Extract shared logic into a utility method or base class |

## References

- [Design Patterns](references/design-patterns.md)