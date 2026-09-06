# Versioning Schemes and Full Release Checklist

Supporting detail for [release-management](../SKILL.md): versioning scheme
tables, rollback thresholds, and the full pre/during/post-release checklist.

## Versioning Schemes

### Semantic Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]`

| Bump | When | Example |
|------|------|---------|
| MAJOR | Incompatible/breaking API change | `1.x.x -> 2.0.0` |
| MINOR | New functionality, backward-compatible | `1.1.x -> 1.2.0` |
| PATCH | Bug fixes, backward-compatible | `1.1.1 -> 1.1.2` |
| PRERELEASE | alpha -> beta -> rc progression | `2.0.0-rc.1` |
| BUILD | Metadata only, ignored for precedence | `2.0.0+build.47` |

Once released, a version's contents must not change. Pre-release versions
have lower precedence than the matching release.

### Calendar Versioning (CalVer)

Format: `YYYY.MM[.DD][.MICRO]`. Use for time-based cadences (monthly,
quarterly), marketing-driven numbers, or consumer products with regular
update schedules (Ubuntu, pip, and similar projects use CalVer).

### Commit-Based Versioning

Format: `v{MAJOR}.{MINOR}.{COMMIT_COUNT}+{SHORT_SHA}`. Best for internal
services with continuous delivery where every merge to `main` is a release
candidate.

### Pre-Release Label Progression

| Label | Meaning | Audience |
|-------|---------|----------|
| `alpha.N` | Early testing, unstable | Internal team |
| `beta.N` | Feature-complete, bugs expected | Early adopters |
| `rc.N` | Release candidate, production-ready | Wider testing |
| `snapshot` | Development build | CI only |

### Conventional Commits -> Version Bump Mapping

| Commit Prefix | Version Bump | Example |
|----------------|--------------|---------|
| `feat:` | MINOR | `feat: add dark mode support` |
| `fix:` | PATCH | `fix: resolve login timeout (#123)` |
| `BREAKING CHANGE:` / `feat!:` | MAJOR | `feat!: redesign auth API` |
| `chore:` / `docs:` | No bump | `docs: update README` |

## Rollback Decision Detail

### Thresholds (trigger rollback when any is breached)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 2x baseline | Automatic rollback |
| Health check | HTTP != 200 for > 2 min | Automatic rollback |
| P95 latency | > 50% degradation | Investigate, then manual rollback |
| Critical bug | Functionality broken | Immediate manual rollback |
| Security vuln | Applicable exposure confirmed | Contain; choose a safer release or mitigation |

Calibration caveat: these thresholds are starting points, not universal
constants -- recalibrate baseline and percentage against the service's own
historical error rate and latency distribution before relying on them.

### Rollback Method by Deployment Type

| Deployment Type | Rollback Method | Speed |
|-------------------|--------------------------------------|---------|
| Blue-Green | Swap traffic back to previous environment | Instant |
| Canary | Scale canary replicas to 0 | < 1 min |
| Rolling | `kubectl rollout undo` | 2-5 min |
| Feature Flags | Disable flag | Instant |
| Container | Redeploy previous image tag | 2-5 min |

### Deployment Strategy Comparison

| Strategy | Best for | Availability prerequisites | Resource trade-off |
|----------|----------|----------------------------|--------------------|
| Blue-Green | Fast traffic reversal | Healthy target and compatible state | Duplicate app capacity during cutover; shared costs vary |
| Canary | Gradual validation | Routing, representative traffic and metrics | Temporary canary capacity; sizing determines overhead |
| Rolling | Resource-constrained rollout | Readiness, draining and spare capacity | Lower overlap, slower reversal |
| Feature Flags | Separating deploy from release | Safe off-path and tested flag handling | Flag-service overhead and cleanup complexity |

No strategy guarantees zero downtime. Full examples and trade-offs:
[deployment-strategy-examples.md](deployment-strategy-examples.md).

### Database Rollback Principles

1. Forward-only migrations: never drop columns; deprecate first.
2. Backward-compatible changes: new code must work with the old schema
   during rollout.
3. Separate databases require a tested write-cutover and reconciliation plan;
   switching a connection string alone can lose post-cutover writes.
4. Always test undo scripts in staging before production.

Full automated and manual rollback scripts:
[rollback-scripts.md](rollback-scripts.md).

## Release Automation

| Task | Tool or control | Trigger |
|------|-----------------|---------|
| Version/changelog | `version-bump.ps1`, `generate-changelog.ps1` | Approved release preparation |
| Tag and release | `gh release create` or release action | After validated version bump |
| Pre-release marking | Version prerelease identifier, such as alpha/beta/rc | Tag workflow |
| Smoke tests | Health and critical-path checks | Every environment deployment |
| Rollback | Approved automated recovery policy | Calibrated health/quality failure |
| Notifications | Configured Slack/Teams webhook | Deployment outcome |

Run from the target project's root and invoke the linked scripts by full path:
[`version-bump.ps1`](../scripts/version-bump.ps1) accepts `-BumpType minor -Tag`
(use `-DryRun` to inspect first); [`generate-changelog.ps1`](../scripts/generate-changelog.ps1)
accepts `-Version 2.0.0`. They use the current project/repository, not this skill's
reference directory. Confirm the project and version before creating tags.
See [release-automation-workflows.md](release-automation-workflows.md).

## Full Release Checklist

### Pre-Release

- [ ] All tests passing (unit, integration, e2e); coverage >= 80%.
- [ ] Security scan completed (dependencies + SAST); dependencies audited.
- [ ] Changelog generated from conventional commits; release notes drafted.
- [ ] Migration scripts tested in staging; rollback procedure tested.
- [ ] Stakeholders notified of the release window.

### Deployment

- [ ] Deploy to staging; smoke tests pass; load/performance test complete.
- [ ] Deploy to production via the chosen strategy; smoke tests pass again.
- [ ] Monitoring dashboards reviewed during rollout.

### Post-Release

- [ ] Health checks verified (HTTP 200, all endpoints).
- [ ] Error rate and P95 latency at or below baseline.
- [ ] User feedback channels and incident response on-call confirmed.
- [ ] Documentation updated (API docs, runbook, changelog); announcement sent.

Communication template and full runbook:
[release-runbook-template.md](release-runbook-template.md).

## Related Skills and External Resources

- [GitHub Actions & Workflows](../../github-actions-workflows/SKILL.md)
- [YAML Pipelines](../../yaml-pipelines/SKILL.md)
- [Version Control](../../version-control/SKILL.md)
- [Monitoring & Logging](../../../development/logging-monitoring/SKILL.md)
- [Semantic Versioning Specification](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Martin Fowler - BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)