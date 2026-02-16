# Value Objects, Enums & Validation Patterns

## Value Objects & DTOs

### Strongly-Typed IDs

```
Problem: Primitive Obsession
 function getUser(userId: int): User
 function getOrder(orderId: int): Order
 
 # Easy to mix up!
 getUser(orderId) # Compiles but wrong!

Solution: Type-Safe IDs
 type UserId = NewType(int)
 type OrderId = NewType(int)
 
 function getUser(userId: UserId): User
 function getOrder(orderId: OrderId): Order
 
 getUser(orderId) # [FAIL] Type error!
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
 
 External Input -> [VALIDATE] -> Internal Processing
 
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
