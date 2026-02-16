# API Rate Limiting, CORS & Auth Patterns

## Rate Limiting

### Rate Limit Headers

```
HTTP Response Headers:
 X-RateLimit-Limit: 1000 # Total requests allowed
 X-RateLimit-Remaining: 500 # Requests remaining
 X-RateLimit-Reset: 1642531200 # Unix timestamp when limit resets
 Retry-After: 3600 # Seconds until retry allowed (on 429)
```

### Rate Limit Strategy

```
Rate Limiting Tiers:
 Anonymous: 100 requests/hour
 Authenticated: 1000 requests/hour
 Premium: 10000 requests/hour
```

---

## CORS Configuration

### CORS Headers

```
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400 # Cache preflight for 24 hours
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
