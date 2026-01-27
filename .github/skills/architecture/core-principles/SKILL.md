---
name: core-principles
description: 'Fundamental coding principles for production development including SOLID, DRY, KISS, and common design patterns with C# examples.'
---

# Core Principles

> **Purpose**: Fundamental principles guiding production code development.  
> **Focus**: SOLID, DRY, KISS, design patterns.

---

## SOLID Principles

### Single Responsibility (SRP)
Each class has one reason to change.

```csharp
// ❌ Multiple responsibilities
public class User
{
    public string Name { get; set; }
    public void SaveToDatabase() { } // Persistence
    public void SendEmail() { } // Communication
}

// ✅ Single responsibility
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
// ✅ Extend via abstraction
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
// ✅ Derived classes extend, don't break behavior
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
// ❌ Fat interface
public interface IWorker
{
    void Work();
    void Eat();
    void Sleep();
}

// ✅ Segregated interfaces
public interface IWorkable { void Work(); }
public interface IFeedable { void Eat(); }
public interface IRestable { void Sleep(); }
```

### Dependency Inversion (DIP)
Depend on abstractions, not concretions.

```csharp
// ✅ Depend on interface
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
// ❌ Duplication
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

// ✅ Extract common logic
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
// ❌ Overengineered
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

// ✅ Simple
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

## Design Patterns (Common)

### Repository Pattern

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task AddAsync(T entity);
}

public class UserRepository : IRepository<User>
{
    private readonly AppDbContext _context;
    public UserRepository(AppDbContext context) => _context = context;
    
    public async Task<User?> GetByIdAsync(int id) => 
        await _context.Users.FindAsync(id);
}
```

### Factory Pattern

```csharp
public interface IPaymentProcessorFactory
{
    IPaymentProcessor Create(string type);
}

public class PaymentProcessorFactory : IPaymentProcessorFactory
{
    public IPaymentProcessor Create(string type) => type switch
    {
        "credit_card" => new CreditCardProcessor(),
        "paypal" => new PayPalProcessor(),
        _ => throw new ArgumentException("Invalid payment type")
    };
}
```

### Strategy Pattern

```csharp
public interface IPricingStrategy
{
    decimal CalculatePrice(decimal basePrice);
}

public class RegularPricing : IPricingStrategy
{
    public decimal CalculatePrice(decimal basePrice) => basePrice;
}

public class DiscountPricing : IPricingStrategy
{
    public decimal CalculatePrice(decimal basePrice) => basePrice * 0.9m;
}
```

---

## Best Practices

### ✅ DO

- **Follow SOLID** - Especially SRP and DIP
- **Keep functions small** - One thing, well
- **Use meaningful names** - Self-documenting code
- **Favor composition** - Over inheritance
- **Write tests** - Design for testability
- **Refactor regularly** - Improve as you go
- **Document complex logic** - Why, not what

### ❌ DON'T

- **Violate SOLID** - Leads to rigid, fragile code
- **Duplicate code** - Extract to methods/classes
- **Overcomplicate** - Simple solutions first
- **Build unused features** - YAGNI
- **Skip code reviews** - Catch issues early
- **Ignore tech debt** - Pay it down regularly

---

**See Also**: [08-code-organization.md](08-code-organization.md) • [02-testing.md](02-testing.md)

**Last Updated**: January 13, 2026

