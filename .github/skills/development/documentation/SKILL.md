---
name: documentation
description: 'Language-agnostic documentation patterns including inline docs, README structure, API documentation, and code comments best practices.'
---

# Documentation

> **Purpose**: Write clear, maintainable documentation for code and APIs.  
> **Goal**: Self-documenting code, useful comments, comprehensive READMEs.  
> **Note**: For implementation, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Documentation Hierarchy

```
Documentation Pyramid:

        /\
       /API\        External API docs (OpenAPI/Swagger)
      /------\
     / README \     Project documentation
    /----------\
   / Inline Docs\   Function/class documentation
  /--------------\
 /  Code Quality  \ Self-documenting code (naming, structure)
/------------------\

Best Code = Minimal comments needed
```

---

## Self-Documenting Code

### Code Should Explain WHAT

```
❌ Bad: Needs comment to understand
  # Check if user can access
  if u.r == 1 or u.r == 2:
    return True

✅ Good: Self-explanatory
  if user.role == Role.ADMIN or user.role == Role.MODERATOR:
    return True

✅ Better: Extract to function
  if user.hasModeratorPermissions():
    return True
```

### Names Should Be Descriptive

```
Variables:
  ❌ d, tmp, data, x
  ✅ daysSinceLastLogin, userCount, orderTotal

Functions:
  ❌ process(), handle(), do()
  ✅ calculateShippingCost(), validateEmailFormat(), sendWelcomeEmail()

Classes:
  ❌ Manager, Handler, Processor, Helper
  ✅ OrderRepository, EmailValidator, PaymentGateway
```

---

## Inline Documentation

### When to Document

```
✅ DOCUMENT:
  - Public APIs (functions, classes exposed to others)
  - Complex algorithms (why this approach)
  - Non-obvious behavior (edge cases, gotchas)
  - Business rules (why this validation)
  - Workarounds (link to issue/bug)

❌ DON'T DOCUMENT:
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
❌ Redundant Comments:
  i = i + 1  # Increment i by 1

❌ Outdated Comments:
  # Returns the user's email
  function getUserName():  # Actually returns name now

❌ Commented-Out Code:
  # old_method()
  # another_old_method()
  new_method()

❌ Noise Comments:
  ###################################
  # BEGIN USER PROCESSING SECTION   #
  ###################################
```

---

## README Structure

### Essential Sections

```markdown
# Project Name

One-paragraph description of what this project does.

## Features

- Feature 1: Brief description
- Feature 2: Brief description

## Quick Start

Minimal steps to get running:

```bash
git clone <repo>
cd project
./setup.sh
./run.sh
```

## Installation

### Prerequisites

- Requirement 1 (version)
- Requirement 2 (version)

### Steps

1. Install dependencies
2. Configure environment
3. Run migrations

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | Database connection | localhost |

## Usage

Show common use cases with code examples.

## API Reference

Link to API documentation or brief overview.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE)
```

### README Best Practices

```
✅ DO:
  - Start with what the project does
  - Show working code examples
  - Keep installation steps minimal
  - Include troubleshooting for common issues
  - Update when features change

❌ DON'T:
  - Start with badges and shields
  - Assume knowledge of your stack
  - Skip the "why" of the project
  - Include outdated examples
```

---

## API Documentation

### OpenAPI/Swagger

```
API Documentation Should Include:

Endpoint Information:
  - HTTP method and path
  - Description of what it does
  - Authentication requirements

Request:
  - Path parameters
  - Query parameters
  - Request body schema
  - Example request

Response:
  - Status codes and meanings
  - Response body schema
  - Example responses

Errors:
  - Error codes
  - Error messages
  - How to handle
```

### API Documentation Example

```yaml
/users/{userId}:
  get:
    summary: Get user by ID
    description: |
      Retrieves detailed information about a specific user.
      Requires authentication. Users can only access their own data
      unless they have admin role.
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: integer
        description: Unique user identifier
    responses:
      200:
        description: User found
        content:
          application/json:
            example:
              id: 123
              email: user@example.com
              name: John Doe
      404:
        description: User not found
      403:
        description: Access denied
```

---

## Architecture Documentation

### Architecture Decision Records (ADRs)

```
ADR Template:

# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a database that supports complex queries, transactions,
and can handle our expected load of 10K requests/second.

## Decision
We will use PostgreSQL 16 as our primary database.

## Consequences
### Positive
- ACID compliance
- Rich query capabilities
- Strong community support

### Negative
- Requires more operational expertise than managed NoSQL
- Vertical scaling limitations

## Alternatives Considered
- MongoDB: Rejected due to transaction requirements
- MySQL: PostgreSQL has better JSON support
```

### When to Write ADRs

```
Write ADR For:
  - Technology choices (database, framework, cloud provider)
  - Architecture patterns (microservices vs monolith)
  - Security decisions (auth strategy, encryption)
  - Integration approaches (sync vs async)
  - Breaking changes to existing patterns
```

---

## Documentation Tools

| Type | Tools |
|------|-------|
| **API Docs** | OpenAPI/Swagger, Postman, Redoc |
| **Code Docs** | DocFX, Sphinx, JSDoc, Typedoc |
| **Architecture** | C4 Model, Mermaid, PlantUML |
| **Wiki/Guides** | Notion, Confluence, GitBook, MkDocs |
| **Diagrams** | Draw.io, Lucidchart, Excalidraw |

---

## Best Practices Summary

| Practice | Description |
|----------|-------------|
| **Code first** | Write self-documenting code before adding comments |
| **Document why** | Explain intent, not mechanics |
| **Keep updated** | Wrong docs are worse than no docs |
| **Examples** | Show, don't just tell |
| **Audience** | Write for the reader, not yourself |
| **Minimal** | Document what's needed, no more |
| **Accessible** | Store docs near the code |
| **Versioned** | Docs in repo, not external wikis |

---

**See Also**: [API Design](.github/skills/architecture/api-design/SKILL.md) • [C# Development](../csharp/SKILL.md) • [Python Development](../python/SKILL.md)
