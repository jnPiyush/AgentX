---
name: "github-actions-workflows"
description: 'Create GitHub Actions workflows, reusable workflows, custom actions, and workflow automation. Use when setting up CI/CD with GitHub Actions, creating reusable workflow templates, configuring workflow triggers, implementing matrix builds, or securing GitHub Actions secrets.'
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 platforms: ["github"]
---

# GitHub Actions & Workflows

> **Purpose**: Concise guide for building, testing, and deploying with GitHub Actions.
> Detailed YAML examples live in `references/` - this file covers decisions, patterns, and guardrails.

---

## When to Use This Skill

- Creating GitHub Actions CI/CD workflows
- Building reusable workflow templates
- Configuring matrix builds and parallel jobs
- Implementing security best practices for GitHub Actions
- Troubleshooting failed workflow runs

## Prerequisites

- GitHub repository with admin access
- YAML syntax knowledge

## Decision Tree

```
What GitHub Actions task?
+-- New CI pipeline?
|   +-- Single language? -> Minimal workflow with build + test
|   +-- Multi-platform/version? -> Matrix strategy
|   +-- Monorepo? -> Path-filtered triggers per project
+-- Reusing workflow logic?
|   +-- Multi-job orchestration? -> Reusable workflow (workflow_call)
|   +-- Reusable step sequence? -> Composite action
|   +-- Complex logic with API calls? -> JavaScript action
+-- Choosing triggers?
|   +-- See Trigger Decision Tree below
+-- Securing workflows?
|   +-- Third-party actions? -> Pin to SHA
|   +-- Fork PRs? -> Use pull_request (NOT pull_request_target)
|   +-- Production deploy? -> Environment protection + approval gates
+-- Debugging failures?
    +-- Workflow not triggering? -> Check branch/path filters
    +-- Permission denied? -> Add explicit permissions block
    +-- Cache miss? -> Verify lockfile and cache key
```

## Troubleshooting

Set **repository secrets** `ACTIONS_RUNNER_DEBUG=true` and `ACTIONS_STEP_DEBUG=true` for verbose logs.

| Symptom | Fix |
|---------|-----|
| Push doesn't trigger | Branch name is **case-sensitive** - verify exact match |
| Path filter blocks run | Ensure changed files match `paths:` glob |
| Scheduled workflow missed | Cron runs on default branch only; disabled after 60 days inactivity |
| Reusable workflow fails | Use `secrets: inherit` or pass each secret explicitly |
| Cache miss | Verify `path` matches cache location; commit lock file |
| Artifact not found | `download-artifact` job must `needs:` the uploading job |
| Permission denied | Add specific permission to `permissions:` block |

```bash
actionlint .github/workflows/*.yml # local syntax validation
```

---

## Core Rules

### [PASS] DO

- Pin actions to commit SHAs (or at minimum major version tags)
- Declare explicit `permissions` on every workflow
- Set `timeout-minutes` on every job
- Use `concurrency` with `cancel-in-progress` to avoid queued duplication
- Cache dependencies (prefer built-in `cache` option on setup actions)
- Use matrix builds for cross-platform / multi-version testing
- Extract shared logic into reusable workflows or composite actions
- Protect `.github/workflows/` via CODEOWNERS
- Test workflow changes in feature branches before merging to main
- Use environment-scoped secrets with approval gates for production

### [FAIL] DON'T

- Hardcode secrets or credentials anywhere in workflow files
- Use `pull_request_target` without label gating and SHA checkout
- Grant `write-all` permissions
- Skip security scanning (`npm audit`, `trivy`, `CodeQL`)
- Ignore workflow failures - treat CI red as a blocking defect
- Use mutable branch refs (`@main`) for third-party actions
- Commit build artifacts to the repository
- Mix application logic with workflow orchestration logic

---

## Workflow

1. Choose the minimum safe trigger and permissions.
2. Build jobs from deterministic setup, validation, and artifact steps.
3. Add caching only with trustworthy keys and restore behavior.
4. Validate syntax and exercise the event path before relying on it.

## Verification Checklist

- [ ] Workflow parses.
- [ ] Trigger and permission behavior match intent.
- [ ] Referenced actions and reusable workflows resolve.
- [ ] Failure, timeout, and concurrency paths are bounded.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Trigger Decision Tree through Core Concepts](references/details-trigger-decision-tree-and-core-concepts.md) - MUST read before work involving trigger decision tree through core concepts.
- [Security Best Practices, Anti-Patterns, Reference Files](references/details-security-best-practices-and-reference-files.md) - MUST read before work involving security best practices, anti-patterns, reference files.

Existing focused references are reused, not duplicated:

- [Actions Marketplace Examples](references/actions-marketplace-examples.md) - MUST read before applying the focused actions marketplace examples guidance.
- [Jobs & Steps Patterns](references/jobs-and-steps-patterns.md) - MUST read before applying the focused jobs & steps patterns guidance.
- [Reusable Workflows, Custom Actions & Caching Reference](references/reusable-workflows-and-actions.md) - MUST read before applying the focused reusable workflows, custom actions & caching reference guidance.
- [Secrets, Variables & Matrix Builds Reference](references/secrets-variables-matrix.md) - MUST read before applying the focused secrets, variables & matrix builds reference guidance.
- [Workflow Syntax & Event Triggers Reference](references/workflow-syntax-reference.md) - MUST read before applying the focused workflow syntax & event triggers reference guidance.
