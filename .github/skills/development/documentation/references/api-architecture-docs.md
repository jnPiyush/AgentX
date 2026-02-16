# API & Architecture Documentation Patterns

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
