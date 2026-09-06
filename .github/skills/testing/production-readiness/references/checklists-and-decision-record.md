# Checklists, Migration Safety, and Decision Record

Supporting detail for [production-readiness](../SKILL.md): the full
pre/operational/documentation checklist, database migration safety,
observability pre-deployment checks, the go/no-go decision matrix and
record template, post-deploy smoke tests, canary gates, and DORA metrics.

## Full Production Readiness Checklist

### Quality Gates (mandatory)

- [ ] Unit tests: 100% pass, >= 80% coverage
- [ ] Integration tests: 100% pass; E2E: >= 95% pass rate
- [ ] SAST scan: 0 critical/high findings; dependency scan: 0 critical/high CVEs
- [ ] Secret scan: 0 findings; performance P95 within SLA
- [ ] Accessibility: WCAG 2.1 AA compliant; API consumer contracts verified
- [ ] Database migrations tested forward and rollback

### Operational Readiness (mandatory)

- [ ] Monitoring dashboards and P1/P2 alerting active; log aggregation working
- [ ] Health check endpoints responding; runbook updated for new features
- [ ] Rollback procedure documented and tested; feature flags configured
- [ ] On-call rotation scheduled; stakeholders notified; backups verified

### Documentation (mandatory)

- [ ] API docs (OpenAPI/Swagger) and changelog updated
- [ ] Architecture diagrams current; known issues and config changes documented

## Rollback Test Procedure

1. Deploy version N (current stable), then N+1 (release candidate).
2. Run smoke tests against N+1, then execute rollback to N.
3. Verify: app starts, health checks pass, smoke tests pass on N, no data
   corruption, schema backward-compatible, feature flags revert, no
   orphaned resources.
4. Re-deploy N+1 to verify forward migration; document rollback time
   (target: < 5 min).

## Database Migration Safety

| Pattern | Description | Rollback Safety |
|---------|--------------|-------------------|
| Expand-Contract | Add new -> migrate -> remove old | Safe at every step |
| Blue-Green Schema | Two schema versions simultaneously | Instant rollback |
| Forward-Only | No down migration | Risky, avoid |
| Backward-Compatible | New schema works with old code | Recommended |

```sql
-- SAFE: additive migration, backward compatible
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
-- UNSAFE: destructive migration, breaks rollback
-- ALTER TABLE users DROP COLUMN name;  -- never in the same release
-- SAFE: expand-contract, step 2 of 3 (this release backfills, next release drops)
UPDATE users SET display_name = name WHERE display_name IS NULL;
```

## Observability Pre-Deployment Checks

| Check | Command/Action | Pass Criteria |
|-------|------------------|-----------------|
| Health endpoint | `curl /api/health` | 200 OK with service details |
| Readiness probe | `curl /api/ready` | 200 when dependencies available |
| Liveness probe | `curl /api/live` | 200 (self-check only) |
| Metrics endpoint | `curl /metrics` | Prometheus metrics available |
| Structured logging | Review log output | JSON format, correlation IDs |
| Distributed tracing | Generate test request | Trace visible in tracing UI |
| Alerts | Trigger test alert | Notification received |

## Go/No-Go Decision Matrix

| Category | Weight | Score (1-5) |
|-----------|--------|----------------|
| Test Coverage & Results | 25% | |
| Security Scan Results | 20% | |
| Performance vs SLA | 20% | |
| Operational Readiness | 15% | |
| Documentation | 10% | |
| Rollback Confidence | 10% | |

Thresholds: GO at total >= 4.0 with no category below 3. CONDITIONAL GO at
total >= 3.5 with at most one category at 2, and a documented risk
acceptance. NO-GO below 3.5, or any category at 1. Recalibrate the weights
against the service's own risk profile before reuse -- they are a starting
point, not a fixed law.

### Decision Record Template

```markdown
## Release Decision: v{version}
**Date**: YYYY-MM-DD
**Decision**: GO / CONDITIONAL GO / NO-GO
**Score**: X.X / 5.0

### Gate Results
| Gate | Status | Notes |
|------|--------|-------|
| Unit Tests | PASS (85% coverage) | |
| Performance | PASS (P95: 320ms) | SLA: 500ms |
| Rollback | PASS (tested, 3 min) | |

### Risks
- [risk description and mitigation]

### Approvals
- Engineering Lead: [name]  - QA Lead: [name]
- Security: [name]  - Operations: [name]
```

## Post-Deployment Smoke Tests

```typescript
// tests/smoke/post-deploy.test.ts
describe('Post-Deployment Smoke Tests', () => {
  const baseUrl = process.env.PRODUCTION_URL;

  it('health check returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
  });

  it('critical user flow works', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke@test.com', password: process.env.SMOKE_PASSWORD }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json();
    const dataRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dataRes.status).toBe(200);
  });
});
```

## Canary Deployment Checks

| Phase | Traffic | Duration | Gate |
|-------|---------|----------|------|
| 1 Canary | 5% | 15 min | Error rate < 0.1%, P95 < SLA |
| 2 Expand | 25% | 30 min | Error rate < 0.5%, P95 < SLA |
| 3 Majority | 75% | 30 min | Error rate < baseline + 10% |
| 4 Full | 100% | Ongoing | All metrics within baseline |

Auto-rollback triggers: error rate > 2x baseline, P95 > 2x baseline, health
check failures.

## Metrics (DORA-aligned)

| Metric | Target | Alert Threshold |
|--------|--------|--------------------|
| Release success rate | >= 95% | < 90% |
| Rollback time | < 5 min | > 10 min |
| Mean time to recovery | < 30 min | > 1 hour |
| Change failure rate | < 5% | > 10% |
| Post-deploy incidents (P1/P2) | 0 per release | Any P1 within 24h |

## Additional Anti-Patterns

| Anti-pattern | Why it fails | Instead |
|--------------|--------------|---------|
| No changelog | Consumers/on-call cannot trace the change | Generate and review the changelog before tagging |
| No post-deploy validation | Silent failures reach users first | Run smoke tests after every deployment |
| Risky features without flags | No quick code-free disable path | Test a flag/kill-switch fallback before release |