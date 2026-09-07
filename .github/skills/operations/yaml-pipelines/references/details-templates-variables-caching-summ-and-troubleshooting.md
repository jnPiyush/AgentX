# yaml-pipelines: Templates, Variables, Caching (Summary) through Troubleshooting

> MUST read before work involving **templates, variables, caching (summary) through troubleshooting**. This reference preserves complete source guidance relocated for context-budget compliance.

## Templates, Variables, Caching (Summary)

### Templates & Reusability

- **Azure**: `template:` keyword with `parameters:`. Supports step, job, and stage templates.
- **GitLab**: `include:` (local/remote/project) + `extends:` for inheritance.

### Variables & Parameters

- **Azure**: `variables:` (compile/runtime), `parameters:` (typed inputs), variable groups.
- **GitLab**: `variables:` (global/job), CI/CD UI variables, `dotenv` artifacts.

### Caching

- **Azure**: `Cache@2` task with composite key (`OS | lockfile`).
- **GitLab**: `cache:` with `key:`, `paths:`, `policy:` (pull/push/pull-push).

### Conditions

- **Azure**: `condition:` with expressions - `eq()`, `and()`, `startsWith()`.
- **GitLab**: `rules:` with `if:`, `changes:`, `exists:`, `when:`.

> **Full reference**: [references/templates-variables-caching.md](templates-variables-caching.md)

---

## Security & Secrets

### Principles

1. **Never hardcode secrets** - use platform secret stores
2. **Least privilege** - scope service connections and tokens narrowly
3. **Mask secrets** - both platforms auto-mask; verify with `echo` tests
4. **Rotate regularly** - automate rotation where possible
5. **Scan continuously** - integrate SAST, dependency scanning, secret detection

### Platform Secret Stores

| Platform | Store | Access pattern |
|----------|-------|----------------|
| Azure Pipelines | Variable groups + Key Vault | `AzureKeyVault@2` task, `$(secret)` |
| GitLab CI | Settings -> CI/CD -> Variables | `$SECRET_NAME`, protected/masked flags |

### Security Scanning Checklist

- [ ] SAST (static analysis) in test stage
- [ ] Dependency scanning for known CVEs
- [ ] Secret detection in pre-commit and CI
- [ ] Container image scanning (if applicable)
- [ ] License compliance checks

> **Full security examples**: [references/templates-variables-caching.md](templates-variables-caching.md) (security section)

---

## Anti-Patterns

- **Monolith Pipeline**: One massive job with build, test, scan, and deploy steps -> Split into stages with explicit dependencies.
- **Hardcoded Secrets**: Embedding credentials or tokens directly in YAML -> Use platform secret stores (variable groups, CI/CD variables).
- **No Caching**: Installing dependencies from scratch on every run -> Cache with lockfile-keyed keys (`hashFiles('**/package-lock.json')`).
- **Sequential Everything**: Running independent jobs one after another -> Parallelize unrelated jobs (lint, unit tests, security scan).
- **Infinite Artifact Retention**: Storing all build artifacts forever -> Set `expire_in` (GitLab) or `retention-days` (Azure) to a reasonable window.
- **Production from Feature Branch**: Deploying to production from any branch -> Gate production deploys to `main` or release branches only.
- **Skipping Stages for Speed**: Removing test or scan stages to get faster deploys -> Optimize slow stages instead; never remove quality gates.
- **Copy-Paste Pipelines**: Duplicating YAML across repos -> Use templates (`template:` in Azure, `include:` in GitLab) for shared logic.

---

## Reference Files

| Topic | File |
|-------|------|
| Azure Pipelines full examples | [references/azure-pipelines-examples.md](azure-pipelines-examples.md) |
| GitLab CI/CD full examples | [references/gitlab-ci-examples.md](gitlab-ci-examples.md) |
| Pipeline design patterns (YAML) | [references/pipeline-design-patterns.md](pipeline-design-patterns.md) |
| Multi-stage pipelines (Azure + GitLab) | [references/multi-stage-pipelines.md](multi-stage-pipelines.md) |
| Templates, variables, caching, security | [references/templates-variables-caching.md](templates-variables-caching.md) |

---

## Related Skills

- [GitHub Actions & Workflows](../../github-actions-workflows/SKILL.md) - GitHub-native CI/CD
- [Release Management](../../release-management/SKILL.md) - Versioning, changelogs, release flows
- [Security](../../../architecture/security/SKILL.md) - Application security practices
- [Remote Git Operations](../../remote-git-operations/SKILL.md) - Branch strategies and git workflows

## Resources

- [Azure Pipelines Documentation](https://learn.microsoft.com/azure/devops/pipelines/)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [YAML Specification](https://yaml.org/spec/)

---

**Version**: 2.0.0
**Author**: AgentX
**Last Updated**: February 10, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pipeline YAML validation error | Use the pipeline editor validation feature, check indentation and syntax |
| Secret not available in pipeline | Check variable group is linked, verify secret scope matches stage/job |