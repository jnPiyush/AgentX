# type-safety: Why Type Safety Matters through Type Safety Tools

> MUST read before work involving **why type safety matters through type safety tools**. This reference preserves complete source guidance relocated for context-budget compliance.

## Why Type Safety Matters

```
Runtime Error (Bad):
 function getUser(id):
 return database.find(id) # What type? Nullable?
 
 user = getUser(123)
 print(user.email) # NullReferenceException at runtime

Type-Safe (Good):
 function getUser(id: int) -> User | null:
 return database.find(id)
 
 user = getUser(123)
 if user != null:
 print(user.email) # [PASS] Compiler ensures null check
```

---

## Nullable Types

### Concept

Explicitly declare whether a value can be null/None.

```
Type Declarations:
 
 User - Never null (must have value)
 User? - Nullable (might be null)
 
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
 return user.email # Guaranteed non-null
```

---

## Type Annotations

### Function Signatures

```
Fully Typed Function:

 function calculateTotal(
 items: List<OrderItem>, # Input type
 discountPercent: decimal, # Primitive type
 taxRate: decimal? # Nullable parameter
 ) -> decimal: # Return type
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
 List<T> # Ordered, duplicates allowed
 Set<T> # Unique values
 Map<K, V> # Key-value pairs
 Array<T> # Fixed size

Custom Types:
 User # Class/struct
 OrderStatus # Enum
 Result<T, E> # Union/discriminated type
```

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

**See Also**: [Testing](../../testing/SKILL.md) - [C# Development](../../../languages/csharp/SKILL.md) - [Python Development](../../../languages/python/SKILL.md)

## References

- [Value Objects Enums Validation](value-objects-enums-validation.md)
- [Static Analysis Generics](static-analysis-generics.md)