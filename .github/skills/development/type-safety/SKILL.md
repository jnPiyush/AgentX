---
name: type-safety
description: 'Language-agnostic type safety patterns including nullable types, validation, static analysis, and strong typing strategies.'
---

# Type Safety

> **Purpose**: Use type systems to catch errors at compile/analysis time rather than runtime.  
> **Goal**: Prevent null errors, type mismatches, and invalid states.  
> **Note**: For implementation, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Why Type Safety Matters

```
Runtime Error (Bad):
  function getUser(id):
    return database.find(id)  # What type? Nullable?
  
  user = getUser(123)
  print(user.email)  # 💥 NullReferenceException at runtime

Type-Safe (Good):
  function getUser(id: int) -> User | null:
    return database.find(id)
  
  user = getUser(123)
  if user != null:
    print(user.email)  # ✅ Compiler ensures null check
```

---

## Nullable Types

### Concept

Explicitly declare whether a value can be null/None.

```
Type Declarations:
  
  User       - Never null (must have value)
  User?      - Nullable (might be null)
  
Benefits:
  - Compiler/analyzer warns about potential null access
  - Forces explicit null handling
  - Self-documenting code
```

### Null Handling Patterns

```
Pattern 1: Null Check
  user = findUser(id)
  if user != null:
    return user.email
  else:
    throw NotFoundException()

Pattern 2: Default Value
  user = findUser(id)
  return user?.email ?? "unknown@example.com"

Pattern 3: Early Return
  user = findUser(id)
  if user == null:
    return NotFound()
  
  # user is non-null from here
  return Ok(user)

Pattern 4: Required (Fail Fast)
  user = findUser(id) ?? throw NotFoundException(id)
  return user.email  # Guaranteed non-null
```

---

## Type Annotations

### Function Signatures

```
Fully Typed Function:

  function calculateTotal(
    items: List<OrderItem>,   # Input type
    discountPercent: decimal, # Primitive type
    taxRate: decimal?         # Nullable parameter
  ) -> decimal:               # Return type
    ...

Benefits:
  - Clear contract
  - IDE autocomplete
  - Compile-time validation
  - Documentation
```

### Data Types

```
Primitive Types:
  int, float, decimal, string, bool, datetime

Collection Types:
  List<T>           # Ordered, duplicates allowed
  Set<T>            # Unique values
  Map<K, V>         # Key-value pairs
  Array<T>          # Fixed size

Custom Types:
  User              # Class/struct
  OrderStatus       # Enum
  Result<T, E>      # Union/discriminated type
```

---

## Value Objects & DTOs

### Strongly-Typed IDs

```
Problem: Primitive Obsession
  function getUser(userId: int): User
  function getOrder(orderId: int): Order
  
  # Easy to mix up!
  getUser(orderId)  # Compiles but wrong!

Solution: Type-Safe IDs
  type UserId = NewType(int)
  type OrderId = NewType(int)
  
  function getUser(userId: UserId): User
  function getOrder(orderId: OrderId): Order
  
  getUser(orderId)  # ❌ Type error!
```

### Data Transfer Objects

```
DTO Pattern:

  class CreateUserRequest:
    email: string (required)
    name: string (required)
    age: int? (optional)

  class UserResponse:
    id: int
    email: string
    name: string
    createdAt: datetime

Benefits:
  - Clear API contracts
  - Validation rules
  - Serialization/deserialization
  - Separate from domain models
```

---

## Enums and Union Types

### Enums for Fixed Values

```
Enum Definition:
  enum OrderStatus:
    PENDING
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED

Usage:
  order.status = OrderStatus.SHIPPED
  
  match order.status:
    PENDING -> "Waiting for payment"
    PROCESSING -> "Being prepared"
    SHIPPED -> "On the way"
    ...

Benefits:
  - No magic strings
  - Compiler validates all cases handled
  - Refactor-safe
```

### Union Types / Discriminated Unions

```
Result Type:
  type Result<T> = Success<T> | Failure

  class Success<T>:
    value: T

  class Failure:
    error: string

Usage:
  function validateUser(email: string) -> Result<User>:
    if not isValidEmail(email):
      return Failure("Invalid email format")
    
    user = findUser(email)
    if user == null:
      return Failure("User not found")
    
    return Success(user)

Handling:
  result = validateUser(email)
  match result:
    Success(user) -> processUser(user)
    Failure(error) -> showError(error)
```

---

## Validation

### Validation at Boundaries

```
Validation Points:
  
  External Input → [VALIDATE] → Internal Processing
  
  1. API Request validation
  2. Configuration validation
  3. Database result validation
  4. External service response validation
```

### Validation Patterns

```
Pattern 1: Declarative Validation
  class CreateUserRequest:
    @Required
    @Email
    email: string
    
    @Required
    @Length(min=2, max=100)
    name: string
    
    @Range(min=0, max=150)
    age: int?

Pattern 2: Validation Function
  function validate(request: CreateUserRequest) -> List<Error>:
    errors = []
    
    if not isValidEmail(request.email):
      errors.add("Invalid email format")
    
    if request.name.length < 2:
      errors.add("Name must be at least 2 characters")
    
    return errors

Pattern 3: Parse, Don't Validate
  # Instead of validating a string is an email
  # Parse it into an Email type that can only be valid
  
  class Email:
    private value: string
    
    static function parse(input: string) -> Email | Error:
      if not isValidEmail(input):
        return Error("Invalid email")
      return Email(input)
```

---

## Static Analysis

### What Static Analysis Catches

```
Type Errors:
  string name = 123        # Type mismatch
  user.email               # Null reference (user might be null)
  
Dead Code:
  if false:
    doSomething()          # Unreachable
  
Unused Variables:
  user = getUser()         # Never used

Security Issues:
  query = "SELECT * FROM users WHERE id = " + userInput  # SQL injection
```

### Configuration

```
Static Analysis Rules:

Errors (Must Fix):
  - Null dereference without check
  - Type mismatches
  - Unreachable code
  - SQL injection patterns

Warnings (Should Fix):
  - Unused variables
  - Deprecated API usage
  - Missing documentation
  - Complex methods (cyclomatic complexity)

Info (Consider):
  - Naming conventions
  - Code style
```

---

## Generics

### Generic Functions

```
Without Generics:
  function first(items: List<int>) -> int
  function first(items: List<string>) -> string
  function first(items: List<User>) -> User
  # Duplication!

With Generics:
  function first<T>(items: List<T>) -> T | null:
    if items.isEmpty():
      return null
    return items[0]

Usage:
  first([1, 2, 3])           # Returns int
  first(["a", "b", "c"])     # Returns string
  first([user1, user2])      # Returns User
```

### Generic Constraints

```
Unconstrained:
  function process<T>(item: T)     # T can be anything

Constrained:
  function process<T: Serializable>(item: T)  # T must be Serializable
  function compare<T: Comparable>(a: T, b: T) # T must be Comparable
  function save<T: Entity>(item: T)           # T must extend Entity
```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Annotate everything** | Types on all function parameters and returns |
| **Enable strict mode** | Turn on all null safety and type checks |
| **Avoid `any`/`object`** | Use specific types instead of escape hatches |
| **Validate at boundaries** | Check external input, trust internal data |
| **Use enums** | Replace magic strings/numbers with enums |
| **Prefer immutability** | Use readonly/final where possible |
| **Run analyzers in CI** | Fail builds on type errors |
| **Document nullable intent** | Explicit `?` for nullable, no `?` for required |

---

## Type Safety Tools

| Language | Tools |
|----------|-------|
| **C#** | Roslyn analyzers, nullable reference types, StyleCop |
| **Python** | mypy, pyright, pydantic |
| **TypeScript** | tsc strict mode, ESLint |
| **Java** | SpotBugs, Error Prone, NullAway |
| **Go** | go vet, staticcheck |

---

**See Also**: [Testing](../testing/SKILL.md) • [C# Development](../csharp/SKILL.md) • [Python Development](../python/SKILL.md)

