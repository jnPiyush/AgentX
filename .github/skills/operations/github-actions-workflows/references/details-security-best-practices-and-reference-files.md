# github-actions-workflows: Security Best Practices, Anti-Patterns, Reference Files

> MUST read before work involving **security best practices, anti-patterns, reference files**. This reference preserves complete source guidance relocated for context-budget compliance.

## Security Best Practices

> [WARN] **This section is NOT compressed. Read every item.**

### 1. Secret Management

```yaml
# [PASS] GOOD: Reference secrets through env vars
- run: ./deploy.sh
 env: { API_KEY: ${{ secrets.API_KEY }} }

# [FAIL] BAD: Hardcoded credentials
- run: ./deploy.sh
 env: { API_KEY: 'sk_live_abc123' } # NEVER
```

### 2. Pin Action Versions

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # [PASS] SHA pin (v4.1.1)
- uses: actions/checkout@v4 # [WARN] Major tag (OK)
- uses: actions/checkout@main # [FAIL] Mutable branch
```

### 3. Minimal Permissions

```yaml
permissions: # [PASS] Least-privilege
 contents: read
 pull-requests: write
# permissions: write-all [FAIL] NEVER
```

### 4. Pull Request Security

Use `on: pull_request` (read-only token, safe for forks).
`pull_request_target` grants write token + secrets - **only** use with label gating + SHA checkout:

```yaml
on:
 pull_request_target:
 types: [labeled]
jobs:
 safe-job:
 if: contains(github.event.pull_request.labels.*.name, 'safe-to-run')
 steps:
 - uses: actions/checkout@v4
 with: { ref: ${{ github.event.pull_request.head.sha }} }
```

### 5. Script Injection Prevention

```yaml
# [PASS] GOOD: Untrusted input via env var | # [FAIL] BAD: Direct interpolation
- env: | - run: echo "${{ github.event.pull_request.title }}"
 TITLE: ${{ github.event.pull_request.title }}
 run: echo "$TITLE"
```

### 6. Security Checklist

- [ ] All secrets stored in GitHub Secrets (repo/org/environment), never in code
- [ ] Actions pinned to SHA or major version tag
- [ ] `permissions` block is explicit and minimal on every workflow
- [ ] `pull_request_target` is avoided or gated by label + SHA checkout
- [ ] All `${{ }}` expressions from user input go through env vars, not inline shell
- [ ] Dependency review / `npm audit` / `dotnet list package --vulnerable` in CI
- [ ] CODEOWNERS protects `.github/workflows/**`
- [ ] Environment protection rules (approvals) on production deployments

---

## Anti-Patterns

- **Monolith Workflow**: Cramming build, test, lint, deploy, and notifications into a single job -> Split into discrete jobs with `needs:` dependencies.
- **Secret Sprawl**: Duplicating secrets across repos instead of scoping -> Use organization-level secrets and environment-scoped secrets.
- **Workflow Duplication**: Copy-pasting the same CI logic across repositories -> Extract into reusable workflows (`workflow_call`) or composite actions.
- **Uncapped Matrix**: Using open-ended matrix dimensions that explode into dozens of jobs -> Constrain with `exclude` / `include` and limit to supported platforms.
- **Mutable Action Refs**: Pinning actions to `@main` or `@latest` -> Pin to SHA or major version tag (`@v4`).
- **Trigger Overload**: Using `on: [push]` with no path or branch filter -> Scope triggers with `branches:` and `paths:` to avoid wasted runs.
- **Artifact Hoarding**: Uploading large artifacts with no retention policy -> Set `retention-days` and upload only what downstream jobs need.
- **Catch-All Permissions**: Using `permissions: write-all` for convenience -> Declare the minimum permissions each job requires.

---

## Reference Files

| Reference | Content |
|-----------|---------|
| [workflow-syntax-reference.md](workflow-syntax-reference.md) | Complete workflow structure, all event triggers, path/branch filters |
| [jobs-and-steps-patterns.md](jobs-and-steps-patterns.md) | Job dependencies, conditionals, runner selection, status functions |
| [actions-marketplace-examples.md](actions-marketplace-examples.md) | Setup actions, caching, artifacts, Docker, code coverage |
| [secrets-variables-matrix.md](secrets-variables-matrix.md) | Secrets, env vars, config variables, matrix strategies |
| [reusable-workflows-and-actions.md](reusable-workflows-and-actions.md) | Reusable workflows, composite actions, JS actions, caching |

---

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`validate-workflows.ps1`](../scripts/validate-workflows.ps1) | Validate workflow files for deprecated actions, security issues | `./scripts/validate-workflows.ps1 [-Fix]` |

**Related Skills**:
- [YAML Pipelines](../../yaml-pipelines/SKILL.md)
- [Release Management](../../release-management/SKILL.md)
- [Security](../../../architecture/security/SKILL.md)

**Resources**:
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Actions Marketplace](https://github.com/marketplace?type=actions)
- [Workflow Syntax Reference](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions)

---

**Version**: 2.0.0
**Author**: AgentX
**Last Updated**: February 10, 2026
