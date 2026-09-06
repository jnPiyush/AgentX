# Quality Gate Pipeline and Chaos Experiments

Supporting detail for [production-readiness](../SKILL.md): the CI quality
gate, a chaos-toolkit experiment, the resilience test matrix, and alert
verification. Adapt provider/tooling names to the target repo's actual stack.

## GitHub Actions Quality Gate

```yaml
name: Production Readiness Gate
on:
  push:
    tags: ['v*']

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Unit Tests + Coverage
        run: |
          npm test -- --coverage
          npx nyc check-coverage --lines 80 --branches 70 --functions 80
      - name: Integration Tests
        run: npm run test:integration
      - name: E2E Tests
        run: npx playwright test
      - name: SAST Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/default p/owasp-top-ten
      - name: Dependency Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH
          exit-code: 1
      - name: Secret Scan
        uses: gitleaks/gitleaks-action@v2
      - name: Performance Smoke Test
        run: k6 run tests/performance/smoke-test.js
      - name: Gate Summary
        if: always()
        run: |
          echo "## Production Readiness Gate" >> $GITHUB_STEP_SUMMARY
          echo "| Gate | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Unit Tests | ${{ steps.unit.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| SAST | ${{ steps.sast.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Dependencies | ${{ steps.deps.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Performance | ${{ steps.perf.outcome }} |" >> $GITHUB_STEP_SUMMARY
```

## Chaos Toolkit Experiment

```yaml
# chaos/experiment-api-latency.yaml
title: "API handles upstream latency gracefully"
description: "Inject latency into payment service; verify degradation handling"
steady-state-hypothesis:
  title: "Application responds within SLA"
  probes:
    - type: probe
      name: "api-responds"
      provider:
        type: http
        url: "https://staging.example.com/api/health"
        timeout: 5
      tolerance:
        status: 200
method:
  - type: action
    name: "inject-latency"
    provider:
      type: process
      path: "tc"
      arguments: "qdisc add dev eth0 root netem delay 500ms 100ms"
    pauses:
      after: 30
rollbacks:
  - type: action
    name: "remove-latency"
    provider:
      type: process
      path: "tc"
      arguments: "qdisc del dev eth0 root"
```

## Resilience Test Matrix

| Scenario | Injection | Expected Behavior | Pass Criteria |
|----------|-----------|--------------------|-----------------|
| Upstream latency | 500ms delay | Graceful degradation, circuit breaker | No cascading failures |
| Upstream failure | 500 errors | Fallback response, retry with backoff | Error rate < 5% |
| Database failure | Connection drop | Queue writes, alert, recover | Data consistency maintained |
| Memory pressure | Limit to 80% | GC, shed load if needed | No OOM kills |
| Network partition | Block service-to-service | Circuit breaker opens | Self-healing within 60s |
| DNS failure | Block DNS resolution | Cached responses, fallback | Degrades, does not crash |

## Alert Verification

```yaml
alert_tests:
  - name: "High Error Rate"
    trigger: "Send 50 requests to /api/error-trigger"
    expected: "PagerDuty notification within 5 minutes"
    severity: P1
  - name: "High Latency"
    trigger: "Inject 2s delay on /api/slow"
    expected: "Slack alert within 10 minutes"
    severity: P2
  - name: "Service Down"
    trigger: "Stop application process"
    expected: "PagerDuty notification within 2 minutes"
    severity: P1
```