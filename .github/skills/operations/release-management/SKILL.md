---
name: release-management
description: 'Comprehensive guide for release management, versioning strategies, release automation, and deployment strategies including blue-green, canary, and rolling deployments.'
---

# Release Management & Deployment Strategies

> **Purpose**: Best practices for release management, versioning, and deployment automation.

---

## Table of Contents

1. [Versioning Strategies](#versioning-strategies)
2. [Release Pipeline Architecture](#release-pipeline-architecture)
3. [Deployment Strategies](#deployment-strategies)
4. [Rollback Procedures](#rollback-procedures)
5. [Release Automation](#release-automation)
6. [Change Management](#change-management)
7. [Release Documentation](#release-documentation)
8. [Best Practices](#best-practices)

---

## Versioning Strategies

### Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

Examples:
1.0.0         - Initial release
1.1.0         - New feature (backward compatible)
1.1.1         - Bug fix
2.0.0         - Breaking change
2.0.0-alpha.1 - Pre-release
2.0.0+build.1 - Build metadata
```

**Version Increment Rules:**
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
- **PRERELEASE**: alpha, beta, rc (release candidate)
- **BUILD**: Build metadata (commit hash, build number)

**Implementation:**

```bash
# Git tags
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# package.json (Node.js)
{
  "version": "1.2.3"
}

# .csproj (.NET)
<PropertyGroup>
  <Version>1.2.3</Version>
  <AssemblyVersion>1.2.3.0</AssemblyVersion>
  <FileVersion>1.2.3.0</FileVersion>
</PropertyGroup>
```

### Calendar Versioning (CalVer)

```
YYYY.MM.DD[.MICRO]

Examples:
2026.02.05    - Release on Feb 5, 2026
2026.02.05.1  - Hotfix on same day
2026.02       - Monthly release
```

**When to use:**
- Time-based releases (monthly, quarterly)
- Marketing-driven releases
- Consumer products with regular updates

### Commit-Based Versioning

```
v{MAJOR}.{MINOR}.{COMMIT_COUNT}+{SHORT_SHA}

Examples:
v1.0.42+a3f2c1b
v2.1.158+7d9e4f3
```

**Implementation:**

```bash
# Get commit count
COMMIT_COUNT=$(git rev-list --count HEAD)

# Get short SHA
SHORT_SHA=$(git rev-parse --short HEAD)

# Build version
VERSION="v1.0.${COMMIT_COUNT}+${SHORT_SHA}"
echo $VERSION
```

### Pre-Release Labels

```
{VERSION}-{LABEL}.{INCREMENT}

Examples:
1.0.0-alpha.1    - Early testing
1.0.0-beta.2     - Feature complete, bugs expected
1.0.0-rc.1       - Release candidate
1.0.0-snapshot   - Development snapshot
```

---

## Release Pipeline Architecture

### Basic Release Pipeline

```yaml
# .github/workflows/release.yml
name: Release Pipeline

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Validate version
      run: |
        TAG=${GITHUB_REF#refs/tags/}
        echo "Releasing version: $TAG"

  build:
    needs: validate
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build artifacts
      run: |
        npm ci
        npm run build
    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: release-artifacts
        path: dist/

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Download artifacts
      uses: actions/download-artifact@v4
      with:
        name: release-artifacts
    - name: Run tests
      run: npm test

  create-release:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Generate changelog
      id: changelog
      run: |
        PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
        if [ -z "$PREVIOUS_TAG" ]; then
          CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges)
        else
          CHANGELOG=$(git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --no-merges)
        fi
        echo "$CHANGELOG" > CHANGELOG.md
        echo "changelog<<EOF" >> $GITHUB_OUTPUT
        echo "$CHANGELOG" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        tag_name: ${{ github.ref_name }}
        name: Release ${{ github.ref_name }}
        body: ${{ steps.changelog.outputs.changelog }}
        draft: false
        prerelease: ${{ contains(github.ref_name, '-alpha') || contains(github.ref_name, '-beta') }}
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Download artifacts
      uses: actions/download-artifact@v4
      with:
        name: release-artifacts
        path: ./release

    - name: Upload release assets
      uses: softprops/action-gh-release@v1
      with:
        files: ./release/**
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  deploy-production:
    needs: create-release
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
    - name: Download artifacts
      uses: actions/download-artifact@v4
      with:
        name: release-artifacts

    - name: Deploy to production
      run: |
        echo "Deploying version ${{ github.ref_name }} to production"
        # Deployment commands here

    - name: Notify team
      if: success()
      run: |
        echo "Release ${{ github.ref_name }} deployed successfully"
        # Send notification (Slack, Teams, email)
```

### Multi-Environment Release Pipeline

```yaml
# Azure Pipelines
trigger:
  tags:
    include:
      - v*.*.*

stages:
- stage: Build
  jobs:
  - job: BuildJob
    steps:
    - script: dotnet build -c Release
    - script: dotnet publish -c Release -o $(Build.ArtifactStagingDirectory)
    - publish: $(Build.ArtifactStagingDirectory)
      artifact: drop

- stage: DeployStaging
  dependsOn: Build
  jobs:
  - deployment: DeployStaging
    environment: staging
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: drop
          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure-Staging'
              appName: 'myapp-staging'

- stage: SmokeTests
  dependsOn: DeployStaging
  jobs:
  - job: SmokeTestsJob
    steps:
    - script: |
        curl -f https://staging.example.com/health || exit 1
        npm run test:smoke -- --env=staging

- stage: DeployProduction
  dependsOn: SmokeTests
  jobs:
  - deployment: DeployProduction
    environment: production
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: drop
          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure-Production'
              appName: 'myapp-production'

- stage: PostDeployment
  dependsOn: DeployProduction
  jobs:
  - job: VerificationJob
    steps:
    - script: |
        curl -f https://app.example.com/health || exit 1
        npm run test:smoke -- --env=production
    - script: echo "Notifying stakeholders..."
```

---

## Deployment Strategies

### Blue-Green Deployment

**Concept**: Maintain two identical production environments (Blue and Green). Deploy to inactive environment, test, then switch traffic.

```yaml
# GitHub Actions with Blue-Green
name: Blue-Green Deployment

on:
  workflow_dispatch:
    inputs:
      version:
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Determine active environment
      id: active
      run: |
        ACTIVE=$(curl -s https://example.com/active-env)
        if [ "$ACTIVE" = "blue" ]; then
          echo "inactive=green" >> $GITHUB_OUTPUT
        else
          echo "inactive=blue" >> $GITHUB_OUTPUT
        fi

    - name: Deploy to inactive environment
      run: |
        echo "Deploying to ${{ steps.active.outputs.inactive }}"
        ./deploy.sh ${{ steps.active.outputs.inactive }} ${{ github.event.inputs.version }}

    - name: Run smoke tests
      run: |
        ./smoke-tests.sh ${{ steps.active.outputs.inactive }}

    - name: Switch traffic
      run: |
        echo "Switching traffic to ${{ steps.active.outputs.inactive }}"
        ./switch-traffic.sh ${{ steps.active.outputs.inactive }}

    - name: Monitor new environment
      run: |
        ./monitor.sh ${{ steps.active.outputs.inactive }} --duration=10m

    - name: Rollback if needed
      if: failure()
      run: |
        echo "Rolling back to previous environment"
        ./switch-traffic.sh blue  # Switch back
```

**Pros:**
- Zero downtime
- Instant rollback
- Full testing before switch

**Cons:**
- Requires double infrastructure
- Database migration complexity
- Cost

### Canary Deployment

**Concept**: Gradually roll out changes to a small subset of users, monitor, then expand to all users.

```yaml
# Kubernetes Canary Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1  # Start with 1 replica (10% if 10 total)
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
      - name: myapp
        image: myapp:v2.0.0
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9  # 90% of traffic
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
      - name: myapp
        image: myapp:v1.0.0
```

**GitHub Actions Canary Pipeline:**

```yaml
name: Canary Deployment

on:
  workflow_dispatch:
    inputs:
      canary-percentage:
        required: true
        type: choice
        options:
          - '10'
          - '25'
          - '50'
          - '100'

jobs:
  deploy-canary:
    runs-on: ubuntu-latest
    steps:
    - name: Deploy canary
      run: |
        kubectl scale deployment myapp-canary --replicas=${{ github.event.inputs.canary-percentage }}

    - name: Monitor metrics
      run: |
        ./monitor-canary.sh --percentage=${{ github.event.inputs.canary-percentage }} --duration=30m

    - name: Check error rate
      run: |
        ERROR_RATE=$(./get-error-rate.sh canary)
        if [ $(echo "$ERROR_RATE > 1.0" | bc) -eq 1 ]; then
          echo "Error rate too high: $ERROR_RATE%"
          exit 1
        fi

    - name: Rollback on failure
      if: failure()
      run: |
        kubectl scale deployment myapp-canary --replicas=0
        echo "Canary rolled back due to high error rate"

  promote-canary:
    needs: deploy-canary
    runs-on: ubuntu-latest
    if: github.event.inputs.canary-percentage == '100'
    steps:
    - name: Promote canary to stable
      run: |
        kubectl set image deployment/myapp-stable myapp=myapp:v2.0.0
        kubectl scale deployment myapp-canary --replicas=0
```

**Pros:**
- Low risk
- Real user feedback
- Gradual rollout

**Cons:**
- Complex to implement
- Longer deployment time
- Requires monitoring infrastructure

### Rolling Deployment

**Concept**: Gradually replace instances one at a time.

```yaml
# Kubernetes Rolling Update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # Max 2 extra pods during update
      maxUnavailable: 1  # Max 1 pod unavailable during update
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v2.0.0
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
```

**Pros:**
- Built-in to most orchestrators
- Automatic rollback on failure
- Zero downtime

**Cons:**
- Mixed versions during deployment
- Slower than blue-green

### Feature Flags / Feature Toggles

**Concept**: Deploy code with features disabled, enable gradually via configuration.

```yaml
# GitHub Actions with Feature Flags
name: Deploy with Feature Flags

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Deploy application
      run: |
        ./deploy.sh production

    - name: Configure feature flags
      run: |
        # Enable new feature for 10% of users
        ./feature-flag.sh --feature=new-checkout --percentage=10 --env=production

    - name: Monitor metrics
      run: |
        ./monitor.sh --feature=new-checkout --duration=1h

    - name: Increase rollout
      if: success()
      run: |
        ./feature-flag.sh --feature=new-checkout --percentage=50 --env=production
```

**Implementation Example:**

```csharp
// .NET with feature flags
public class FeatureFlagService
{
    private readonly IConfiguration _config;

    public FeatureFlagService(IConfiguration config)
    {
        _config = config;
    }

    public bool IsEnabled(string feature, string userId = null)
    {
        var percentage = _config.GetValue<int>($"FeatureFlags:{feature}:Percentage");

        if (percentage == 100) return true;
        if (percentage == 0) return false;

        if (userId != null)
        {
            var hash = GetConsistentHash(userId);
            return hash % 100 < percentage;
        }

        return false;
    }

    private int GetConsistentHash(string input)
    {
        using var md5 = MD5.Create();
        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(input));
        return BitConverter.ToInt32(hash, 0);
    }
}
```

---

## Rollback Procedures

### Automated Rollback

```yaml
# GitHub Actions with Automated Rollback
name: Deploy with Rollback

on:
  workflow_dispatch:
    inputs:
      version:
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Deploy version
      id: deploy
      run: |
        ./deploy.sh ${{ github.event.inputs.version }}
        echo "deployed-version=${{ github.event.inputs.version }}" >> $GITHUB_OUTPUT

    - name: Health check
      id: health
      run: |
        sleep 30  # Wait for deployment
        HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)
        if [ $HEALTH -eq 200 ]; then
          echo "Health check passed"
        else
          echo "Health check failed: $HEALTH"
          exit 1
        fi

    - name: Monitor error rate
      id: monitor
      run: |
        ERROR_RATE=$(./get-error-rate.sh --duration=5m)
        BASELINE_ERROR_RATE=0.5

        if [ $(echo "$ERROR_RATE > $BASELINE_ERROR_RATE * 2" | bc) -eq 1 ]; then
          echo "Error rate too high: $ERROR_RATE% (baseline: $BASELINE_ERROR_RATE%)"
          exit 1
        fi

    - name: Rollback on failure
      if: failure()
      run: |
        echo "Rolling back to previous version"
        PREVIOUS_VERSION=$(./get-previous-version.sh)
        ./deploy.sh $PREVIOUS_VERSION

        # Verify rollback
        sleep 30
        HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)
        if [ $HEALTH -ne 200 ]; then
          echo "Rollback failed! Manual intervention required!"
          exit 1
        fi

    - name: Notify team
      if: always()
      run: |
        if [ "${{ job.status }}" = "success" ]; then
          ./notify.sh "✅ Deployment successful: ${{ github.event.inputs.version }}"
        else
          ./notify.sh "❌ Deployment failed, rolled back to previous version"
        fi
```

### Manual Rollback

```bash
# Script: rollback.sh
#!/bin/bash

# Get current version
CURRENT_VERSION=$(kubectl get deployment myapp -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)

echo "Current version: $CURRENT_VERSION"

# Get previous versions from registry
echo "Available versions:"
./list-versions.sh | tail -10

# Prompt for version to rollback to
read -p "Enter version to rollback to: " ROLLBACK_VERSION

# Confirm rollback
read -p "Rollback from $CURRENT_VERSION to $ROLLBACK_VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 1
fi

# Perform rollback
echo "Rolling back..."
kubectl set image deployment/myapp myapp=myapp:$ROLLBACK_VERSION

# Wait for rollout
kubectl rollout status deployment/myapp --timeout=5m

# Verify health
echo "Verifying health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://app.example.com/health)

if [ $HEALTH -eq 200 ]; then
    echo "✅ Rollback successful"
else
    echo "❌ Rollback failed! Health check returned: $HEALTH"
    exit 1
fi
```

### Database Rollback

```sql
-- Migration versioning (Flyway / Liquibase style)

-- V1__initial_schema.sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

-- V2__add_phone_column.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- U2__rollback_phone_column.sql (Undo script)
ALTER TABLE users DROP COLUMN phone;
```

**Rollback strategy:**
1. **Forward-only migrations**: Never delete columns, mark as deprecated
2. **Backward-compatible migrations**: Ensure new code works with old schema
3. **Blue-green with separate databases**: Rollback by switching database connection

---

## Release Automation

### Automated Version Bumping

```yaml
# .github/workflows/version-bump.yml
name: Version Bump

on:
  push:
    branches: [ main ]

jobs:
  bump-version:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
        token: ${{ secrets.PAT_TOKEN }}  # Personal Access Token for pushing

    - name: Determine version bump
      id: bump
      run: |
        # Check commit messages for conventional commits
        if git log -1 --pretty=%B | grep -q "BREAKING CHANGE"; then
          echo "bump=major" >> $GITHUB_OUTPUT
        elif git log -1 --pretty=%B | grep -q "^feat"; then
          echo "bump=minor" >> $GITHUB_OUTPUT
        else
          echo "bump=patch" >> $GITHUB_OUTPUT
        fi

    - name: Bump version
      run: |
        npm version ${{ steps.bump.outputs.bump }} --no-git-tag-version

    - name: Commit version bump
      run: |
        NEW_VERSION=$(node -p "require('./package.json').version")
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add package.json
        git commit -m "chore: bump version to $NEW_VERSION"
        git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"
        git push origin main --tags
```

### Automated Changelog Generation

```yaml
# .github/workflows/changelog.yml
name: Generate Changelog

on:
  push:
    tags:
      - 'v*'

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Generate changelog
      run: |
        PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || git rev-list --max-parents=0 HEAD)

        echo "# Changelog for ${{ github.ref_name }}" > CHANGELOG.md
        echo "" >> CHANGELOG.md
        echo "## Features" >> CHANGELOG.md
        git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^feat" >> CHANGELOG.md
        echo "" >> CHANGELOG.md
        echo "## Bug Fixes" >> CHANGELOG.md
        git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^fix" >> CHANGELOG.md
        echo "" >> CHANGELOG.md
        echo "## Other Changes" >> CHANGELOG.md
        git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --grep="^chore\\|^docs" >> CHANGELOG.md

    - name: Commit changelog
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add CHANGELOG.md
        git commit -m "docs: update changelog for ${{ github.ref_name }}"
        git push
```

---

## Change Management

### Release Checklist

```markdown
# Release Checklist: v1.2.3

## Pre-Release
- [ ] All tests passing
- [ ] Code coverage ≥ 80%
- [ ] Security scan completed
- [ ] Dependencies updated
- [ ] Changelog generated
- [ ] Release notes drafted
- [ ] Migration scripts tested
- [ ] Rollback procedure documented
- [ ] Stakeholders notified

## Deployment
- [ ] Deploy to staging
- [ ] Smoke tests passed (staging)
- [ ] Load testing completed
- [ ] Deploy to production
- [ ] Smoke tests passed (production)
- [ ] Monitoring dashboards updated

## Post-Release
- [ ] Health checks verified
- [ ] Error rates baseline
- [ ] Performance metrics baseline
- [ ] User feedback monitored
- [ ] Incident response ready
- [ ] Documentation updated
- [ ] Release announcement sent
```

### Release Communication Template

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

## Release Documentation

### Release Runbook Template

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
- Set Slack status: "🚀 Deploying"

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
- Post in #deployments: "✅ Production deployment complete"
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
❌ Rollback Initiated
Version: v1.2.3 → v1.2.2
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

---

## Best Practices

### ✅ DO

**Versioning:**
- Use semantic versioning consistently
- Tag releases in version control
- Maintain changelog automatically
- Version APIs explicitly

**Release Process:**
- Test in staging before production
- Implement gradual rollouts
- Monitor metrics during deployment
- Have rollback plan ready
- Document release procedures

**Communication:**
- Notify stakeholders before deployment
- Communicate breaking changes
- Update documentation
- Post release notes
- Track user feedback

**Automation:**
- Automate version bumping
- Generate changelogs automatically
- Automate smoke tests
- Implement automated rollback on failure
- Use feature flags for risky changes

**Monitoring:**
- Track error rates
- Monitor performance metrics
- Set up alerts
- Use distributed tracing
- Implement health checks

### ❌ DON'T

**Anti-Patterns:**
- Deploy on Fridays (or before holidays)
- Skip testing in staging
- Deploy without rollback plan
- Make breaking changes without warning
- Deploy multiple major changes together

**Versioning:**
- Skip versions
- Use inconsistent versioning schemes
- Forget to tag releases
- Hard-code version numbers

**Process:**
- Deploy without monitoring
- Skip change approval process
- Deploy without on-call coverage
- Ignore failed health checks
- Rush deployments

---

## Deployment Strategy Selection

| Strategy | Best For | Downtime | Rollback Speed | Complexity |
|----------|----------|----------|----------------|------------|
| **Rolling** | Most applications | None | Medium | Low |
| **Blue-Green** | Zero downtime critical | None | Instant | Medium |
| **Canary** | Risk mitigation | None | Medium | High |
| **Feature Flags** | Gradual rollout | None | Instant | Medium |
| **Recreate** | Dev/Test environments | Yes | Fast | Low |

---

**Related Skills**:
- [GitHub Actions & Workflows](../github-actions-workflows/SKILL.md)
- [YAML Pipelines](../yaml-pipelines/SKILL.md)
- [Version Control](../../development/version-control/SKILL.md)
- [Monitoring & Logging](../../development/logging-monitoring/SKILL.md)

**Resources**:
- [Semantic Versioning](https://semver.org/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Martin Fowler - BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)

---

**Version**: 1.0
**Last Updated**: February 5, 2026
