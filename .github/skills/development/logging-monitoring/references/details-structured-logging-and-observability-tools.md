# logging-monitoring: Structured Logging, Log Levels, Observability Tools

> MUST read before work involving **structured logging, log levels, observability tools**. This reference preserves complete source guidance relocated for context-budget compliance.

## Structured Logging

### Concept

Log structured data (key-value pairs) instead of plain text for better searchability and analysis.

```
[FAIL] Unstructured (hard to parse):
 "User john@example.com logged in from 192.168.1.1 at 2024-01-15 10:30:00"

[PASS] Structured (machine-readable):
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

## Observability Tools

| Category | Tools |
|----------|-------|
| **Logging** | ELK Stack, Splunk, Datadog Logs, CloudWatch Logs |
| **Metrics** | Prometheus + Grafana, Datadog, New Relic, CloudWatch |
| **Tracing** | Jaeger, Zipkin, Datadog APM, Application Insights |
| **All-in-One** | Datadog, New Relic, Dynatrace, Elastic Observability |

---

**See Also**: [Error Handling](../../error-handling/SKILL.md) - [C# Development](../../../languages/csharp/SKILL.md) - [Python Development](../../../languages/python/SKILL.md)

## References

- [Logging Correlation Metrics](logging-correlation-metrics.md)
- [Tracing Health Alerting](tracing-health-alerting.md)