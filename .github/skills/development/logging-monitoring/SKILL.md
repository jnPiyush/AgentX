---
name: "logging-monitoring"
description: 'Implement observability patterns including structured logging, log levels, correlation IDs, metrics, and distributed tracing. Use when adding structured logging, implementing correlation IDs for request tracing, configuring metrics collection, setting up distributed tracing, or designing alerting rules.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Logging & Monitoring

> **Purpose**: Implement observability for production systems. 
> **Goal**: Structured logs, correlation across requests, actionable metrics. 
> **Note**: For implementation, see [C# Development](../../languages/csharp/SKILL.md) or [Python Development](../../languages/python/SKILL.md).

---

## When to Use This Skill

- Adding structured logging to applications
- Implementing request correlation IDs
- Configuring metrics collection
- Setting up distributed tracing (OpenTelemetry)
- Designing alerting rules and health checks

## Prerequisites

- Logging framework installed
- Monitoring platform access

## Decision Tree

```
Observability concern?
+- What to log?
| +- Request start/end -> INFO with correlation ID
| +- Expected errors -> WARN (validation, not-found)
| +- Unexpected errors -> ERROR with stack trace
| - Debug details -> DEBUG (disabled in production)
+- What NOT to log?
| - PII, passwords, tokens, credit cards -> NEVER
+- Metrics needed?
| +- RED metrics: Rate, Errors, Duration (for services)
| - USE metrics: Utilization, Saturation, Errors (for resources)
+- Distributed tracing?
| - OpenTelemetry for cross-service correlation
- Alerting?
 +- SLO-based: alert on error budget burn rate
 - Avoid alert fatigue: page only for actionable issues
```

## Core Rules

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

## Anti-Patterns

- **Log and Forget**: Writing logs but never querying or reviewing them -> Set up dashboards and alerts on ERROR/FATAL; review logs in incident postmortems
- **PII in Logs**: Logging email addresses, passwords, tokens, or credit card numbers -> Scrub sensitive fields before logging; use allowlists for loggable fields
- **Unstructured Strings**: Logging plain text messages that are hard to parse or search -> Use structured logging (JSON key-value pairs) for all log entries
- **Missing Correlation**: Logs from different services with no shared request ID -> Propagate W3C trace context or a correlation ID header across all service calls
- **Alert Fatigue**: Alerting on every warning or non-actionable metric -> Page only on SLO budget burn rate; group related alerts; include runbook links
- **Debug in Production**: Running production with DEBUG or TRACE level enabled -> Use INFO or WARN in production; enable DEBUG temporarily and only on specific components
- **Metric Overload**: Tracking hundreds of custom metrics with no clear purpose -> Focus on RED (Rate, Errors, Duration) for services and USE (Utilization, Saturation, Errors) for resources

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Logs not appearing in monitoring platform | Check log level configuration, verify sink/exporter endpoint |
| Correlation IDs missing across services | Propagate W3C trace context headers in all HTTP calls |
| Alert fatigue from too many notifications | Set meaningful thresholds, group related alerts, add alert suppression windows |

## Workflow

1. Map user-visible objectives to signals.
2. Instrument boundaries with correlation and duration.
3. Create actionable thresholds and ownership.
4. Exercise failure paths and confirm telemetry reaches the backend.

## Verification Checklist

- [ ] Logs are structured and redacted.
- [ ] Metrics have bounded dimensions.
- [ ] Traces connect required boundaries.
- [ ] Alerts name an owner and response.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| log entire request bodies by default. | Use structured fields and stable event names. |
| create alerts without an actionable runbook condition. | Use logs for discrete context, metrics for aggregates and alerts, and traces for cross-boundary causality; combine them through stable correlation fields. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Structured Logging, Log Levels, Observability Tools](references/details-structured-logging-and-observability-tools.md) - MUST read before work involving structured logging, log levels, observability tools.

Existing focused references are reused, not duplicated:

- [Log Messages, Correlation IDs & Metrics](references/logging-correlation-metrics.md) - MUST read before applying the focused log messages, correlation ids & metrics guidance.
- [Distributed Tracing, Health Checks & Alerting](references/tracing-health-alerting.md) - MUST read before applying the focused distributed tracing, health checks & alerting guidance.
