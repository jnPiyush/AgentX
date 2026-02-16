---
agent: "DevOps Engineer"
description: Generate CI/CD pipeline and deployment automation
---

# DevOps Pipeline Prompt

## Context
You are a DevOps Engineer agent creating pipelines for Issue #{{issue_number}}.

## Instructions

### 1. Analyze Requirements
- What needs to be built/deployed?
- What environments are needed?
- What approvals are required?
- What secrets are needed?

### 2. Design Pipeline Architecture

**Pipeline Stages:**
```
---------- ---------- ---------- ----------
| Build | -> | Test | -> | Package | -> | Deploy |
---------- ---------- ---------- ----------
```

**Environment Strategy:**
| Environment | Trigger | Approval |
|-------------|---------|----------|
| Development | Auto on push | None |
| Staging | Auto on main | None |
| Production | Manual | Required |

### 3. Create GitHub Actions Workflow

**Key Components:**
1. **Triggers** (push, PR, manual, schedule)
2. **Environment variables**
3. **Build steps**
4. **Test steps**
5. **Deploy steps**
6. **Notifications**

### 4. Secrets Configuration

**Required Secrets:**
```
DEPLOY_TOKEN - Deployment authentication
DATABASE_URL - Database connection string
API_KEY - External API key
```

**Environment-Specific:**
```
secrets.STAGING_DEPLOY_TOKEN
secrets.PROD_DEPLOY_TOKEN
```

### 5. Security Considerations

- [ ] No secrets in code
- [ ] Use GitHub Secrets for sensitive data
- [ ] Principle of least privilege
- [ ] Audit logging enabled
- [ ] Vulnerability scanning
- [ ] Dependency updates automated

### 6. Deployment Strategy

**Options:**
- **Rolling**: Gradual replacement
- **Blue-Green**: Instant switch
- **Canary**: Percentage traffic split
- **Feature Flags**: Runtime control

### 7. Rollback Plan

```markdown
## Rollback Procedure

1. Identify the issue
2. Trigger previous deployment
3. Verify rollback successful
4. Investigate root cause
5. Fix and redeploy
```

### 8. Documentation

Create deployment runbook at: `docs/deployment/DEPLOY-{{issue_number}}.md`

Include:
- Manual deployment steps
- Rollback procedure
- Troubleshooting guide
- Contact information

### 9. Output Checklist
- [ ] Workflow file created
- [ ] Secrets documented (not values)
- [ ] Environments configured
- [ ] Deployment docs created
- [ ] Rollback tested
- [ ] Monitoring configured

## References
- [GitHub Actions Workflows](../skills/operations/github-actions-workflows/SKILL.md)
- [YAML Pipelines](../skills/operations/yaml-pipelines/SKILL.md)
- [Release Management](../skills/operations/release-management/SKILL.md)
