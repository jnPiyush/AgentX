---
description: 'DevOps instructions for CI/CD pipelines, GitHub Actions, and deployment automation.'
applyTo: "**/*.yml,**/*.yaml,**/workflows/**,.github/workflows/**"
---

# DevOps Instructions

Instructions for CI/CD pipelines, GitHub Actions, and deployment automation.

## GitHub Actions Workflow Structure

### Basic Workflow
```yaml
name: CI Pipeline

on:
 push:
 branches: [main, develop]
 pull_request:
 branches: [main]
 workflow_dispatch:

env:
 NODE_VERSION: '20.x'
 DOTNET_VERSION: '8.0.x'

jobs:
 build:
 runs-on: ubuntu-latest

 steps:
 - name: Checkout
 uses: actions/checkout@v4

 - name: Setup Node
 uses: actions/setup-node@v4
 with:
 node-version: ${{ env.NODE_VERSION }}
 cache: 'npm'

 - name: Install dependencies
 run: npm ci

 - name: Build
 run: npm run build

 - name: Test
 run: npm test
```

## Matrix Builds

```yaml
jobs:
 test:
 runs-on: ${{ matrix.os }}
 strategy:
 matrix:
 os: [ubuntu-latest, windows-latest]
 node: [18, 20]
 exclude:
 - os: windows-latest
 node: 18

 steps:
 - uses: actions/checkout@v4
 - uses: actions/setup-node@v4
 with:
 node-version: ${{ matrix.node }}
 - run: npm ci && npm test
```

## Secrets Management

### Using Secrets
```yaml
steps:
 - name: Deploy
 env:
 API_KEY: ${{ secrets.API_KEY }}
 DATABASE_URL: ${{ secrets.DATABASE_URL }}
 run: |
 # Secrets are masked in logs
 ./deploy.sh
```

### Setting Secrets via CLI
```bash
# Repository secret
gh secret set API_KEY --body "secret_value"

# Environment secret
gh secret set DATABASE_URL --env production --body "connection_string"

# From file
gh secret set CREDENTIALS < credentials.json
```

## Caching

### NPM Cache
```yaml
- uses: actions/setup-node@v4
 with:
 node-version: '20'
 cache: 'npm'
```

### Custom Cache
```yaml
- name: Cache dependencies
 uses: actions/cache@v4
 with:
 path: |
 ~/.nuget/packages
 ~/.npm
 key: ${{ runner.os }}-deps-${{ hashFiles('**/package-lock.json', '**/*.csproj') }}
 restore-keys: |
 ${{ runner.os }}-deps-
```

## Artifacts

### Upload Artifact
```yaml
- name: Build
 run: dotnet publish -c Release -o ./publish

- name: Upload artifact
 uses: actions/upload-artifact@v4
 with:
 name: app-package
 path: ./publish/
 retention-days: 5
```

### Download Artifact
```yaml
- name: Download artifact
 uses: actions/download-artifact@v4
 with:
 name: app-package
 path: ./deploy/
```

## Environments and Deployments

```yaml
jobs:
 deploy-staging:
 runs-on: ubuntu-latest
 environment:
 name: staging
 url: https://staging.example.com

 steps:
 - name: Deploy to staging
 run: ./deploy.sh staging
 env:
 DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}

 deploy-production:
 needs: deploy-staging
 runs-on: ubuntu-latest
 environment:
 name: production
 url: https://example.com

 steps:
 - name: Deploy to production
 run: ./deploy.sh production
 env:
 DEPLOY_TOKEN: ${{ secrets.PROD_DEPLOY_TOKEN }}
```

## Reusable Workflows

### Define Reusable Workflow
```yaml
# .github/workflows/build-template.yml
name: Build Template

on:
 workflow_call:
 inputs:
 environment:
 required: true
 type: string
 secrets:
 deploy_token:
 required: true

jobs:
 build:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4
 - run: ./build.sh ${{ inputs.environment }}
 env:
 TOKEN: ${{ secrets.deploy_token }}
```

### Call Reusable Workflow
```yaml
jobs:
 call-build:
 uses: ./.github/workflows/build-template.yml
 with:
 environment: staging
 secrets:
 deploy_token: ${{ secrets.DEPLOY_TOKEN }}
```

## Conditional Execution

```yaml
steps:
 - name: Deploy to production
 if: github.ref == 'refs/heads/main' && github.event_name == 'push'
 run: ./deploy.sh production

 - name: Run on PR only
 if: github.event_name == 'pull_request'
 run: ./pr-checks.sh

 - name: Always run
 if: always()
 run: ./cleanup.sh

 - name: Run on failure
 if: failure()
 run: ./notify-failure.sh
```

## Release Automation

```yaml
name: Release

on:
 push:
 tags:
 - 'v*.*.*'

jobs:
 release:
 runs-on: ubuntu-latest
 permissions:
 contents: write

 steps:
 - uses: actions/checkout@v4
 with:
 fetch-depth: 0

 - name: Build release
 run: ./build-release.sh

 - name: Create GitHub Release
 uses: softprops/action-gh-release@v1
 with:
 files: |
 dist/*.zip
 dist/*.tar.gz
 generate_release_notes: true
```

## Security Scanning

```yaml
jobs:
 security:
 runs-on: ubuntu-latest
 steps:
 - uses: actions/checkout@v4

 - name: Run dependency audit
 run: npm audit --audit-level=high

 - name: CodeQL Analysis
 uses: github/codeql-action/analyze@v3

 - name: Trivy vulnerability scan
 uses: aquasecurity/trivy-action@master
 with:
 scan-type: 'fs'
 severity: 'CRITICAL,HIGH'
```

## Best Practices

### DO
- Use specific action versions (`@v4` not `@latest`)
- Cache dependencies to speed up builds
- Use environments for deployment approvals
- Encrypt all secrets
- Use matrix builds for cross-platform testing
- Set timeouts on long-running jobs

### DON'T
- Hardcode secrets in workflow files
- Use `continue-on-error: true` without good reason
- Skip security scanning
- Deploy without testing first
- Use `sudo` unnecessarily

## Security Checklist

- [ ] All secrets stored in GitHub Secrets
- [ ] No hardcoded credentials in workflows
- [ ] Dependency scanning enabled
- [ ] Code scanning enabled
- [ ] Branch protection rules configured
- [ ] Required reviewers for production deployments

## References

- [Skill #26: GitHub Actions](.github/skills/operations/github-actions-workflows/SKILL.md)
- [Skill #27: YAML Pipelines](.github/skills/operations/yaml-pipelines/SKILL.md)
- [Skill #28: Release Management](.github/skills/operations/release-management/SKILL.md)
- [Skill #04: Security](.github/skills/architecture/security/SKILL.md)
