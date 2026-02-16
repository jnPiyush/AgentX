# Common Design Patterns

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
