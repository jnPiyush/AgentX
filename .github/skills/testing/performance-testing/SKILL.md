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

## Tool Selection

| Tool | Language | Best For | Cloud Option |
|------|----------|----------|--------------|
| **k6** | JavaScript | Developer-friendly, CI-native | Grafana Cloud k6 |
| **Locust** | Python | Python teams, distributed | Azure Load Testing |
| **JMeter** | Java/XML | Complex scenarios, GUI | Azure Load Testing |
| **Artillery** | YAML/JS | Quick API tests | Artillery Cloud |
| **Gatling** | Scala/Java | High throughput, detailed reports | Gatling Enterprise |
| **vegeta** | Go | HTTP benchmarking, CLI | - |

**Recommendation**: Use **k6** for most projects (modern, scriptable, great CI integration).

---

## Load Testing with k6

### Basic Load Test

```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustain
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // ms
    errors: ['rate<0.01'],                             // < 1% errors
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    name: `user-${__VU}-${__ITER}`,
    email: `test-${__VU}-${__ITER}@loadtest.com`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
    },
  };

  const res = http.post(`${__ENV.BASE_URL}/api/users`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(res.status >= 400);
  latency.add(res.timings.duration);

  sleep(1); // Think time between requests
}
```

### Stress Test

```javascript
// tests/performance/stress-test.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Normal load
    { duration: '2m', target: 200 },   // High load
    { duration: '2m', target: 500 },   // Stress
    { duration: '2m', target: 1000 },  // Breaking point
    { duration: '2m', target: 0 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],    // Relaxed for stress
    http_req_failed: ['rate<0.05'],       // 5% error budget
  },
};
```

### Spike Test

```javascript
// tests/performance/spike-test.js
export const options = {
  stages: [
    { duration: '1m', target: 10 },     // Warm up
    { duration: '10s', target: 1000 },   // Spike!
    { duration: '1m', target: 1000 },    // Sustain spike
    { duration: '10s', target: 10 },     // Drop
    { duration: '2m', target: 10 },      // Recovery
  ],
};
```

---

## Load Testing with Locust (Python)

```python
# tests/performance/locustfile.py
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)
    host = "https://api.example.com"

    def on_start(self):
        """Login and get auth token."""
        response = self.client.post("/auth/login", json={
            "email": "loadtest@example.com",
            "password": "test-password",
        })
        self.token = response.json()["token"]

    @task(3)  # Weight: 3x more common
    def list_users(self):
        self.client.get(
            "/api/users",
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(1)
    def create_user(self):
        self.client.post(
            "/api/users",
            json={"name": "Load Test", "email": f"lt-{self.environment.runner.user_count}@test.com"},
            headers={"Authorization": f"Bearer {self.token}"},
        )
```

---

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
