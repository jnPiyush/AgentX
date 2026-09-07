# yaml-pipelines: Platform Comparison - Start Here through Multi-Stage Pipelines (Summary)

> MUST read before work involving **platform comparison - start here through multi-stage pipelines (summary)**. This reference preserves complete source guidance relocated for context-budget compliance.

## Platform Comparison - Start Here

| Feature | Azure Pipelines | GitLab CI | GitHub Actions |
|---------|----------------|-----------|----------------|
| **Config File** | `azure-pipelines.yml` | `.gitlab-ci.yml` | `.github/workflows/*.yml` |
| **Stages** | [PASS] Native | [PASS] Native | [WARN] Jobs only |
| **Templates** | [PASS] Full support | [PASS] Includes/Extends | [PASS] Reusable workflows |
| **Caching** | [PASS] Cache task | [PASS] Built-in | [PASS] actions/cache |
| **Environments** | [PASS] Native | [PASS] Native | [PASS] Native |
| **Approvals** | [PASS] Environment gates | [PASS] Manual `when` | [PASS] Environment rules |
| **Matrix** | [PASS] `strategy.matrix` | [PASS] `parallel.matrix` | [PASS] `strategy.matrix` |
| **Secrets** | [PASS] Variable groups | [PASS] CI/CD Variables | [PASS] Secrets |
| **Self-hosted** | [PASS] Agent pools | [PASS] Runners | [PASS] Self-hosted runners |
| **Best for** | Azure-heavy orgs | All-in-one DevOps | Open source / GitHub |

---

## Core Concepts

### Pipeline Anatomy

Every YAML pipeline shares these building blocks:

| Concept | Azure Pipelines | GitLab CI |
|---------|----------------|-----------|
| **Trigger** | `trigger:` / `pr:` | `rules:` / `only:` / `except:` |
| **Stage** | `stages: [{stage: ...}]` | `stages: [build, test, deploy]` |
| **Job** | `jobs: [{job: ...}]` | Job name at root level |
| **Step** | `steps: [{script: ...}]` | `script:` array |
| **Template** | `template:` keyword | `include:` + `extends:` |
| **Variable** | `variables:` / `parameters:` | `variables:` |
| **Artifact** | `PublishPipelineArtifact` | `artifacts:` |
| **Cache** | `Cache@2` task | `cache:` keyword |
| **Environment** | `environment:` on deployment | `environment:` on job |

---

## Minimal Examples

### Azure Pipelines - Build + Deploy

```yaml
# azure-pipelines.yml
trigger: [main]

pool:
 vmImage: 'ubuntu-latest'

variables:
 buildConfig: 'Release'

stages:
- stage: Build
 jobs:
 - job: BuildJob
 steps:
 - script: dotnet build --configuration $(buildConfig)
 - script: dotnet test --no-build
 - publish: $(Build.ArtifactStagingDirectory)
 artifact: drop

- stage: Deploy
 dependsOn: Build
 condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
 jobs:
 - deployment: Production
 environment: production
 strategy:
 runOnce:
 deploy:
 steps:
 - download: current
 artifact: drop
 - script: echo "Deploying..."
```

> **Full examples**: [references/azure-pipelines-examples.md](azure-pipelines-examples.md)

### GitLab CI - Build + Deploy

```yaml
# .gitlab-ci.yml
image: node:24
stages: [build, test, deploy]

cache:
 paths: [node_modules/]

build:
 stage: build
 script: [npm ci, npm run build]
 artifacts:
 paths: [dist/]

test:
 stage: test
 script: [npm test]

deploy:production:
 stage: deploy
 script: [npm run deploy:production]
 environment: { name: production }
 rules:
 - if: '$CI_COMMIT_BRANCH == "main"'
 when: manual
```

> **Full examples**: [references/gitlab-ci-examples.md](gitlab-ci-examples.md)

---

## Pipeline Design Patterns (Summary)

| Pattern | When to use | Key idea |
|---------|------------|----------|
| **Sequential** | Simple build -> test -> deploy | Each stage `dependsOn` the prior |
| **Parallel jobs** | Independent test suites | Multiple jobs in one stage |
| **Fan-out / Fan-in** | Build once, test many, deploy once | Parallel stage converges to single deploy |
| **Canary** | Progressive production rollout | Deploy to canary -> validate -> full rollout |
| **Matrix** | Cross-platform / multi-version | `strategy.matrix` with OS or runtime combos |
| **Environment promotion** | Dev -> QA -> Staging -> Prod | `dependsOn` chain with approval gates |

> **Full pattern YAML**: [references/pipeline-design-patterns.md](pipeline-design-patterns.md)

---

## Multi-Stage Pipelines (Summary)

Multi-stage pipelines split CI and CD into discrete, gated stages.

**Azure**: Use `stages:` with `deployment` jobs, `environment:` for gate approvals, and `condition:` for branch filtering.

**GitLab**: Use named stages with `environment:`, `when: manual` for approval gates, and `rules:` for branch filtering.

| Capability | Azure | GitLab |
|-----------|-------|--------|
| Approval gates | Environment checks & approvals | `when: manual` |
| Branch filters | `condition:` expressions | `rules:` / `only:` |
| Artifact passing | `download: current` | `dependencies:` / `needs:` |
| Rollback | Re-run previous deployment | Re-trigger prior stage |

> **Full multi-stage YAML**: [references/multi-stage-pipelines.md](multi-stage-pipelines.md)

---
