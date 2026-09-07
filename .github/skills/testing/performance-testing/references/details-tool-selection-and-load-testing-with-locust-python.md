# performance-testing: Tool Selection, Load Testing with k6, Load Testing with Locust (Python)

> MUST read before work involving **tool selection, load testing with k6, load testing with locust (python)**. This reference preserves complete source guidance relocated for context-budget compliance.

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
