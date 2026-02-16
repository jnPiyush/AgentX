# Workflow Syntax & Event Triggers Reference

> Load when configuring workflow triggers and syntax. See [SKILL.md](../SKILL.md) for concepts.

---

## Complete Workflow Structure

```yaml
name: Complete Workflow Example

# Triggers
on:
 push:
 branches: [ main, develop ]
 paths:
 - 'src/**'
 - 'tests/**'
 tags:
 - 'v*'
 pull_request:
 branches: [ main ]
 workflow_dispatch: # Manual trigger
 inputs:
 environment:
 description: 'Deployment environment'
 required: true
 type: choice
 options:
 - dev
 - staging
 - prod
 schedule:
 - cron: '0 2 * * *' # Daily at 2 AM UTC

# Global environment variables
env:
 NODE_VERSION: '20.x'
 DOTNET_VERSION: '8.0.x'
 DEPLOY_ENV: 'production'

# Permissions (explicit is better)
permissions:
 contents: read
 pull-requests: write

# Concurrency control
concurrency:
 group: ${{ github.workflow }}-${{ github.ref }}
 cancel-in-progress: true

jobs:
 build:
 name: Build and Test
 runs-on: ubuntu-latest
 timeout-minutes: 15

 # Job-level environment variables
 env:
 BUILD_CONFIG: Release

 steps:
 - name: Checkout
 uses: actions/checkout@v4
 with:
 fetch-depth: 0

 - name: Setup Node.js
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

 - name: Upload artifacts
 uses: actions/upload-artifact@v4
 with:
 name: build-output
 path: dist/
 retention-days: 7

 deploy:
 name: Deploy
 needs: build
 runs-on: ubuntu-latest
 environment:
 name: production
 url: https://app.example.com

 steps:
 - name: Download artifacts
 uses: actions/download-artifact@v4
 with:
 name: build-output

 - name: Deploy
 run: echo "Deploying to production..."
```

---

## Events and Triggers

### Push Events

```yaml
on:
 push:
 # Specific branches
 branches:
 - main
 - develop
 - 'release/**'

 # Branch patterns (exclude)
 branches-ignore:
 - 'experimental/**'

 # Specific paths
 paths:
 - 'src/**'
 - 'package.json'

 # Path patterns (exclude)
 paths-ignore:
 - 'docs/**'
 - '**.md'

 # Tags
 tags:
 - 'v*.*.*'
```

### Pull Request Events

```yaml
on:
 pull_request:
 types:
 - opened
 - synchronize
 - reopened
 - ready_for_review
 branches:
 - main
 paths:
 - 'src/**'
 - 'tests/**'

 pull_request_target: # For PRs from forks (use carefully!)
 types:
 - opened
```

### Manual Triggers

```yaml
on:
 workflow_dispatch:
 inputs:
 environment:
 description: 'Target environment'
 required: true
 type: choice
 options:
 - development
 - staging
 - production
 version:
 description: 'Version to deploy'
 required: false
 type: string
 default: 'latest'
 debug:
 description: 'Enable debug mode'
 required: false
 type: boolean
 default: false
```

### Scheduled Events

```yaml
on:
 schedule:
 # Daily at 2 AM UTC
 - cron: '0 2 * * *'

 # Every 15 minutes
 - cron: '*/15 * * * *'

 # Weekdays at 9 AM UTC
 - cron: '0 9 * * 1-5'

 # First day of month
 - cron: '0 0 1 * *'
```

### Workflow Call (Reusable)

```yaml
on:
 workflow_call:
 inputs:
 config-path:
 required: true
 type: string
 environment:
 required: false
 type: string
 default: 'dev'
 secrets:
 token:
 required: true
```
