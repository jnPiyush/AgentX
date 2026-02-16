# Static Analysis & Generics Patterns

## Static Analysis

### What Static Analysis Catches

```
Type Errors:
 string name = 123 # Type mismatch
 user.email # Null reference (user might be null)
 
Dead Code:
 if false:
 doSomething() # Unreachable
 
Unused Variables:
 user = getUser() # Never used

Security Issues:
 query = "SELECT * FROM users WHERE id = " + userInput # SQL injection
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
 first([1, 2, 3]) # Returns int
 first(["a", "b", "c"]) # Returns string
 first([user1, user2]) # Returns User
```

### Generic Constraints

```
Unconstrained:
 function process<T>(item: T) # T can be anything

Constrained:
 function process<T: Serializable>(item: T) # T must be Serializable
 function compare<T: Comparable>(a: T, b: T) # T must be Comparable
 function save<T: Entity>(item: T) # T must extend Entity
```

---
