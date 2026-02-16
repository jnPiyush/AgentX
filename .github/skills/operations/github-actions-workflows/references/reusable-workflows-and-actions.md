# Reusable Workflows, Custom Actions & Caching Reference

> Load when creating reusable workflows, custom actions, or caching. See [SKILL.md](../SKILL.md) for concepts.

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
# Settings -> Environments -> production -> Required reviewers

jobs:
 deploy-prod:
 runs-on: ubuntu-latest
 environment:
 name: production # Requires manual approval

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
