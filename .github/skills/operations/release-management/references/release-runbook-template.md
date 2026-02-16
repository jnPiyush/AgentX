# Release Runbook & Communication Templates

> Load when creating release documentation. See [SKILL.md](../SKILL.md) for checklist.

---

## Release Communication Template

```markdown
# Release Announcement: v1.2.3

**Release Date:** February 5, 2026
**Downtime:** None expected
**Rollback Plan:** Available if needed

## What's New

### Features
- Added user profile customization
- Implemented dark mode
- Enhanced search functionality

### Improvements
- 30% faster page load times
- Reduced memory usage by 20%
- Improved mobile responsiveness

### Bug Fixes
- Fixed login timeout issue (#123)
- Resolved notification delay (#145)
- Corrected date formatting (#167)

## Breaking Changes
None

## Known Issues
- Search may be slower for queries >100 characters (tracking in #201)

## Rollback Procedure
If issues arise, we can rollback within 15 minutes using:
```bash
./rollback.sh v1.2.2
```

## Support
- Documentation: https://docs.example.com
- Support: support@example.com
- On-call: devops-oncall@example.com
```

---

## Release Runbook Template

```markdown
# Release Runbook: Production Deployment

## Overview
**Purpose:** Deploy version to production
**Duration:** ~30 minutes
**Team:** DevOps, Engineering
**On-call:** devops-oncall@example.com

## Prerequisites
- [ ] Version tested in staging
- [ ] Security scan passed
- [ ] Change approval obtained
- [ ] Rollback plan ready
- [ ] Team members available

## Pre-Deployment

### 1. Verify Readiness
```bash
# Check staging health
curl https://staging.example.com/health

# Verify version
curl https://staging.example.com/version
```

### 2. Notify Team
- Post in #deployments: "Starting production deployment of v1.2.3"
- Set Slack status: " Deploying"

## Deployment Steps

### 3. Start Deployment
```bash
# Trigger deployment pipeline
gh workflow run deploy-production.yml -f version=v1.2.3

# Monitor deployment
gh run watch
```

### 4. Monitor Rollout
- Watch deployment progress: https://github.com/org/repo/actions
- Monitor logs: Check CloudWatch/Azure Monitor
- Track metrics: Open Grafana dashboard

### 5. Verify Health Checks
```bash
# Wait for deployment (5-10 minutes)
sleep 600

# Check health endpoint
curl https://app.example.com/health

# Check version
curl https://app.example.com/version
```

### 6. Run Smoke Tests
```bash
npm run test:smoke -- --env=production
```

## Post-Deployment

### 7. Verify Metrics
- Error rate < 0.5%
- Response time < 200ms (p95)
- Memory usage < 80%
- CPU usage < 70%

### 8. Monitor Period
- Watch for 30 minutes
- Check error tracking (Sentry/New Relic)
- Review user feedback

### 9. Update Status
- Post in #deployments: "[PASS] Production deployment complete"
- Update status page
- Clear Slack status

## Rollback Procedure

### When to Rollback
- Error rate > 2%
- Critical functionality broken
- Performance degradation > 50%
- Security vulnerability discovered

### Rollback Steps
```bash
# Get previous version
PREV_VERSION=$(./get-previous-version.sh)

# Trigger rollback
./rollback.sh $PREV_VERSION

# Verify rollback
curl https://app.example.com/version
curl https://app.example.com/health
```

### Rollback Notification
```
[FAIL] Rollback Initiated
Version: v1.2.3 -> v1.2.2
Reason: [High error rate | Performance issue | Critical bug]
Status: [In Progress | Complete]
```

## Troubleshooting

### Issue: Health Check Fails
```bash
# Check pod status
kubectl get pods -n production

# View logs
kubectl logs deployment/myapp -n production --tail=100

# Restart if needed
kubectl rollout restart deployment/myapp -n production
```

### Issue: High Error Rate
1. Check error tracking dashboard
2. Review recent logs
3. Check database connectivity
4. Verify external API status
5. Consider rollback if error rate > 2%

### Issue: Slow Response Times
1. Check resource usage (CPU/memory)
2. Review database query performance
3. Check cache hit rates
4. Scale horizontally if needed

## Contacts
- **DevOps Lead:** devops-lead@example.com
- **Engineering Manager:** eng-manager@example.com
- **On-call:** PagerDuty rotation
- **Escalation:** CTO (critical issues only)
```
