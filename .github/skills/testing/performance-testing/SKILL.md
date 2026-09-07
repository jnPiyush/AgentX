---
name: "performance-testing"
description: 'Design and execute performance tests including load testing, stress testing, latency benchmarking, and capacity planning. Use when validating system throughput, response times, resource utilization, and scalability under load.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["k6", "locust", "jmeter", "artillery", "gatling", "vegeta", "bombardier"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "azure-load-testing", "grafana"]
---

# Performance Testing

> **Purpose**: Validate system performance, scalability, and reliability under expected and peak loads.
> **Scope**: Load testing, stress testing, spike testing, soak testing, latency benchmarking, capacity planning.

---

## When to Use This Skill

- Establishing performance baselines before release
- Validating SLA compliance (latency, throughput, error rate)
- Capacity planning for expected traffic growth
- Identifying bottlenecks in APIs, databases, or infrastructure
- Testing autoscaling behavior under load
- Regression testing after performance-sensitive changes
- Pre-production load validation

## When NOT to Use

- Functional correctness testing (use integration/e2e testing)
- Security vulnerability scanning (use security testing)
- Unit-level profiling (use language profiler directly)

## Prerequisites

- Defined SLA targets (P50, P95, P99 latency, throughput, error rate)
- Representative test environment (production-like)
- Monitoring stack available (metrics, logs, traces)
- Test data that reflects production volume

## Decision Tree

```
Performance test type?
+- How fast under normal load? -> Load Test
|  +- Sustained traffic at expected concurrency
|  +- Duration: 5-15 minutes
|  +- Key metric: P95 latency
+- What's the breaking point? -> Stress Test
|  +- Ramp beyond capacity until failure
|  +- Duration: ramp until degradation
|  +- Key metric: max throughput before errors
+- Can it handle sudden spikes? -> Spike Test
|  +- Sudden burst of traffic
|  +- Duration: brief spike + recovery
|  +- Key metric: recovery time
+- Is it stable over time? -> Soak Test
|  +- Moderate load for extended period
|  +- Duration: 1-4 hours
|  +- Key metric: memory leaks, connection leaks
+- How many users can it support? -> Capacity Test
|  +- Incremental load increase
|  +- Duration: stepped ramp
|  +- Key metric: users at SLA threshold
```

---

## Core Rules

1. **Define SLAs First** - Establish P50, P95, P99 latency targets and max error rate before writing any test.
2. **Production-Like Environment** - Run load tests against an environment that mirrors production in topology, sizing, and data volume.
3. **Realistic Traffic Patterns** - Model virtual user scenarios from production access logs; include think time between requests.
4. **Baseline Before Comparing** - Always run a baseline test first; compare subsequent runs against it for regressions.
5. **Unique Test Data** - Generate unique data per virtual user to avoid cache hits and lock contention that skew results.
6. **Threshold-Gated CI** - Set k6/Locust thresholds that fail the pipeline if P95 latency or error rate exceeds SLA.
7. **Separate from Functional Tests** - Performance tests run on a schedule or perf-sensitive PRs, not on every commit.
8. **Monitor Infrastructure** - Collect CPU, memory, connection pool, and queue depth metrics alongside request metrics.
9. **Ramp Gradually** - Always include ramp-up and ramp-down phases; sudden load skews cold-start measurements.
10. **Document Results** - Record test parameters, environment details, and results in a report for every significant run.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Test against production | Use staging or isolated load-test environment |
| Run load tests with no baseline | Establish baseline first, then compare |
| Use unrealistic traffic patterns | Model from production access logs |
| Ignore think time between requests | Add realistic delays between actions |
| Test single endpoint only | Test realistic user journeys |
| Set thresholds without SLA | Define SLAs first, then derive thresholds |
| Run perf tests on every PR | Run on schedule + perf-sensitive PRs only |
| Use shared test data | Generate unique data per virtual user |
## Workflow

1. Capture baseline and resource telemetry.
2. Run the declared workload with bounded stages.
3. Correlate latency and errors with saturation signals.
4. Apply one change and repeat an equivalent test.

## Error Handling

- Threshold breach: stop escalation and preserve diagnostics.
- Generator saturation: invalidate the run rather than blaming the service.
- Noisy environment: rerun under controlled conditions or report uncertainty.

## Verification Checklist

- [ ] Workload and environment are documented.
- [ ] SLO thresholds pass with error rate included.
- [ ] Generator has headroom.
- [ ] Results are reproducible and tied to a commit.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Tool Selection, Load Testing with k6, Load Testing with Locust (Python)](references/details-tool-selection-and-load-testing-with-locust-python.md) - MUST read before work involving tool selection, load testing with k6, load testing with locust (python).
- [CI Integration through Metrics and Reporting](references/details-ci-integration-and-metrics-and-reporting.md) - MUST read before work involving ci integration through metrics and reporting.
