---
name: logging-monitoring
description: 'Language-agnostic observability patterns including structured logging, log levels, correlation IDs, metrics, and distributed tracing.'
---

# Logging & Monitoring

> **Purpose**: Implement observability for production systems.  
> **Goal**: Structured logs, correlation across requests, actionable metrics.  
> **Note**: For implementation, see [C# Development](../csharp/SKILL.md) or [Python Development](../python/SKILL.md).

---

## Structured Logging

### Concept

Log structured data (key-value pairs) instead of plain text for better searchability and analysis.

```
❌ Unstructured (hard to parse):
  "User john@example.com logged in from 192.168.1.1 at 2024-01-15 10:30:00"

✅ Structured (machine-readable):
  {
    "event": "user_login",
    "user_email": "john@example.com",
    "ip_address": "192.168.1.1",
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO"
  }
```

### Benefits

- **Searchable**: Query by any field
- **Filterable**: Show only errors, specific users, etc.
- **Aggregatable**: Count events, calculate averages
- **Parseable**: Tools can process automatically

---

## Log Levels

### Standard Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **TRACE** | Very detailed debugging | "Entering function with params: {x: 1, y: 2}" |
| **DEBUG** | Debugging information | "Cache hit for key: user_123" |
| **INFO** | Normal operations | "User logged in", "Order created" |
| **WARN** | Unexpected but recoverable | "Retry attempt 2 of 3", "Rate limit approaching" |
| **ERROR** | Failures requiring attention | "Payment failed", "Database connection lost" |
| **FATAL** | Application cannot continue | "Out of memory", "Configuration invalid" |

### Level Configuration by Environment

```
Development: DEBUG or TRACE
  - See detailed information for debugging

Staging: INFO
  - Normal operations plus warnings/errors

Production: INFO (or WARN)
  - Reduce noise, focus on significant events
  - Keep ERROR/FATAL always enabled
```

---

## Log Message Guidelines

### What to Log

```
✅ DO Log:
  - Request start/end with duration
  - Business events (user actions, state changes)
  - Errors with context (what failed, why, input data)
  - External service calls (API calls, DB queries)
  - Security events (login, logout, permission denied)
  - Performance metrics (slow queries, cache misses)

❌ DON'T Log:
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
  ✅ "Processing order 12345 for user 67890"
  ✅ "Payment failed for order 12345: insufficient funds"
  ✅ "Database query completed in 150ms: SELECT * FROM users"

  ❌ "Error occurred"
  ❌ "Something went wrong"
  ❌ "null"
```

---

## Correlation IDs

### Concept

Track requests across multiple services/layers using a unique ID.

```
Request Flow:
  
  Client Request
       ↓ (X-Correlation-ID: abc-123)
  API Gateway
       ↓ (CorrelationId: abc-123)
  User Service
       ↓ (CorrelationId: abc-123)
  Database
       ↓ (CorrelationId: abc-123)
  Payment Service
       ↓ (CorrelationId: abc-123)
  Response

All logs include CorrelationId: abc-123
→ Easy to trace entire request path
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
Rate    - Requests per second
Errors  - Failed requests per second
Duration - Time per request (latency)

Dashboard should show:
  - Rate: Are we getting traffic?
  - Errors: Is something broken?
  - Duration: Is it slow?
```

### USE Method (Resource-Driven)

```
Utilization - % of resource used
Saturation  - Queue depth, waiting work
Errors      - Error events

Apply to: CPU, Memory, Disk, Network
```

---

## Distributed Tracing

### Concept

Track a request as it flows through multiple services.

```
Trace Structure:

Trace (entire request journey)
  └── Span: API Gateway (50ms)
        └── Span: Auth Service (10ms)
        └── Span: User Service (30ms)
              └── Span: Database Query (15ms)
              └── Span: Cache Lookup (2ms)
        └── Span: Notification Service (5ms)
```

### Trace Components

| Component | Description |
|-----------|-------------|
| **Trace** | End-to-end request journey |
| **Span** | Single operation within trace |
| **Trace ID** | Unique ID for entire trace |
| **Span ID** | Unique ID for single span |
| **Parent Span ID** | Links child spans to parent |

### What to Trace

```
✅ Trace:
  - HTTP requests (incoming and outgoing)
  - Database queries
  - Cache operations
  - Message queue publish/consume
  - External API calls

Context to Include:
  - Service name
  - Operation name
  - Duration
  - Status (success/error)
  - Error message (if failed)
  - Custom attributes (user_id, order_id, etc.)
```

---

## Health Checks

### Types

```
Liveness Check (/health/live):
  "Is the application running?"
  - Returns 200 if process is alive
  - Used by orchestrators to restart crashed containers

Readiness Check (/health/ready):
  "Is the application ready to serve traffic?"
  - Checks database connectivity
  - Checks cache availability
  - Checks external service health
  - Used by load balancers to route traffic
```

### Health Check Response

```
Response Format:

{
  "status": "healthy",  // or "unhealthy", "degraded"
  "checks": {
    "database": { "status": "healthy", "latency_ms": 5 },
    "cache": { "status": "healthy", "latency_ms": 1 },
    "external_api": { "status": "degraded", "error": "slow response" }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Alerting

### Alert Categories

```
Critical (Page immediately):
  - Application down
  - Error rate > 10%
  - Database unreachable
  - Security breach detected

Warning (Notify during business hours):
  - Error rate > 1%
  - Latency p99 > 5s
  - Disk usage > 80%
  - Certificate expiring in 7 days

Info (Review in dashboard):
  - Deployment completed
  - Backup succeeded
  - Usage approaching quota
```

### Alert Best Practices

```
✅ DO:
  - Alert on symptoms, not causes
  - Include runbook links in alerts
  - Set appropriate thresholds (avoid alert fatigue)
  - Group related alerts
  - Include context in alert message

❌ DON'T:
  - Alert on every error
  - Use the same severity for all alerts
  - Alert without actionable next steps
  - Create alerts that are always ignored
```

---

## Best Practices Summary

| Practice | Description |
|----------|-------------|
| **Structured logging** | JSON format with key-value pairs |
| **Correlation IDs** | Trace requests across services |
| **Appropriate levels** | DEBUG in dev, INFO+ in prod |
| **No sensitive data** | Never log passwords, tokens, PII |
| **Context in errors** | Include what, why, and how to fix |
| **Meaningful metrics** | Track rate, errors, duration |
| **Health checks** | Liveness + readiness endpoints |
| **Actionable alerts** | Include runbooks, reduce noise |

---

## Observability Tools

| Category | Tools |
|----------|-------|
| **Logging** | ELK Stack, Splunk, Datadog Logs, CloudWatch Logs |
| **Metrics** | Prometheus + Grafana, Datadog, New Relic, CloudWatch |
| **Tracing** | Jaeger, Zipkin, Datadog APM, Application Insights |
| **All-in-One** | Datadog, New Relic, Dynatrace, Elastic Observability |

---

**See Also**: [Error Handling](../error-handling/SKILL.md) • [C# Development](../csharp/SKILL.md) • [Python Development](../python/SKILL.md)

