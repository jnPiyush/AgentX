# github-actions-workflows: Trigger Decision Tree through Core Concepts

> MUST read before work involving **trigger decision tree through core concepts**. This reference preserves complete source guidance relocated for context-budget compliance.

## Table of Contents

1. [Trigger Decision Tree](#trigger-decision-tree)
2. [Directory Structure](#directory-structure)
3. [Minimal Workflow Example](#minimal-workflow-example)
4. [Common Actions Quick-Reference](#common-actions-quick-reference)
5. [Core Concepts (with Progressive Disclosure)](#core-concepts)
6. [Security Best Practices](details-security-best-practices-and-reference-files.md#security-best-practices) **read in full**
7. [Troubleshooting](../SKILL.md#troubleshooting)
8. [Core Rules](../SKILL.md#core-rules)

---

## Trigger Decision Tree

Use this to choose the right event trigger for your workflow:

```
Is this a code change?
+- YES - Push to branch? ---------------- on: push (branches, paths)
| PR validation? ------------------ on: pull_request
| PR from fork? ------------------- on: pull_request (NOT pull_request_target!)
| Tag/release? -------------------- on: push (tags: 'v*')
|
+- NO -- Manual/on-demand? --------------- on: workflow_dispatch (with inputs)
| Recurring schedule? ------------- on: schedule (cron)
| Called by another workflow? ------ on: workflow_call (reusable)
| React to issue/comment/label? --- on: issues / issue_comment / label
|
- MULTI-TRIGGER - CI + manual deploy? -- combine push + workflow_dispatch
```

> **Deep dive**: [references/workflow-syntax-reference.md](workflow-syntax-reference.md) - full event syntax, path filters, branch patterns, cron examples.

---

## Directory Structure

```
.github/
+-- workflows/
| +-- ci.yml # Continuous Integration
| +-- cd.yml # Continuous Deployment
| +-- release.yml # Release automation
| +-- pr-checks.yml # Pull request validation
| -- scheduled-tasks.yml # Scheduled jobs
-- actions/
 -- my-action/ # Custom composite/JS actions
 -- action.yml
```

---

## Minimal Workflow Example

```yaml
name: CI Pipeline
on:
 push:
 branches: [main, develop]
 paths: ['src/**', 'tests/**']
 pull_request:
 branches: [main]
permissions:
 contents: read
concurrency:
 group: ${{ github.workflow }}-${{ github.ref }}
 cancel-in-progress: true
jobs:
 build:
 runs-on: ubuntu-latest
 timeout-minutes: 15
 steps:
 - uses: actions/checkout@v4
 - uses: actions/setup-node@v4
 with: { node-version: '24.x', cache: 'npm' }
 - run: npm ci
 - run: npm run build
 - run: npm test
 - uses: actions/upload-artifact@v4
 with: { name: build-output, path: dist/, retention-days: 7 }
```

**Demonstrates**: path-filtered triggers, explicit permissions, concurrency, timeout, built-in caching, artifact upload.

---

## Common Actions Quick-Reference

| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | `v4` | Clone repository |
| `actions/setup-node` | `v4` | Node.js + npm/yarn/pnpm cache |
| `actions/setup-dotnet` | `v4` | .NET SDK |
| `actions/setup-python` | `v5` | Python + pip cache |
| `actions/setup-java` | `v4` | Java (temurin, zulu, etc.) |
| `actions/setup-go` | `v5` | Go + module cache |
| `actions/cache` | `v4` | Generic dependency caching |
| `actions/upload-artifact` | `v4` | Persist build outputs between jobs |
| `actions/download-artifact` | `v4` | Retrieve artifacts in downstream jobs |
| `docker/build-push-action` | `v5` | Build & push Docker images |
| `docker/login-action` | `v3` | Docker registry authentication |
| `codecov/codecov-action` | `v4` | Upload code coverage reports |

> **Full examples**: [references/actions-marketplace-examples.md](actions-marketplace-examples.md) - setup snippets, caching patterns, Docker multi-stage, code coverage.

---

## Core Concepts

Each concept is summarized below. Detailed YAML lives in the linked reference file.

### Workflow Syntax & Events

**Key elements**: `name`, `on` (triggers), `env` (global vars), `permissions`, `concurrency`, `jobs`.
Path filters (`paths` / `paths-ignore`) prevent unnecessary runs. Use `concurrency.cancel-in-progress: true` to avoid queue buildup.

> [references/workflow-syntax-reference.md](workflow-syntax-reference.md)

### Jobs, Steps & Runners

- **Job dependencies**: `needs: [job-a, job-b]` for DAG ordering.
- **Conditionals**: `if: github.ref == 'refs/heads/main'` on jobs or steps.
- **Status functions**: `success()`, `failure()`, `always()`, `cancelled()`.
- **Runners**: `ubuntu-latest` (default), `windows-latest`, `macos-latest`, or `[self-hosted, label]`.
- **Timeouts**: Always set `timeout-minutes` to prevent runaway jobs.

> [references/jobs-and-steps-patterns.md](jobs-and-steps-patterns.md)

### Secrets, Variables & Matrix Builds

- **Secrets**: Use `${{ secrets.NAME }}` - never hardcode. Scoped to repo, environment, or org.
- **Variables**: `${{ vars.NAME }}` for non-sensitive config (environment URLs, feature flags).
- **Environment scoping**: `environment: production` restricts secret/variable access + enables approval gates.
- **Matrix strategy**: Cross-product of OS language version. Use `exclude` / `include` to customize. Set `fail-fast: false` for full coverage.

> [references/secrets-variables-matrix.md](secrets-variables-matrix.md)

### Reusable Workflows & Custom Actions

- **Reusable workflows** (`on: workflow_call`): DRY pattern for shared CI/CD pipelines. Accept `inputs` and `secrets`, emit `outputs`.
- **Composite actions**: Bundle multi-step logic into a single `uses:` step. Must set `shell:` on every `run:`.
- **JavaScript actions**: Full programmability via `@actions/core` and `@actions/github`.
- **When to use which**: Reusable workflow = multi-job orchestration. Composite action = reusable step sequence. JS action = complex logic with API calls.

> [references/reusable-workflows-and-actions.md](reusable-workflows-and-actions.md)

### Caching & Artifacts

- **Built-in caching**: Most `setup-*` actions have a `cache` input - prefer this over manual `actions/cache`.
- **Manual caching**: Use `actions/cache@v4` with content-hash keys (`hashFiles('**/lockfile')`).
- **Artifacts**: `upload-artifact` / `download-artifact` for passing build outputs between jobs. Set `retention-days`.
- **Docker layer caching**: Use `cache-from: type=gha` with `docker/build-push-action`.

> [references/actions-marketplace-examples.md](actions-marketplace-examples.md)

---
