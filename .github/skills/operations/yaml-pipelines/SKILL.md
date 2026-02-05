---
name: yaml-pipelines
description: 'Comprehensive guide for creating YAML-based CI/CD pipelines across platforms including Azure Pipelines, GitLab CI, and platform-agnostic patterns.'
---

# YAML Pipelines & CI/CD Configuration

> **Purpose**: Best practices for creating YAML-based CI/CD pipelines across multiple platforms.

---

## Table of Contents

1. [Azure Pipelines](#azure-pipelines)
2. [GitLab CI/CD](#gitlab-cicd)
3. [Pipeline Design Patterns](#pipeline-design-patterns)
4. [Multi-Stage Pipelines](#multi-stage-pipelines)
5. [Templates and Reusability](#templates-and-reusability)
6. [Variables and Parameters](#variables-and-parameters)
7. [Conditions and Expressions](#conditions-and-expressions)
8. [Caching and Optimization](#caching-and-optimization)
9. [Security and Secrets](#security-and-secrets)
10. [Best Practices](#best-practices)

---

## Azure Pipelines

### Basic Pipeline Structure

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - src/*
    exclude:
      - docs/*

pr:
  branches:
    include:
      - main
  paths:
    exclude:
      - '*.md'

pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'
  dotnetVersion: '8.0.x'

steps:
- task: UseDotNet@2
  displayName: 'Install .NET SDK'
  inputs:
    version: $(dotnetVersion)

- script: dotnet restore
  displayName: 'Restore dependencies'

- script: dotnet build --configuration $(buildConfiguration)
  displayName: 'Build project'

- script: dotnet test --configuration $(buildConfiguration) --no-build
  displayName: 'Run tests'

- task: PublishTestResults@2
  inputs:
    testResultsFormat: 'VSTest'
    testResultsFiles: '**/*.trx'
```

### Multi-Stage Azure Pipeline

```yaml
# azure-pipelines.yml
trigger:
  - main

variables:
  buildConfiguration: 'Release'

stages:
- stage: Build
  displayName: 'Build and Test'
  jobs:
  - job: Build
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - task: UseDotNet@2
      inputs:
        version: '8.0.x'

    - script: |
        dotnet restore
        dotnet build --configuration $(buildConfiguration)
        dotnet test --configuration $(buildConfiguration) --collect:"XPlat Code Coverage"
      displayName: 'Build and Test'

    - task: PublishCodeCoverageResults@1
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: '$(Agent.TempDirectory)/**/coverage.cobertura.xml'

    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: '$(Build.ArtifactStagingDirectory)'
        artifactName: 'drop'

- stage: DeployDev
  displayName: 'Deploy to Development'
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
  jobs:
  - deployment: DeployDev
    environment: 'development'
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: drop

          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure-Dev'
              appName: 'myapp-dev'
              package: '$(Pipeline.Workspace)/drop/**/*.zip'

- stage: DeployProd
  displayName: 'Deploy to Production'
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployProd
    environment: 'production'
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      runOnce:
        deploy:
          steps:
          - download: current
            artifact: drop

          - task: AzureWebApp@1
            inputs:
              azureSubscription: 'Azure-Prod'
              appName: 'myapp-prod'
              package: '$(Pipeline.Workspace)/drop/**/*.zip'
```

### Azure Pipeline Templates

#### Template Definition

```yaml
# templates/build-template.yml
parameters:
  - name: buildConfiguration
    type: string
    default: 'Release'
  - name: dotnetVersion
    type: string
    default: '8.0.x'
  - name: runTests
    type: boolean
    default: true

steps:
- task: UseDotNet@2
  displayName: 'Install .NET ${{ parameters.dotnetVersion }}'
  inputs:
    version: ${{ parameters.dotnetVersion }}

- script: dotnet restore
  displayName: 'Restore dependencies'

- script: dotnet build --configuration ${{ parameters.buildConfiguration }}
  displayName: 'Build'

- ${{ if eq(parameters.runTests, true) }}:
  - script: dotnet test --configuration ${{ parameters.buildConfiguration }} --no-build
    displayName: 'Run tests'
```

#### Template Usage

```yaml
# azure-pipelines.yml
trigger:
  - main

stages:
- stage: Build
  jobs:
  - job: BuildJob
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - template: templates/build-template.yml
      parameters:
        buildConfiguration: 'Release'
        dotnetVersion: '8.0.x'
        runTests: true
```

### Azure Pipeline with Matrix

```yaml
strategy:
  matrix:
    Linux:
      imageName: 'ubuntu-latest'
    Windows:
      imageName: 'windows-latest'
    macOS:
      imageName: 'macOS-latest'
  maxParallel: 3

pool:
  vmImage: $(imageName)

steps:
- script: echo "Running on $(imageName)"
```

---

## GitLab CI/CD

### Basic GitLab Pipeline

```yaml
# .gitlab-ci.yml
image: node:20

stages:
  - build
  - test
  - deploy

variables:
  NODE_ENV: "production"

cache:
  paths:
    - node_modules/

before_script:
  - npm ci

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

test:unit:
  stage: test
  script:
    - npm run test:unit
  coverage: '/Coverage: \d+\.\d+%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

test:integration:
  stage: test
  script:
    - npm run test:integration

deploy:staging:
  stage: deploy
  script:
    - npm run deploy:staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy:production:
  stage: deploy
  script:
    - npm run deploy:production
  environment:
    name: production
    url: https://example.com
  only:
    - main
  when: manual
```

### GitLab with Docker

```yaml
# .gitlab-ci.yml
image: docker:latest

services:
  - docker:dind

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

stages:
  - build
  - test
  - deploy

before_script:
  - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

build:
  stage: build
  script:
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG

test:
  stage: test
  script:
    - docker pull $IMAGE_TAG
    - docker run $IMAGE_TAG npm test

deploy:
  stage: deploy
  script:
    - docker pull $IMAGE_TAG
    - docker tag $IMAGE_TAG $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
```

### GitLab Templates and Includes

```yaml
# .gitlab-ci.yml
include:
  - local: 'templates/build.yml'
  - local: 'templates/test.yml'
  - template: Security/SAST.gitlab-ci.yml
  - project: 'my-group/my-project'
    file: '/templates/deploy.yml'

variables:
  APP_NAME: "my-app"

stages:
  - build
  - test
  - security
  - deploy
```

```yaml
# templates/build.yml
.build_template:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/

build:development:
  extends: .build_template
  variables:
    NODE_ENV: "development"

build:production:
  extends: .build_template
  variables:
    NODE_ENV: "production"
```

---

## Pipeline Design Patterns

### Sequential Stages Pattern

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

### Parallel Jobs Pattern

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

### Fan-out/Fan-in Pattern

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
  dependsOn: ParallelTests  # Waits for all parallel jobs
  jobs:
  - job: Deploy
    steps:
    - script: echo "Deploying..."
```

### Canary Deployment Pattern

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

---

## Multi-Stage Pipelines

### Azure Multi-Stage with Approvals

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
    environment: development  # No approval
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "Deploy to dev"

- stage: DeployQA
  dependsOn: DeployDev
  jobs:
  - deployment: DeployQA
    environment: qa  # Configure approval in environment settings
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "Deploy to QA"

- stage: DeployProd
  dependsOn: DeployQA
  jobs:
  - deployment: DeployProd
    environment: production  # Requires approval
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "Deploy to production"
```

### GitLab Multi-Environment

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

---

## Templates and Reusability

### Azure Pipeline Template with Jobs

```yaml
# templates/jobs-template.yml
parameters:
  - name: environments
    type: object
    default: []

jobs:
- ${{ each env in parameters.environments }}:
  - deployment: Deploy_${{ env.name }}
    environment: ${{ env.name }}
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      runOnce:
        deploy:
          steps:
          - script: echo "Deploying to ${{ env.name }}"
          - script: echo "URL: ${{ env.url }}"
```

```yaml
# azure-pipelines.yml
stages:
- stage: Deploy
  jobs:
  - template: templates/jobs-template.yml
    parameters:
      environments:
        - name: development
          url: https://dev.example.com
        - name: staging
          url: https://staging.example.com
        - name: production
          url: https://example.com
```

### GitLab Extends and Includes

```yaml
# templates/.gitlab-ci-template.yml
.deploy:
  script:
    - echo "Deploying to $ENVIRONMENT"
    - ./deploy.sh $ENVIRONMENT
  only:
    - main
```

```yaml
# .gitlab-ci.yml
include:
  - local: 'templates/.gitlab-ci-template.yml'

deploy:dev:
  extends: .deploy
  variables:
    ENVIRONMENT: "development"
  environment:
    name: development

deploy:prod:
  extends: .deploy
  variables:
    ENVIRONMENT: "production"
  environment:
    name: production
  when: manual
```

---

## Variables and Parameters

### Azure Pipeline Variables

```yaml
# Variable groups (defined in Azure DevOps)
variables:
- group: 'production-vars'
- group: 'shared-vars'

# Pipeline variables
- name: buildConfiguration
  value: 'Release'
- name: vmImage
  value: 'ubuntu-latest'

# Runtime variables
- name: timestamp
  value: $[format('{0:yyyyMMddHHmmss}', pipeline.startTime)]

# Template parameters
parameters:
- name: environment
  type: string
  default: 'dev'
  values:
    - dev
    - staging
    - prod

steps:
- script: |
    echo "Configuration: $(buildConfiguration)"
    echo "Environment: ${{ parameters.environment }}"
    echo "Timestamp: $(timestamp)"
```

### GitLab Variables

```yaml
variables:
  # Global variables
  GLOBAL_VAR: "global value"

  # Reference other variables
  BUILD_PATH: "$CI_PROJECT_DIR/build"

  # Protected variables (set in GitLab UI)
  # DEPLOY_TOKEN: defined in Settings → CI/CD → Variables

job1:
  variables:
    # Job-specific variables
    LOCAL_VAR: "local value"
  script:
    - echo $GLOBAL_VAR
    - echo $LOCAL_VAR
    - echo $CI_COMMIT_SHA
```

---

## Conditions and Expressions

### Azure Conditions

```yaml
stages:
- stage: Deploy
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - job: DeployJob
    steps:
    - script: echo "Deploying..."

- stage: Notify
  condition: or(failed(), canceled())
  jobs:
  - job: NotifyJob
    steps:
    - script: echo "Build failed or canceled"

- stage: Release
  condition: startsWith(variables['Build.SourceBranch'], 'refs/tags/')
  jobs:
  - job: ReleaseJob
    steps:
    - script: echo "Creating release"
```

### GitLab Rules

```yaml
deploy:production:
  script:
    - ./deploy.sh
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
      when: manual
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
      when: on_success
    - when: never

test:
  script:
    - npm test
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'
    - changes:
        - src/**/*
        - tests/**/*
```

---

## Caching and Optimization

### Azure Pipeline Caching

```yaml
variables:
  npm_config_cache: $(Pipeline.Workspace)/.npm

steps:
- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "$(Agent.OS)"
    path: $(npm_config_cache)
  displayName: 'Cache npm packages'

- script: npm ci
  displayName: 'Install dependencies'

- task: Cache@2
  inputs:
    key: 'nuget | "$(Agent.OS)" | **/*.csproj'
    restoreKeys: |
      nuget | "$(Agent.OS)"
    path: $(UserProfile)/.nuget/packages
  displayName: 'Cache NuGet packages'

- script: dotnet restore
  displayName: 'Restore .NET dependencies'
```

### GitLab Caching

```yaml
cache:
  # Global cache
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/

build:
  script:
    - npm ci --cache .npm
    - npm run build
  cache:
    # Job-specific cache
    key: ${CI_COMMIT_REF_SLUG}-build
    paths:
      - node_modules/
      - dist/

test:
  script:
    - npm test
  cache:
    # Cache policy
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
    policy: pull  # Only download, don't upload
```

---

## Security and Secrets

### Azure Pipeline Secrets

```yaml
variables:
- group: 'production-secrets'  # Variable group with secrets

steps:
- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'Azure-Prod'
    KeyVaultName: 'my-keyvault'
    SecretsFilter: '*'
    RunAsPreJob: true

- script: |
    echo "Using secret..."
    # Secrets are automatically masked in logs
  env:
    API_KEY: $(apiKey)
    DATABASE_PASSWORD: $(dbPassword)
```

### GitLab Secrets

```yaml
# Define secrets in Settings → CI/CD → Variables

deploy:
  script:
    - echo "Deploying with token..."
    - ./deploy.sh
  environment:
    name: production
  variables:
    # Use protected variables for sensitive data
    DATABASE_URL: $PROD_DATABASE_URL
    API_TOKEN: $PROD_API_TOKEN
  only:
    - main
```

### Security Scanning

```yaml
# Azure Pipelines
- task: SonarCloudPrepare@1
  inputs:
    SonarCloud: 'SonarCloud'
    organization: 'my-org'
    scannerMode: 'CLI'

- script: dotnet build

- task: SonarCloudAnalyze@1

- task: SonarCloudPublish@1
  inputs:
    pollingTimeoutSec: '300'
```

```yaml
# GitLab CI
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml

sast:
  stage: test
  variables:
    SAST_EXCLUDED_PATHS: "spec, test, tests, tmp"
```

---

## Best Practices

### ✅ DO

**Pipeline Structure:**
- Use multi-stage pipelines for complex workflows
- Separate build, test, and deploy stages
- Implement proper stage dependencies
- Use templates for reusable logic

**Performance:**
- Cache dependencies aggressively
- Use matrix builds for parallel testing
- Minimize artifact size and retention
- Parallelize independent jobs

**Security:**
- Store secrets in secure variable stores
- Use protected variables for production
- Scan for vulnerabilities automatically
- Implement least privilege access
- Never log sensitive information

**Testing:**
- Run tests in CI pipeline
- Publish test results and coverage
- Fail fast on critical errors
- Test deployment process in lower environments

**Deployment:**
- Use environment-specific configurations
- Implement approval gates for production
- Test rollback procedures
- Monitor deployment health

### ❌ DON'T

**Anti-Patterns:**
- Hardcode secrets or credentials
- Skip testing stages
- Deploy directly to production from feature branches
- Ignore pipeline failures
- Create overly complex pipelines

**Performance:**
- Run all jobs sequentially when they can be parallel
- Skip caching frequently accessed dependencies
- Keep all artifacts indefinitely
- Run unnecessary steps in every job

**Security:**
- Expose secrets in logs or artifacts
- Use overly permissive service connections
- Skip security scanning
- Share production credentials across environments

---

## Platform Comparison

| Feature | Azure Pipelines | GitLab CI | GitHub Actions |
|---------|----------------|-----------|----------------|
| **Config File** | `azure-pipelines.yml` | `.gitlab-ci.yml` | `.github/workflows/*.yml` |
| **Stages** | ✅ Native | ✅ Native | ⚠️ Jobs only |
| **Templates** | ✅ Full support | ✅ Includes/Extends | ✅ Reusable workflows |
| **Caching** | ✅ Cache task | ✅ Built-in | ✅ actions/cache |
| **Environments** | ✅ Native | ✅ Native | ✅ Native |
| **Approvals** | ✅ Environment gates | ✅ Manual when | ✅ Environment rules |
| **Matrix** | ✅ strategy.matrix | ✅ parallel.matrix | ✅ strategy.matrix |
| **Secrets** | ✅ Variable groups | ✅ CI/CD Variables | ✅ Secrets |

---

**Related Skills**:
- [GitHub Actions & Workflows](../github-actions-workflows/SKILL.md)
- [Release Management](../release-management/SKILL.md)
- [Security](../../architecture/security/SKILL.md)
- [Remote Git Operations](../remote-git-operations/SKILL.md)

**Resources**:
- [Azure Pipelines Documentation](https://learn.microsoft.com/azure/devops/pipelines/)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [YAML Specification](https://yaml.org/spec/)

---

**Version**: 1.0
**Last Updated**: February 5, 2026
