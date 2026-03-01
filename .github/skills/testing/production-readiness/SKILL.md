---
name: "production-readiness"
description: 'Comprehensive production readiness certification covering quality gates, release checklists, chaos/resilience testing, rollback validation, observability verification, and go/no-go decision frameworks. Use before any production deployment.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["k6", "chaos-toolkit", "litmus", "playwright", "trivy", "semgrep"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "azure", "aws", "gcp"]
---

# Production Readiness

> **Purpose**: Certify that a release meets all quality, security, performance, and operational criteria for production deployment.
> **Scope**: Quality gates, release checklists, chaos testing, rollback validation, observability, go/no-go decisions.

---

## When to Use This Skill

- Certifying a release candidate for production
- Running pre-release quality gates
- Validating rollback and recovery procedures
- Performing chaos/resilience testing
- Verifying observability and alerting
- Making go/no-go deployment decisions
- Post-deployment validation

## When NOT to Use

- Writing feature tests (use e2e/integration testing)
- Building CI pipelines (use test automation)
- Initial security scanning (use security testing)
- Performance benchmarking (use performance testing)

## Prerequisites

- All feature development complete (code freeze)
- Test suites passing (unit, integration, e2e)
- Security scans completed (SAST, DAST, SCA)
- Performance baselines established
- Staging environment matching production topology

---

## Production Readiness Checklist

### Quality Gates

```
MANDATORY - All must pass before production deployment

[_] Unit tests: 100% pass, >= 80% coverage
[_] Integration tests: 100% pass
[_] E2E tests: >= 95% pass rate
[_] SAST scan: 0 critical/high findings
[_] Dependency scan: 0 critical/high CVEs
[_] Secret scan: 0 findings
[_] Performance: P95 latency within SLA
[_] Accessibility: WCAG 2.1 AA compliant
[_] API contracts: All consumer contracts verified
[_] Database migrations: Tested forward and rollback
```

### Operational Readiness

```
MANDATORY - Operational requirements

[_] Monitoring dashboards configured
[_] Alerting rules active (P1/P2 alerts)
[_] Log aggregation working
[_] Health check endpoints responding
[_] Runbook updated for new features
[_] Rollback procedure documented and tested
[_] Feature flags configured (if applicable)
[_] On-call rotation scheduled
[_] Communication plan ready (stakeholders notified)
[_] Backup strategy verified
```

### Documentation

```
MANDATORY - Documentation requirements

[_] API documentation updated (OpenAPI/Swagger)
[_] Changelog updated with release notes
[_] Architecture diagrams current
[_] Known issues documented
[_] Deployment guide updated
[_] Configuration changes documented
```

---

## Quality Gate Automation

### GitHub Actions Gate

```yaml
name: Production Readiness Gate
on:
  push:
    tags: ['v*']  # Triggered on version tags

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
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Gate | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Unit Tests | ${{ steps.unit.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Integration | ${{ steps.integration.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| E2E | ${{ steps.e2e.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| SAST | ${{ steps.sast.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Dependencies | ${{ steps.deps.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Secrets | ${{ steps.secrets.outcome }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Performance | ${{ steps.perf.outcome }} |" >> $GITHUB_STEP_SUMMARY
```

---

## Chaos and Resilience Testing

### Chaos Toolkit

```yaml
# chaos/experiment-api-latency.yaml
title: "API handles upstream latency gracefully"
description: "Inject latency into payment service and verify degradation handling"
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

### Resilience Test Matrix

| Scenario | Injection | Expected Behavior | Pass Criteria |
|----------|-----------|-------------------|---------------|
| Upstream latency | 500ms delay | Graceful degradation, circuit breaker | No cascading failures |
| Upstream failure | 500 errors | Fallback response, retry with backoff | Error rate < 5% |
| Database failure | Connection drop | Queue writes, alert, recover | Data consistency maintained |
| Memory pressure | Limit to 80% | GC, shed load if needed | No OOM kills |
| Network partition | Block service-to-service | Circuit breaker opens | Self-healing within 60s |
| DNS failure | Block DNS resolution | Cached responses, fallback | Degrades, does not crash |

---

## Rollback Validation

### Rollback Test Procedure

```
1. Deploy version N (current stable)
2. Deploy version N+1 (release candidate)
3. Run smoke tests against N+1
4. Execute rollback to version N
5. Verify:
   [_] Application starts successfully
   [_] Health checks pass
   [_] Smoke tests pass on N
   [_] No data corruption
   [_] Database schema compatible (backward)
   [_] Feature flags revert correctly
   [_] No orphaned resources
6. Re-deploy N+1 (verify forward migration)
7. Document rollback time (target: < 5 min)
```

### Database Migration Safety

| Pattern | Description | Rollback Safety |
|---------|-------------|-----------------|
| **Expand-Contract** | Add new -> migrate -> remove old | [PASS] Safe at every step |
| **Blue-Green Schema** | Two schema versions simultaneously | [PASS] Instant rollback |
| **Forward-Only** | No down migration | [FAIL] Risky, avoid |
| **Backward-Compatible** | New schema works with old code | [PASS] Recommended |

```sql
-- SAFE: Additive migration (backward compatible)
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);

-- UNSAFE: Destructive migration (breaks rollback)
-- ALTER TABLE users DROP COLUMN name;  -- NEVER in same release

-- SAFE: Expand-Contract pattern
-- Step 1 (this release): Add new column
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
-- Step 2 (this release): Backfill data
UPDATE users SET display_name = name WHERE display_name IS NULL;
-- Step 3 (NEXT release): Remove old column
-- ALTER TABLE users DROP COLUMN name;
```

---

## Observability Verification

### Pre-Deployment Checks

| Check | Command/Action | Pass Criteria |
|-------|---------------|---------------|
| Health endpoint | `curl /api/health` | 200 OK with service details |
| Readiness probe | `curl /api/ready` | 200 when dependencies available |
| Liveness probe | `curl /api/live` | 200 (self-check only) |
| Metrics endpoint | `curl /metrics` | Prometheus metrics available |
| Structured logging | Review log output | JSON format, correlation IDs |
| Distributed tracing | Generate test request | Trace visible in tracing UI |
| Dashboard | Check monitoring UI | Panels populated, no errors |
| Alerts | Trigger test alert | Notification received |

### Alert Verification

```yaml
# Verify alert rules fire correctly
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

---

## Go/No-Go Decision Framework

### Decision Matrix

| Category | Weight | Score (1-5) | Weighted |
|----------|--------|-------------|----------|
| Test Coverage & Results | 25% | _ | _ |
| Security Scan Results | 20% | _ | _ |
| Performance vs SLA | 20% | _ | _ |
| Operational Readiness | 15% | _ | _ |
| Documentation | 10% | _ | _ |
| Rollback Confidence | 10% | _ | _ |
| **Total** | **100%** | | _ |

**Thresholds**:
- **GO**: Total >= 4.0, no category below 3
- **CONDITIONAL GO**: Total >= 3.5, max 1 category at 2 (with documented risk acceptance)
- **NO-GO**: Total < 3.5, or any category at 1

### Decision Record

```markdown
## Release Decision: v{version}

**Date**: YYYY-MM-DD
**Decision**: GO / CONDITIONAL GO / NO-GO
**Score**: X.X / 5.0

### Gate Results
| Gate | Status | Notes |
|------|--------|-------|
| Unit Tests | PASS (85% coverage) | |
| Integration Tests | PASS (100%) | |
| E2E Tests | PASS (97%) | |
| SAST | PASS (0 critical) | |
| Dependencies | PASS (0 critical) | |
| Performance | PASS (P95: 320ms) | SLA: 500ms |
| Security | PASS | |
| Rollback | PASS (tested, 3 min) | |

### Risks
- [risk description and mitigation]

### Approvals
- Engineering Lead: [name]
- QA Lead: [name]
- Security: [name]
- Operations: [name]
```

---

## Post-Deployment Validation

### Smoke Test Suite

```typescript
// tests/smoke/post-deploy.test.ts
describe('Post-Deployment Smoke Tests', () => {
  const baseUrl = process.env.PRODUCTION_URL;

  it('health check returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  it('critical user flow works', async () => {
    // Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke@test.com', password: process.env.SMOKE_PASSWORD }),
    });
    expect(loginRes.status).toBe(200);

    const { token } = await loginRes.json();

    // Fetch data
    const dataRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dataRes.status).toBe(200);
  });

  it('static assets load correctly', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});
```

### Canary Deployment Checks

| Phase | Traffic | Duration | Gate |
|-------|---------|----------|------|
| 1 - Canary | 5% | 15 min | Error rate < 0.1%, P95 < SLA |
| 2 - Expand | 25% | 30 min | Error rate < 0.5%, P95 < SLA |
| 3 - Majority | 75% | 30 min | Error rate < baseline + 10% |
| 4 - Full | 100% | Ongoing | All metrics within baseline |

**Auto-rollback triggers**: Error rate > 2x baseline, P95 > 2x baseline, health check failures.

---

## Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Release success rate | >= 95% | < 90% |
| Rollback time | < 5 min | > 10 min |
| Mean time to recovery (MTTR) | < 30 min | > 1 hour |
| Change failure rate | < 5% | > 10% |
| Deployment frequency | Weekly+ | < monthly |
| Post-deploy incidents (P1/P2) | 0 per release | Any P1 within 24h |

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Deploy on Friday afternoon | Deploy early in the week with team available |
| Skip rollback testing | Test rollback for every release |
| Deploy without monitoring | Verify dashboards and alerts first |
| Big-bang releases | Use canary or blue-green deployments |
| Manual quality gates | Automate all gates in CI pipeline |
| Release without changelog | Document every change for operators |
| Skip chaos testing | Run resilience tests before major releases |
| Ignore post-deploy validation | Run smoke tests immediately after deploy |
| Deploy without feature flags | Use flags for gradual rollout of risky features |
| One-person approval | Require multi-person go/no-go for production |
