---
name: github-actions-workflows
description: 'Best practices for creating GitHub Actions workflows, reusable workflows, custom actions, and workflow automation.'
---

# GitHub Actions & Workflows

> **Purpose**: Comprehensive guide for building, testing, and deploying with GitHub Actions workflows.

---

## Table of Contents

1. [Workflow Basics](#workflow-basics)
2. [Workflow Syntax](#workflow-syntax)
3. [Events and Triggers](#events-and-triggers)
4. [Jobs and Steps](#jobs-and-steps)
5. [Actions Marketplace](#actions-marketplace)
6. [Secrets and Variables](#secrets-and-variables)
7. [Matrix Builds](#matrix-builds)
8. [Caching Dependencies](#caching-dependencies)
9. [Environments and Deployments](#environments-and-deployments)
10. [Reusable Workflows](#reusable-workflows)
11. [Custom Actions](#custom-actions)
12. [Security Best Practices](#security-best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Workflow Basics

### Directory Structure

```
.github/
└── workflows/
    ├── ci.yml              # Continuous Integration
    ├── cd.yml              # Continuous Deployment
    ├── release.yml         # Release automation
    ├── pr-checks.yml       # Pull request validation
    └── scheduled-tasks.yml # Scheduled jobs
```

### Basic Workflow File

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run build
      run: echo "Building application..."

    - name: Run tests
      run: echo "Running tests..."
```

---

## Workflow Syntax

### Complete Workflow Structure

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
  workflow_dispatch:  # Manual trigger
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
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

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

  pull_request_target:  # For PRs from forks (use carefully!)
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

---

## Jobs and Steps

### Job Dependencies

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Building..."

  test:
    needs: build  # Wait for build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Testing..."

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to staging..."

  deploy-prod:
    needs: [test, deploy-staging]  # Multiple dependencies
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to production..."
```

### Conditional Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Always runs"

  deploy-dev:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy to dev"

  deploy-prod:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy to prod"

  manual-step:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Manual trigger"
```

### Conditional Steps

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Run on main branch only
    if: github.ref == 'refs/heads/main'
    run: echo "Main branch"

  - name: Run on PR only
    if: github.event_name == 'pull_request'
    run: echo "Pull request"

  - name: Run on success
    if: success()
    run: echo "Previous steps succeeded"

  - name: Run on failure
    if: failure()
    run: echo "Previous steps failed"

  - name: Always run
    if: always()
    run: echo "Runs regardless of status"

  - name: Run on cancelled
    if: cancelled()
    run: echo "Workflow was cancelled"
```

### Runner Selection

```yaml
jobs:
  linux:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Linux"

  windows:
    runs-on: windows-latest
    steps:
      - run: echo "Windows"

  macos:
    runs-on: macos-latest
    steps:
      - run: echo "macOS"

  self-hosted:
    runs-on: [self-hosted, linux, x64, gpu]
    steps:
      - run: echo "Self-hosted runner"

  specific-version:
    runs-on: ubuntu-22.04  # Specific version
    steps:
      - run: echo "Ubuntu 22.04"
```

---

## Actions Marketplace

### Essential Actions

#### Checkout Code

```yaml
- name: Checkout code
  uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history
    submodules: true  # Include submodules
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Setup Language Runtimes

```yaml
# Node.js
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20.x'
    cache: 'npm'

# .NET
- name: Setup .NET
  uses: actions/setup-dotnet@v4
  with:
    dotnet-version: '8.0.x'

# Python
- name: Setup Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.11'
    cache: 'pip'

# Java
- name: Setup Java
  uses: actions/setup-java@v4
  with:
    java-version: '17'
    distribution: 'temurin'
    cache: 'maven'

# Go
- name: Setup Go
  uses: actions/setup-go@v5
  with:
    go-version: '1.21'
    cache: true
```

#### Caching

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Cache NuGet packages
  uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
```

#### Upload/Download Artifacts

```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: |
      dist/
      build/
    retention-days: 7

- name: Download artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-output
    path: ./artifacts
```

#### Code Coverage

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/coverage.xml
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: true
```

#### Docker

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_PASSWORD }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: user/app:latest
    cache-from: type=registry,ref=user/app:buildcache
    cache-to: type=registry,ref=user/app:buildcache,mode=max
```

---

## Secrets and Variables

### Using Secrets

```yaml
steps:
  - name: Use secret
    run: echo "Secret value is hidden"
    env:
      API_KEY: ${{ secrets.API_KEY }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}

  - name: Use in action
    uses: azure/login@v1
    with:
      creds: ${{ secrets.AZURE_CREDENTIALS }}
```

### Environment Variables

```yaml
# Global
env:
  GLOBAL_VAR: 'global value'

jobs:
  build:
    # Job-level
    env:
      JOB_VAR: 'job value'

    steps:
      # Step-level
      - name: Use variables
        env:
          STEP_VAR: 'step value'
        run: |
          echo "Global: $GLOBAL_VAR"
          echo "Job: $JOB_VAR"
          echo "Step: $STEP_VAR"

      # GitHub context variables
      - name: GitHub variables
        run: |
          echo "Repository: ${{ github.repository }}"
          echo "Ref: ${{ github.ref }}"
          echo "SHA: ${{ github.sha }}"
          echo "Actor: ${{ github.actor }}"
          echo "Event: ${{ github.event_name }}"
```

### Configuration Variables

```yaml
# Repository/Organization/Environment variables
steps:
  - name: Use config variables
    run: |
      echo "Config: ${{ vars.ENVIRONMENT_NAME }}"
      echo "URL: ${{ vars.API_URL }}"
```

---

## Matrix Builds

### Basic Matrix

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20, 22]

    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm test
```

### Matrix with Exclusions

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18, 20, 22]
    exclude:
      - os: windows-latest
        node-version: 18

    include:
      - os: ubuntu-latest
        node-version: 22
        extra-flag: '--experimental'
```

### Fail-Fast and Max-Parallel

```yaml
strategy:
  fail-fast: false  # Continue other jobs if one fails
  max-parallel: 3   # Run max 3 jobs concurrently
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20, 22]
```

---

## Caching Dependencies

### Node.js (npm)

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Install dependencies
  run: npm ci
```

### .NET (NuGet)

```yaml
- name: Cache NuGet packages
  uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
    restore-keys: |
      ${{ runner.os }}-nuget-

- name: Restore dependencies
  run: dotnet restore
```

### Python (pip)

```yaml
- name: Cache pip packages
  uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- name: Install dependencies
  run: pip install -r requirements.txt
```

### Docker Layers

```yaml
- name: Setup Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build with cache
  uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

## Environments and Deployments

### Environment Configuration

```yaml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.app.example.com

    steps:
    - name: Deploy to staging
      run: echo "Deploying..."
      env:
        API_KEY: ${{ secrets.STAGING_API_KEY }}

  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com

    steps:
    - name: Deploy to production
      run: echo "Deploying..."
      env:
        API_KEY: ${{ secrets.PROD_API_KEY }}
```

### Deployment with Approval

```yaml
# Configure required reviewers in repository settings:
# Settings → Environments → production → Required reviewers

jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production  # Requires manual approval

    steps:
    - name: Deploy
      run: echo "Deploying after approval..."
```

---

## Reusable Workflows

### Define Reusable Workflow

```yaml
# .github/workflows/reusable-build.yml
name: Reusable Build Workflow

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: '20.x'
      environment:
        required: true
        type: string
    secrets:
      deploy-token:
        required: true
    outputs:
      build-status:
        description: "Build completion status"
        value: ${{ jobs.build.outputs.status }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      status: ${{ steps.build.outputs.status }}

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}

    - name: Build
      id: build
      run: |
        npm ci
        npm run build
        echo "status=success" >> $GITHUB_OUTPUT

    - name: Deploy
      run: echo "Deploying to ${{ inputs.environment }}"
      env:
        TOKEN: ${{ secrets.deploy-token }}
```

### Call Reusable Workflow

```yaml
# .github/workflows/main.yml
name: Main Workflow

on: [push]

jobs:
  build-dev:
    uses: ./.github/workflows/reusable-build.yml
    with:
      node-version: '20.x'
      environment: 'development'
    secrets:
      deploy-token: ${{ secrets.DEV_DEPLOY_TOKEN }}

  build-prod:
    uses: ./.github/workflows/reusable-build.yml
    with:
      node-version: '20.x'
      environment: 'production'
    secrets:
      deploy-token: ${{ secrets.PROD_DEPLOY_TOKEN }}
```

---

## Custom Actions

### JavaScript Action

```yaml
# action.yml
name: 'Custom JavaScript Action'
description: 'Example custom action'
inputs:
  name:
    description: 'Name to greet'
    required: true
    default: 'World'
outputs:
  message:
    description: 'Greeting message'
runs:
  using: 'node20'
  main: 'index.js'
```

```javascript
// index.js
const core = require('@actions/core');

try {
  const name = core.getInput('name');
  const message = `Hello ${name}!`;
  core.setOutput('message', message);
  console.log(message);
} catch (error) {
  core.setFailed(error.message);
}
```

### Composite Action

```yaml
# action.yml
name: 'Setup Project'
description: 'Setup Node.js and install dependencies'
inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20.x'
runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
      shell: bash

    - name: Install dependencies
      run: npm ci
      shell: bash

    - name: Run build
      run: npm run build
      shell: bash
```

### Use Custom Action

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Use custom action
    uses: ./.github/actions/my-action
    with:
      name: 'GitHub Actions'

  - name: Use composite action
    uses: ./.github/actions/setup-project
    with:
      node-version: '20.x'
```

---

## Security Best Practices

### Secret Management

```yaml
# ✅ GOOD: Use secrets
steps:
  - name: Deploy
    run: ./deploy.sh
    env:
      API_KEY: ${{ secrets.API_KEY }}

# ❌ BAD: Hardcoded secrets
steps:
  - name: Deploy
    run: ./deploy.sh
    env:
      API_KEY: 'sk_live_abc123'  # Never do this!
```

### Pinning Action Versions

```yaml
# ✅ GOOD: Pin to commit SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1

# ⚠️ OK: Pin to major version
- uses: actions/checkout@v4

# ❌ BAD: Using latest
- uses: actions/checkout@main
```

### Minimal Permissions

```yaml
# ✅ GOOD: Explicit permissions
permissions:
  contents: read
  pull-requests: write
  issues: write

# ❌ BAD: Overly permissive
permissions: write-all
```

### Pull Request Security

```yaml
# ✅ GOOD: Use pull_request for forks (read-only)
on:
  pull_request:

# ⚠️ DANGEROUS: Use pull_request_target carefully (write access)
on:
  pull_request_target:
    types: [labeled]

jobs:
  safe-job:
    if: contains(github.event.pull_request.labels.*.name, 'safe-to-run')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
```

### Script Injection Prevention

```yaml
# ✅ GOOD: Use environment variable
- name: Print title
  env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"

# ❌ BAD: Direct interpolation (vulnerable to injection)
- name: Print title
  run: echo "${{ github.event.pull_request.title }}"
```

---

## Troubleshooting

### Debug Logging

```yaml
# Enable debug logging by setting repository secret:
# ACTIONS_RUNNER_DEBUG = true
# ACTIONS_STEP_DEBUG = true

steps:
  - name: Debug information
    run: |
      echo "Runner OS: ${{ runner.os }}"
      echo "Runner temp: ${{ runner.temp }}"
      echo "Workspace: ${{ github.workspace }}"
      echo "Event name: ${{ github.event_name }}"
```

### Common Issues

#### Cache Not Working

```yaml
# Ensure cache key is unique and path is correct
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm  # Verify this path
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

#### Workflow Not Triggering

```yaml
# Check branch names, paths, and event types
on:
  push:
    branches: [ main ]  # Case-sensitive
    paths:
      - 'src/**'  # Must match actual changes
```

#### Syntax Errors

```bash
# Validate workflow syntax locally
# Install actionlint: https://github.com/rhysd/actionlint
actionlint .github/workflows/*.yml
```

---

## Best Practices Summary

### ✅ DO

- Pin actions to specific versions (preferably commit SHAs)
- Use minimal permissions
- Cache dependencies for faster builds
- Use matrix builds for multiple targets
- Implement proper error handling
- Use reusable workflows for common patterns
- Document workflows and custom actions
- Test workflows in feature branches
- Use environment-specific secrets
- Enable branch protection rules

### ❌ DON'T

- Hardcode secrets or credentials
- Use `pull_request_target` without careful validation
- Grant excessive permissions
- Skip security scanning
- Ignore workflow failures
- Mix application logic with workflow logic
- Use unstable action versions
- Commit workflow artifacts to repository

---

**Related Skills**:
- [CI/CD Pipelines](../ci-cd-pipelines/SKILL.md)
- [Release Management](../release-management/SKILL.md)
- [Security](../../architecture/security/SKILL.md)
- [Remote Git Operations](16-remote-git-operations.md)

**Resources**:
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Actions Marketplace](https://github.com/marketplace?type=actions)
- [Workflow Syntax Reference](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions)

---

**Version**: 1.0
**Last Updated**: February 5, 2026
