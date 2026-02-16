# Templates, Variables, Caching & Security Reference

> Load when configuring templates, variables, caching, or security. See [SKILL.md](../SKILL.md) for concepts.

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
 # DEPLOY_TOKEN: defined in Settings -> CI/CD -> Variables

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
 policy: pull # Only download, don't upload
```

---

## Security and Secrets

### Azure Pipeline Secrets

```yaml
variables:
- group: 'production-secrets' # Variable group with secrets

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
# Define secrets in Settings -> CI/CD -> Variables

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
