# Distributed Tracing, Health Checks & Alerting

## Distributed Tracing

### Concept

Track a request as it flows through multiple services.

```
Trace Structure:

Trace (entire request journey)
 -- Span: API Gateway (50ms)
 -- Span: Auth Service (10ms)
 -- Span: User Service (30ms)
 -- Span: Database Query (15ms)
 -- Span: Cache Lookup (2ms)
 -- Span: Notification Service (5ms)
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
[PASS] Trace:
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
 "status": "healthy", // or "unhealthy", "degraded"
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
[PASS] DO:
 - Alert on symptoms, not causes
 - Include runbook links in alerts
 - Set appropriate thresholds (avoid alert fatigue)
 - Group related alerts
 - Include context in alert message

[FAIL] DON'T:
 - Alert on every error
 - Use the same severity for all alerts
 - Alert without actionable next steps
 - Create alerts that are always ignored
```

---
