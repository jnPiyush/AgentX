# DevOps Agent Reference: Deployment Documentation Template

Use this template when creating deployment docs at `docs/deployment/DEPLOY-{issue-id}.md`.

---

```markdown
# Deployment Guide: {Pipeline Name}

**Issue**: #{issue-id}
**Pipeline**: `.github/workflows/{name}.yml`

## Overview

This pipeline automates {description of what it does}.

## Trigger Conditions

- **Automatic**: Push to `main` or `develop`
- **Manual**: Via GitHub Actions UI -> "Run workflow"
- **Scheduled**: Daily at 2 AM UTC

## Environments

### Development
- **URL**: https://dev.app.example.com
- **Deployment**: Automatic on push to `develop`
- **Secrets Required**: `DEV_DEPLOY_TOKEN`

### Staging
- **URL**: https://staging.app.example.com
- **Deployment**: Automatic on push to `main`
- **Secrets Required**: `STAGING_DEPLOY_TOKEN`

### Production
- **URL**: https://app.example.com
- **Deployment**: Requires manual approval
- **Secrets Required**: `PROD_DEPLOY_TOKEN`, `DATABASE_CONNECTION_STRING`

## Manual Deployment

1. Go to Actions -> {Workflow Name}
2. Click "Run workflow"
3. Select branch and environment
4. Click "Run"
5. Monitor progress in Actions tab

## Rollback Procedure

If deployment fails or issues arise:

1. **Immediate**: Trigger previous successful deployment
2. **Git revert**: Revert problematic commit
3. **Manual rollback**: SSH to server and restore previous version

## Monitoring

- **Workflow runs**: https://github.com/{owner}/{repo}/actions
- **Build logs**: Click on workflow run -> job -> step
- **Deployment status**: Check environment status in Environments tab

## Troubleshooting

### Issue: Build fails with "dependency not found"
**Solution**: Check if dependency cache is stale. Clear cache and re-run.

### Issue: Deployment fails with "authentication error"
**Solution**: Verify secrets are correctly configured in repository settings.

### Issue: Tests timeout
**Solution**: Increase timeout in workflow file or optimize slow tests.

## Support

- **Slack**: #devops-support
- **On-call**: DevOps team rotation
```
