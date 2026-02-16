# API Response Format, Versioning & Pagination

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
GET /api/v2/users # New version
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
 v1 (Stable) -> Fully supported
 v2 (Current) -> Recommended, default
 v3 (Preview) -> Beta, may change
 
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
GET /api/v1/products?sort=price:asc,name:asc # Multi-column
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
