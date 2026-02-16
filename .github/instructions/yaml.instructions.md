---
description: 'YAML and configuration file instructions for GitHub Actions workflows, Azure Pipelines, Docker Compose, and Kubernetes manifests.'
applyTo: '**/*.yml, **/*.yaml'
---

# YAML / Configuration Instructions

> **Note**: For GitHub Actions workflow-specific patterns, see `devops.instructions.md` which also applies to `*.yml`/`*.yaml`.

## Code Style

- Indent with 2 spaces (NEVER tabs)
- Use `yamllint` for linting
- Maximum line length: 120 characters
- Use block style (not flow style) for readability

## Formatting Rules

```yaml
# MUST: Use consistent indentation (2 spaces)
parent:
 child:
 grandchild: value

# MUST: Quote strings that could be misinterpreted
version: "3.8" # Not 3.8 (would be float)
enabled: "true" # Not true (would be boolean) - unless boolean is intended
port: "8080" # Not 8080 (would be integer) - unless integer is intended

# SHOULD: Use block scalars for multi-line strings
description: |
 This is a long description
 that spans multiple lines.

# SHOULD: Use folded scalars for wrapped paragraphs
summary: >
 This is a long paragraph that will be
 folded into a single line with a trailing newline.
```

## GitHub Actions Workflows

```yaml
# MUST: Pin action versions to full SHA (not tags)
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

# MUST: Set explicit permissions
permissions:
 contents: read
 pull-requests: write

# MUST: Set timeout on all jobs
jobs:
 build:
 runs-on: ubuntu-latest
 timeout-minutes: 15
 steps:
 - uses: actions/checkout@v4

# SHOULD: Use environment variables for repeated values
env:
 NODE_VERSION: "20"
 DOTNET_VERSION: "9.0.x"
```

## Docker Compose

```yaml
# MUST: Pin image versions (never use :latest in production)
services:
 api:
 image: myapp/api:1.2.3
 build:
 context: .
 dockerfile: Dockerfile
 ports:
 - "8080:8080"
 environment:
 - DATABASE_URL=${DATABASE_URL}
 healthcheck:
 test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
 interval: 30s
 timeout: 10s
 retries: 3
 deploy:
 resources:
 limits:
 memory: 512M
 cpus: "0.5"
```

## Kubernetes Manifests

```yaml
# MUST: Include resource limits and requests
apiVersion: apps/v1
kind: Deployment
metadata:
 name: api
 labels:
 app: api
 version: v1
spec:
 replicas: 3
 selector:
 matchLabels:
 app: api
 template:
 spec:
 containers:
 - name: api
 image: myapp/api:1.2.3
 ports:
 - containerPort: 8080
 resources:
 requests:
 memory: "128Mi"
 cpu: "100m"
 limits:
 memory: "512Mi"
 cpu: "500m"
 livenessProbe:
 httpGet:
 path: /health
 port: 8080
 initialDelaySeconds: 10
 readinessProbe:
 httpGet:
 path: /ready
 port: 8080
 initialDelaySeconds: 5
```

## Azure Pipelines

```yaml
# MUST: Use template references for reusable stages
trigger:
 branches:
 include:
 - main
 - release/*

pool:
 vmImage: "ubuntu-latest"

stages:
 - stage: Build
 jobs:
 - job: BuildApp
 timeoutInMinutes: 15
 steps:
 - task: UseDotNet@2
 inputs:
 version: "9.0.x"
 - script: dotnet build --configuration Release
 displayName: "Build"
```

## Security

- MUST NOT hardcode secrets in YAML files
- MUST use `${{ secrets.NAME }}` (GitHub Actions) or variable groups (Azure Pipelines)
- MUST pin action/image versions (SHA for actions, tag for images)
- SHOULD use environment protection rules for production deployments
- MUST set least-privilege permissions in workflow files

## Common Anti-Patterns

```yaml
# BAD: Unpinned action version
- uses: actions/checkout@main # Never use branch reference

# GOOD: Pinned to SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

# BAD: No timeout (job can run forever)
jobs:
 build:
 runs-on: ubuntu-latest

# GOOD: Explicit timeout
jobs:
 build:
 runs-on: ubuntu-latest
 timeout-minutes: 15

# BAD: Wildcard permissions
permissions: write-all

# GOOD: Least privilege
permissions:
 contents: read
 packages: write
```

## Validation

- Use `yamllint` to catch syntax and formatting errors
- Use `actionlint` for GitHub Actions workflow validation
- Use `kubeval` or `kubeconform` for Kubernetes manifest validation
- Use schema validation for custom YAML formats
