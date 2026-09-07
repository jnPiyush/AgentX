---
name: "yaml-pipelines"
description: 'Build YAML-based CI/CD pipelines across Azure Pipelines and GitLab CI with progressive disclosure. Use when creating Azure DevOps YAML pipelines, configuring GitLab CI/CD, designing multi-stage pipelines, implementing pipeline templates, or managing pipeline secrets and variables.'
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 platforms: ["azure-devops", "gitlab"]
---

# YAML Pipelines & CI/CD Configuration

> **Purpose**: Quick-reference guide for YAML-based CI/CD pipelines. Start here for platform selection, core patterns, and best practices. Dive into reference files for full examples.

---

## When to Use This Skill

- Creating Azure DevOps YAML pipelines
- Configuring GitLab CI/CD pipelines
- Designing multi-stage deployment pipelines
- Implementing pipeline templates and variable groups
- Managing pipeline secrets and caching

## Prerequisites

- Azure DevOps or GitLab project access
- YAML syntax knowledge
- CI/CD concepts understanding

## Decision Tree - Choosing a Platform

```
Is your code hosted on GitHub?
+- YES -> Use GitHub Actions (see ../github-actions-workflows/SKILL.md)
+- NO
| +- Using Azure DevOps for work items & repos?
| | - YES -> Use Azure Pipelines
| +- Using GitLab for repos & issue tracking?
| | - YES -> Use GitLab CI/CD
| - Need multi-platform or hybrid?
| - Use Azure Pipelines (broadest agent/pool support)
```

**Key considerations**:
- **Azure Pipelines**: Best native integration with Azure services, variable groups, service connections, and approval gates.
- **GitLab CI**: Tightest integration when you already use GitLab for SCM + issues + registry.
- **GitHub Actions**: Ideal for open-source and GitHub-native workflows (covered in its own skill).

---

## Core Rules

### [PASS] DO

**Pipeline Structure:**
- Use multi-stage pipelines for complex workflows
- Separate build, test, and deploy stages
- Implement proper stage dependencies
- Use templates for reusable logic

**Performance:**
- Cache dependencies aggressively (lockfile-keyed)
- Use matrix builds for parallel testing
- Minimize artifact size and retention
- Parallelize independent jobs

**Security:**
- Store secrets in platform-native secret stores
- Use protected variables for production
- Scan for vulnerabilities automatically
- Implement least-privilege service connections
- Never log or echo sensitive values

**Testing:**
- Run tests in CI - fail the build on failure
- Publish test results and coverage reports
- Fail fast on critical errors
- Test deployment process in lower environments first

**Deployment:**
- Use environment-specific configurations
- Implement approval gates for production
- Test rollback procedures
- Monitor deployment health post-release

### [FAIL] DON'T

**Anti-Patterns:**
- Hardcode secrets or credentials in YAML
- Skip testing stages for "quick" deploys
- Deploy to production from feature branches
- Ignore pipeline failures ("it'll fix itself")
- Build monolithic single-job pipelines

**Performance Anti-Patterns:**
- Run all jobs sequentially when they can be parallel
- Skip caching for dependencies restored every run
- Retain all artifacts indefinitely (set `expire_in`)
- Run unnecessary steps on every trigger

**Security Anti-Patterns:**
- Echo secrets in scripts or expose in artifacts
- Use org-wide service connections for single projects
- Skip security scanning to "save time"
- Share production credentials across environments

---

## Workflow

1. Select platform and triggers.
2. Define stages, dependencies, artifacts, and environment gates.
3. Add caching and templates only after the basic path works.
4. Lint the YAML and execute representative success and failure paths.

## Error Handling

- Expression mismatch: validate with the target platform parser.
- Missing secret: fail before deployment without printing values.
- Partial deployment: stop promotion and follow the documented rollback or recovery path.

## Verification Checklist

- [ ] YAML parses on the target platform.
- [ ] Permissions and secret scopes are minimal.
- [ ] Artifacts flow unchanged through stages.
- [ ] Timeout, failure, and approval paths are exercised.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Platform Comparison - Start Here through Multi-Stage Pipelines (Summary)](references/details-platform-comparison---start-here-and-multi-stage-pipelines-summary.md) - MUST read before work involving platform comparison - start here through multi-stage pipelines (summary).
- [Templates, Variables, Caching (Summary) through Troubleshooting](references/details-templates-variables-caching-summ-and-troubleshooting.md) - MUST read before work involving templates, variables, caching (summary) through troubleshooting.

Existing focused references are reused, not duplicated:

- [Azure Pipelines Examples](references/azure-pipelines-examples.md) - MUST read before applying the focused azure pipelines examples guidance.
- [GitLab CI/CD Examples](references/gitlab-ci-examples.md) - MUST read before applying the focused gitlab ci/cd examples guidance.
- [Multi-Stage Pipeline Examples](references/multi-stage-pipelines.md) - MUST read before applying the focused multi-stage pipeline examples guidance.
- [Pipeline Design Patterns](references/pipeline-design-patterns.md) - MUST read before applying the focused pipeline design patterns guidance.
- [Templates, Variables, Caching & Security Reference](references/templates-variables-caching.md) - MUST read before applying the focused templates, variables, caching & security reference guidance.
