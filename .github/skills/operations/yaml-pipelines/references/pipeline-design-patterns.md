# Pipeline Design Patterns

> Load when designing pipeline architecture. See [SKILL.md](../SKILL.md) for pattern selection.

## Sequential Stages Pattern

```yaml
# Azure Pipelines
stages:
- stage: Build
 jobs:
 - job: BuildJob
 steps:
 - script: echo "Building..."

- stage: Test
 dependsOn: Build
 jobs:
 - job: TestJob
 steps:
 - script: echo "Testing..."

- stage: Deploy
 dependsOn: Test
 jobs:
 - job: DeployJob
 steps:
 - script: echo "Deploying..."
```

## Parallel Jobs Pattern

```yaml
# GitLab CI
stages:
 - test

test:unit:
 stage: test
 script:
 - npm run test:unit

test:integration:
 stage: test
 script:
 - npm run test:integration

test:e2e:
 stage: test
 script:
 - npm run test:e2e
```

## Fan-out/Fan-in Pattern

```yaml
# Azure Pipelines
stages:
- stage: Build
 jobs:
 - job: Build
 steps:
 - script: echo "Building..."

- stage: ParallelTests
 dependsOn: Build
 jobs:
 - job: UnitTests
 steps:
 - script: echo "Unit tests..."

 - job: IntegrationTests
 steps:
 - script: echo "Integration tests..."

 - job: E2ETests
 steps:
 - script: echo "E2E tests..."

- stage: Deploy
 dependsOn: ParallelTests # Waits for all parallel jobs
 jobs:
 - job: Deploy
 steps:
 - script: echo "Deploying..."
```

## Canary Deployment Pattern

```yaml
# GitLab CI
deploy:canary:
 stage: deploy
 script:
 - kubectl apply -f k8s/canary/
 environment:
 name: production/canary
 url: https://canary.example.com
 only:
 - main
 when: manual

deploy:production:
 stage: deploy
 script:
 - kubectl apply -f k8s/production/
 environment:
 name: production
 url: https://example.com
 only:
 - main
 when: manual
 needs:
 - deploy:canary
```
