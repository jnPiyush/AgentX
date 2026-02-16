# Log Messages, Correlation IDs & Metrics

## Log Message Guidelines

### What to Log

```
[PASS] DO Log:
 - Request start/end with duration
 - Business events (user actions, state changes)
 - Errors with context (what failed, why, input data)
 - External service calls (API calls, DB queries)
 - Security events (login, logout, permission denied)
 - Performance metrics (slow queries, cache misses)

[FAIL] DON'T Log:
 - Passwords, API keys, tokens
 - Credit card numbers, SSN
 - Personal health information
 - Raw request/response bodies with sensitive data
 - High-frequency events that create noise
```

### Message Format

```
Good Log Message Pattern:
 {action} {subject} {outcome} {context}

Examples:
 [PASS] "Processing order 12345 for user 67890"
 [PASS] "Payment failed for order 12345: insufficient funds"
 [PASS] "Database query completed in 150ms: SELECT * FROM users"

 [FAIL] "Error occurred"
 [FAIL] "Something went wrong"
 [FAIL] "null"
```

---

## Correlation IDs

### Concept

Track requests across multiple services/layers using a unique ID.

```
Request Flow:
 
 Client Request
 (down) (X-Correlation-ID: abc-123)
 API Gateway
 (down) (CorrelationId: abc-123)
 User Service
 (down) (CorrelationId: abc-123)
 Database
 (down) (CorrelationId: abc-123)
 Payment Service
 (down) (CorrelationId: abc-123)
 Response

All logs include CorrelationId: abc-123
-> Easy to trace entire request path
```

### Implementation Pattern

```
Middleware Pattern:

function correlationMiddleware(request, response, next):
 # Get from header or generate new
 correlationId = request.headers["X-Correlation-ID"] 
 or generateUUID()
 
 # Add to request context
 request.context.correlationId = correlationId
 
 # Add to response header
 response.headers["X-Correlation-ID"] = correlationId
 
 # Add to log context (all logs include it automatically)
 logger.setContext({ correlationId: correlationId })
 
 next()
```

---

## Metrics

### Types of Metrics

| Type | Description | Example |
|------|-------------|---------|
| **Counter** | Cumulative count | `http_requests_total`, `errors_total` |
| **Gauge** | Current value | `active_connections`, `queue_size` |
| **Histogram** | Distribution of values | `request_duration_seconds` |
| **Summary** | Similar to histogram with quantiles | `request_latency_p99` |

### Key Metrics to Track

```
Application Metrics:
 - Request rate (requests/second)
 - Error rate (errors/second, error %)
 - Latency (p50, p95, p99 response times)
 - Active users/connections

Infrastructure Metrics:
 - CPU usage
 - Memory usage
 - Disk I/O
 - Network throughput

Business Metrics:
 - Orders per hour
 - Revenue per day
 - User signups
 - Conversion rate
```

### RED Method (Request-Driven)

```
Rate - Requests per second
Errors - Failed requests per second
Duration - Time per request (latency)

Dashboard should show:
 - Rate: Are we getting traffic?
 - Errors: Is something broken?
 - Duration: Is it slow?
```

### USE Method (Resource-Driven)

```
Utilization - % of resource used
Saturation - Queue depth, waiting work
Errors - Error events

Apply to: CPU, Memory, Disk, Network
```

---
