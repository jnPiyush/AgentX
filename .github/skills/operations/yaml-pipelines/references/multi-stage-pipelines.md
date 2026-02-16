# Multi-Stage Pipeline Examples

> Load when implementing multi-stage deployment pipelines. See [SKILL.md](../SKILL.md) for concepts.

## Azure Multi-Stage with Approvals

```yaml
stages:
- stage: Build
 jobs:
 - job: Build
 steps:
 - script: echo "Building..."

- stage: DeployDev
 dependsOn: Build
 jobs:
 - deployment: DeployDev
 environment: development # No approval
 strategy:
 runOnce:
 deploy:
 steps:
 - script: echo "Deploy to dev"

- stage: DeployQA
 dependsOn: DeployDev
 jobs:
 - deployment: DeployQA
 environment: qa # Configure approval in environment settings
 strategy:
 runOnce:
 deploy:
 steps:
 - script: echo "Deploy to QA"

- stage: DeployProd
 dependsOn: DeployQA
 jobs:
 - deployment: DeployProd
 environment: production # Requires approval
 strategy:
 runOnce:
 deploy:
 steps:
 - script: echo "Deploy to production"
```

## GitLab Multi-Environment

```yaml
stages:
 - build
 - test
 - deploy:dev
 - deploy:staging
 - deploy:prod

build:
 stage: build
 script:
 - npm run build

test:
 stage: test
 script:
 - npm test

deploy:dev:
 stage: deploy:dev
 script:
 - npm run deploy:dev
 environment:
 name: development
 only:
 - develop

deploy:staging:
 stage: deploy:staging
 script:
 - npm run deploy:staging
 environment:
 name: staging
 only:
 - main

deploy:production:
 stage: deploy:prod
 script:
 - npm run deploy:production
 environment:
 name: production
 only:
 - main
 when: manual
```
