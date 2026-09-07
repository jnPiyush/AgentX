# performance-testing: CI Integration through Metrics and Reporting

> MUST read before work involving **ci integration through metrics and reporting**. This reference preserves complete source guidance relocated for context-budget compliance.

## CI Integration

### k6 in GitHub Actions

```yaml
name: Performance Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1

      - name: Run load test
        uses: grafana/run-k6-action@v1
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
          TEST_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
        with:
          path: tests/performance/load-test.js

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: k6-results/
```

### Performance Gate (PR Check)

```yaml
# Run lightweight perf check on PRs affecting critical paths
  perf-gate:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'perf-sensitive')
    steps:
      - uses: grafana/run-k6-action@v1
        with:
          path: tests/performance/smoke-test.js
          # Smoke test: 10 VUs, 1 minute, strict thresholds
```

---

## SLA Thresholds

### Standard Web Application

| Metric | P50 | P95 | P99 | Alert |
|--------|-----|-----|-----|-------|
| API response time | < 100ms | < 500ms | < 1000ms | P95 > 500ms |
| Page load time | < 1s | < 3s | < 5s | P95 > 3s |
| Error rate | < 0.1% | - | - | > 1% |
| Throughput (RPS) | Baseline | -10% | -20% | Drop > 10% |

### Database Queries

| Query Type | Target | Alert |
|------------|--------|-------|
| Simple reads | < 10ms | > 50ms |
| Complex joins | < 100ms | > 500ms |
| Write operations | < 50ms | > 200ms |
| Aggregations | < 500ms | > 2s |

---

## Bottleneck Identification

```
High latency detected?
+- Check P50 vs P95 gap
|  +- Small gap (P95 < 2x P50) -> Uniform slowness -> check code/queries
|  +- Large gap (P95 > 5x P50) -> Tail latency -> check contention/GC
+- Check under load
|  +- Linear degradation -> Resource limit (CPU/memory/connections)
|  +- Sudden cliff -> Queue saturation or thread pool exhaustion
|  +- Periodic spikes -> GC pauses, cron jobs, cache eviction
+- Common bottlenecks
   +- Database -> Slow queries, missing indexes, connection pool exhaustion
   +- Network -> DNS, TLS handshake, cross-region calls
   +- Application -> Synchronous I/O, N+1 queries, large payloads
   +- Infrastructure -> CPU throttling, memory pressure, disk I/O
```

---

## Capacity Planning

| Step | Action | Output |
|------|--------|--------|
| 1. Baseline | Load test at current traffic | RPS, latency, resource usage |
| 2. Headroom | Test at 2x-3x current traffic | Degradation point |
| 3. Breaking point | Stress test to failure | Max capacity |
| 4. Scaling | Test with autoscaling enabled | Scale-out behavior |
| 5. Cost model | Map capacity to infrastructure cost | Cost per 1000 users |

---

## Metrics and Reporting

| Metric | Description | Collection |
|--------|-------------|------------|
| **Throughput** | Requests per second (RPS) | k6/Locust built-in |
| **Latency** | P50, P95, P99 response time | k6/Locust built-in |
| **Error rate** | Percentage of failed requests | k6/Locust built-in |
| **CPU utilization** | Server CPU under load | Monitoring (Azure Monitor, Prometheus) |
| **Memory usage** | RSS/heap under load | Monitoring |
| **Connection pool** | Active/idle connections | App metrics |
| **Queue depth** | Pending requests | Load balancer metrics |

---
