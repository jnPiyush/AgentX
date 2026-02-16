# Inline Documentation & Comment Patterns

## Inline Documentation

### When to Document

```
[PASS] DOCUMENT:
 - Public APIs (functions, classes exposed to others)
 - Complex algorithms (why this approach)
 - Non-obvious behavior (edge cases, gotchas)
 - Business rules (why this validation)
 - Workarounds (link to issue/bug)

[FAIL] DON'T DOCUMENT:
 - Obvious code (// increment counter)
 - Implementation details that might change
 - What the code does (code shows that)
```

### Documentation Template

```
Function Documentation Structure:

 Brief one-line description.

 Longer description if needed. Explain the purpose,
 not the implementation.

 Parameters:
 paramName: Description of parameter
 
 Returns:
 Description of return value
 
 Raises/Throws:
 ExceptionType: When this exception is thrown
 
 Example:
 code example showing usage
```

### Examples

```
Good Documentation:

 """
 Calculate shipping cost based on weight and destination.
 
 Uses zone-based pricing with a base rate plus per-kg charge.
 International shipments have additional customs handling fee.
 
 Args:
 weight_kg: Package weight in kilograms (must be positive)
 destination: ISO 3166-1 country code (e.g., "US", "GB")
 
 Returns:
 Shipping cost in USD
 
 Raises:
 ValueError: If weight is negative or zero
 InvalidDestinationError: If country code is not supported
 
 Example:
 >>> calculate_shipping(2.5, "US")
 15.99
 """
```

---

## Comments

### When to Use Comments

```
Use Comments For:

1. WHY, not WHAT
 # Using binary search because list is sorted and frequently queried
 index = binarySearch(sortedList, target)

2. Complex business logic
 # Discount applies only to first-time customers who
 # ordered within 30 days of account creation (PROMO-2024-Q1)
 if isEligibleForNewUserDiscount(user):

3. Warnings and gotchas
 # WARNING: This API has a rate limit of 100 req/min
 # See: https://api.example.com/docs/rate-limits
 
4. TODO with context
 # TODO(ticket-123): Refactor when payment v2 API is available
 
5. References
 # Algorithm from: https://en.wikipedia.org/wiki/Example
```

### Comment Anti-Patterns

```
[FAIL] Redundant Comments:
 i = i + 1 # Increment i by 1

[FAIL] Outdated Comments:
 # Returns the user's email
 function getUserName(): # Actually returns name now

[FAIL] Commented-Out Code:
 # old_method()
 # another_old_method()
 new_method()

[FAIL] Noise Comments:
 ###################################
 # BEGIN USER PROCESSING SECTION #
 ###################################
```

---
