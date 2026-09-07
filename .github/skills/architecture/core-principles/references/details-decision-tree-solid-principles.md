# Core Principles & Code Organization Details

This required-read reference preserves complete sections moved from SKILL.md during budget remediation.

## Decision Tree

```
Architecture or code quality concern?
+-- New project setup? -> Apply Clean Architecture layers (Api/Core/Infrastructure)
+-- Class doing too much? -> Apply SRP - split by responsibility
+-- Need to extend behavior? -> Apply OCP - use interfaces, not if/else chains
+-- Deep inheritance tree? -> Favor composition over inheritance
+-- Hard to test? -> Apply DIP - inject abstractions, not concretions
+-- Code duplicated? -> Extract shared logic (DRY), but avoid premature abstraction
+-- Complex solution? -> Simplify (KISS) - can a junior dev understand it?
+-- Building speculative features? -> Stop (YAGNI) - build only what is needed now
```

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

**See Also**: [Testing](..\..\..\development\testing\SKILL.md)

**Last Updated**: February 27, 2026
