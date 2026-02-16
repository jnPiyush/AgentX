# API Documentation, Content Negotiation & Webhooks

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

- [PASS] Document all endpoints
- [PASS] Include request/response examples
- [PASS] Document error responses
- [PASS] Provide authentication details
- [PASS] Include rate limiting info
- [PASS] Link to SDK/client libraries
- [PASS] Keep docs up-to-date

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
Accept: application/json -> JSON response
Accept: application/xml -> XML response
Accept: text/csv -> CSV response
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
