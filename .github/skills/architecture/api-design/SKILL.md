---
name: api-design
description: 'Language-agnostic REST API design with proper versioning, pagination, error handling, rate limiting, and documentation best practices.'
---

# API Design

> **Purpose**: Design robust, maintainable, and user-friendly REST APIs.  
> **Focus**: Resource naming, HTTP methods, status codes, versioning, documentation.  
> **Note**: Language-agnostic patterns applicable to any tech stack.

---

## RESTful Conventions

### Resource Naming

```
✅ Good:
GET    /api/v1/users              # List users
POST   /api/v1/users              # Create user
GET    /api/v1/users/{id}         # Get specific user
PUT    /api/v1/users/{id}         # Update user (full)
PATCH  /api/v1/users/{id}         # Update user (partial)
DELETE /api/v1/users/{id}         # Delete user

GET    /api/v1/users/{id}/orders  # Get user's orders (nested)
POST   /api/v1/users/{id}/orders  # Create order for user

❌ Bad:
GET    /api/v1/get_users
POST   /api/v1/create_user
GET    /api/v1/user_detail?id=123
POST   /api/v1/users/delete/{id}  # Use DELETE method instead
```

### Resource Naming Rules

- Use nouns, not verbs (users, not getUsers)
- Use plural form (users, not user)
- Use kebab-case for multi-word resources (order-items)
- Keep URLs lowercase
- Use nesting for relationships (users/{id}/orders)
- Limit nesting to 2 levels maximum

---

## HTTP Methods

### Standard Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| **GET** | Retrieve resource(s) | Yes | Yes |
| **POST** | Create new resource | No | No |
| **PUT** | Replace entire resource | Yes | No |
| **PATCH** | Partial update | No | No |
| **DELETE** | Remove resource | Yes | No |
| **HEAD** | Get metadata only | Yes | Yes |
| **OPTIONS** | Get allowed methods | Yes | Yes |

**Idempotent**: Multiple identical requests have same effect as single request  
**Safe**: Read-only, doesn't modify server state

### Method Usage Examples

```
# GET - Retrieve
GET /api/v1/users/123
Response: 200 OK
{
  "id": 123,
  "email": "user@example.com",
  "name": "John Doe"
}

# POST - Create
POST /api/v1/users
Body: {"email": "new@example.com", "name": "New User"}
Response: 201 Created
Location: /api/v1/users/124

# PUT - Full replacement
PUT /api/v1/users/123
Body: {"email": "updated@example.com", "name": "Updated Name"}
Response: 200 OK

# PATCH - Partial update
PATCH /api/v1/users/123
Body: {"name": "New Name"}  # Only updates name
Response: 200 OK

# DELETE - Remove
DELETE /api/v1/users/123
Response: 204 No Content
```

---

## HTTP Status Codes

### Success Codes (2xx)

```
200 OK                  # Successful GET, PUT, PATCH
201 Created             # Successful POST (resource created)
202 Accepted            # Request accepted, processing async
204 No Content          # Successful DELETE (no response body)
```

### Client Error Codes (4xx)

```
400 Bad Request         # Invalid request syntax, validation error
401 Unauthorized        # Authentication required or failed
403 Forbidden           # Authenticated but insufficient permissions
404 Not Found           # Resource doesn't exist
405 Method Not Allowed  # HTTP method not supported
409 Conflict            # Resource conflict (e.g., duplicate email)
422 Unprocessable       # Validation error (semantic issue)
429 Too Many Requests   # Rate limit exceeded
```

### Server Error Codes (5xx)

```
500 Internal Server Error  # Unhandled server error
502 Bad Gateway           # Invalid response from upstream server
503 Service Unavailable   # Server temporarily unavailable
504 Gateway Timeout       # Upstream server timeout
```

---

## Response Format

### Success Response

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "metadata": {
    "timestamp": "2026-01-27T12:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "age",
        "message": "Must be between 18 and 120"
      }
    ]
  },
  "metadata": {
    "requestId": "abc-123-xyz",
    "timestamp": "2026-01-27T12:00:00Z"
  }
}
```

### Collection Response

```json
{
  "status": "success",
  "data": [
    {"id": 1, "name": "User 1"},
    {"id": 2, "name": "User 2"}
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 100,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

## API Versioning

### URL Versioning (Recommended)

```
GET /api/v1/users
GET /api/v2/users  # New version
```

**Pros:**
- Clear and explicit
- Easy to route
- Browser-friendly
- Cacheable

### Header Versioning

```
GET /api/users
Accept: application/vnd.myapi.v1+json
```

**Pros:**
- Clean URLs
- More RESTful
- Supports multiple versions

### Versioning Strategy

```
Version Lifecycle:
  v1 (Stable)     → Fully supported
  v2 (Current)    → Recommended, default
  v3 (Preview)    → Beta, may change
  
Deprecation:
  1. Announce deprecation (6-12 months notice)
  2. Add deprecation warning header
  3. Document migration guide
  4. Sunset old version
```

---

## Pagination

### Offset-Based Pagination

```
GET /api/v1/users?page=2&pageSize=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

**Pros**: Simple, intuitive  
**Cons**: Slow for large offsets, inconsistent results if data changes

### Cursor-Based Pagination

```
GET /api/v1/users?limit=20&cursor=abc123

Response:
{
  "data": [...],
  "pagination": {
    "nextCursor": "xyz789",
    "hasMore": true
  }
}
```

**Pros**: Fast for large datasets, consistent results  
**Cons**: Can't jump to specific page

---

## Filtering, Sorting, Searching

### Filtering

```
GET /api/v1/users?status=active&role=admin
GET /api/v1/products?minPrice=10&maxPrice=100
GET /api/v1/orders?createdAfter=2024-01-01
```

### Sorting

```
GET /api/v1/users?sort=createdAt:desc
GET /api/v1/products?sort=price:asc,name:asc  # Multi-column
```

### Searching

```
GET /api/v1/users?q=john
GET /api/v1/products?search=laptop&category=electronics
```

### Field Selection (Sparse Fieldsets)

```
GET /api/v1/users?fields=id,email,name
# Only returns specified fields
```

---

## Rate Limiting

### Rate Limit Headers

```
HTTP Response Headers:
  X-RateLimit-Limit: 1000       # Total requests allowed
  X-RateLimit-Remaining: 500    # Requests remaining
  X-RateLimit-Reset: 1642531200 # Unix timestamp when limit resets
  Retry-After: 3600             # Seconds until retry allowed (on 429)
```

### Rate Limit Strategy

```
Rate Limiting Tiers:
  Anonymous:    100 requests/hour
  Authenticated: 1000 requests/hour
  Premium:      10000 requests/hour
```

---

## CORS Configuration

### CORS Headers

```
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400  # Cache preflight for 24 hours
```

### Preflight Request Handling

```
OPTIONS /api/v1/users
Response: 204 No Content
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

---

## Authentication & Authorization

### Bearer Token Authentication

```
Request:
POST /api/v1/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### API Key Authentication

```
Request:
GET /api/v1/users
X-API-Key: abc123xyz789
```

### Authorization Patterns

```
# Check permissions in request
if not user.hasPermission("users:write"):
    return 403 Forbidden
    
# Resource ownership check
if resource.ownerId != currentUser.id and not currentUser.isAdmin():
    return 403 Forbidden
```

---

## Idempotency

### Idempotency Keys

```
POST /api/v1/payments
Idempotency-Key: unique-key-123
Body: {"amount": 100, "currency": "USD"}

# If same key sent again, returns original response
# Prevents duplicate charges
```

### Safe Retry Pattern

```
Client retries on network failure:
  1. Include Idempotency-Key in request
  2. Server stores key + response
  3. If key seen again, return stored response
  4. Prevents duplicate operations
```

---

## API Documentation

### OpenAPI/Swagger Specification

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List all users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
        name:
          type: string
```

### Documentation Best Practices

- ✅ Document all endpoints
- ✅ Include request/response examples
- ✅ Document error responses
- ✅ Provide authentication details
- ✅ Include rate limiting info
- ✅ Link to SDK/client libraries
- ✅ Keep docs up-to-date

---

## Content Negotiation

### Request Format

```
POST /api/v1/users
Content-Type: application/json
Body: {"email": "user@example.com"}
```

### Response Format

```
GET /api/v1/users
Accept: application/json

Response:
Content-Type: application/json
Body: [{"id": 1, "email": "..."}]
```

### Multiple Formats

```
Accept: application/json       → JSON response
Accept: application/xml        → XML response
Accept: text/csv              → CSV response
```

---

## Webhooks

### Webhook Pattern

```
1. Client registers webhook URL
   POST /api/v1/webhooks
   Body: {"url": "https://client.com/webhook", "events": ["user.created"]}

2. Event occurs (user created)

3. Server sends HTTP POST to webhook URL
   POST https://client.com/webhook
   Body: {
     "event": "user.created",
     "data": {"id": 123, "email": "..."},
     "timestamp": "2026-01-27T12:00:00Z"
   }

4. Client responds with 200 OK
```

### Webhook Security

```
# Include signature in header
X-Webhook-Signature: sha256=abc123...

# Client verifies signature
signature = HMAC-SHA256(secret, requestBody)
if signature != headerSignature:
    return 401 Unauthorized
```

---

## API Best Practices

### Security

- ✅ Use HTTPS everywhere
- ✅ Implement authentication
- ✅ Validate all inputs
- ✅ Rate limit requests
- ✅ Use API keys for server-to-server
- ✅ Implement CORS properly
- ✅ Log security events

### Performance

- ✅ Implement caching (ETags, Cache-Control)
- ✅ Use compression (gzip, brotli)
- ✅ Paginate large collections
- ✅ Support field filtering
- ✅ Use CDN for static content
- ✅ Monitor API performance

### Developer Experience

- ✅ Provide clear error messages
- ✅ Use consistent naming
- ✅ Version your API
- ✅ Maintain comprehensive docs
- ✅ Provide SDK/client libraries
- ✅ Include examples
- ✅ Offer sandbox environment

---

## Common API Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **Overfetching** | Returning too much data | Support field selection |
| **Underfetching** | Requiring multiple requests | Support eager loading |
| **No versioning** | Breaking changes affect clients | Version from day one |
| **Inconsistent naming** | Hard to use | Follow naming conventions |
| **No pagination** | Performance issues | Always paginate collections |
| **Poor error messages** | Hard to debug | Return detailed errors |
| **No rate limiting** | API abuse | Implement rate limits |

---

## Resources

**API Standards:**
- [REST API Design Rulebook](https://www.oreilly.com/library/view/rest-api-design/9781449317904/)
- [JSON:API Specification](https://jsonapi.org)
- [Google API Design Guide](https://cloud.google.com/apis/design)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)

**Tools:**
- **Documentation**: Swagger/OpenAPI, Postman, Insomnia
- **Testing**: Postman, REST Client, curl
- **Mocking**: Prism, MockServer, WireMock

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
