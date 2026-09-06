---
name: "release-management"
description: 'Implement release management with versioning strategies, deployment strategies, rollback procedures, and release automation. Use when planning release pipelines, choosing deployment strategies (blue-green, canary, rolling), automating releases, or designing rollback procedures.'
metadata:
 author: "AgentX"
 version: "2.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
---

# Release Management & Deployment Strategies

> **Purpose**: Decision guides for deploy strategy, versioning, rollback, and
> release automation, with full examples routed to references/.

## When to Use This Skill

- Planning a release pipeline or choosing a deployment strategy (blue-green,
  canary, rolling, feature flags).
- Automating version bumps, changelogs, or designing a rollback procedure.
- For CI job syntax alone, use the workflow skill; hotfixes still need
  release controls and a rollback plan.

## Prerequisites

- CI/CD pipeline infrastructure and Git-based version control.
- A staging environment to rehearse rollback before it is needed live.

## Decision Tree

Strategy choice follows risk tolerance and rollback speed needed, not habit:
pick the deploy strategy by rollback speed and infra budget, the versioning
scheme by release cadence and audience, and the rollback method by
deployment type and whether a database migration is involved.

```
Deploy strategy -> instant rollback + budget: Blue-Green; code-level
  toggle: Feature Flags; gradual risk by traffic %: Canary; default: Rolling
Version scheme  -> public API/library: SemVer; time-based cadence: CalVer;
  internal continuous delivery: Commit-based
Rollback method -> DB change: Expand-Contract; stateless: redeploy prior
  artifact; flag-controlled: disable flag (instant)
```

## Core Rules

- Tag every release in VCS; version APIs explicitly; never mutate a
  released version's contents after publishing.
- Build the artifact once; deploy that identical artifact to every
  environment through the pipeline.
- Every release carries a rollback plan tested in staging before it is ever
  needed in production.
- Gate production behind passing staging smoke tests and a required
  reviewer; never skip validation for a "small" change.
- Automate version bump, changelog, and smoke tests from conventional
  commits; automate rollback only under an approved incident policy.

## Workflow

1. Choose the deploy strategy and versioning scheme from the Decision Tree;
   confirm the rollback method for this change (schema, stateless, flag).
2. Validate the version tag, build once, and run the full test suite before
   creating the release artifact.
3. Deploy to staging, run smoke tests, and gate production behind required
   reviewer approval.
4. Deploy to production via the chosen strategy; rerun smoke tests; watch
   error rate and P95 latency against baseline.
5. On a threshold breach, roll back using the method chosen in step 1 (see
   Error Handling).
6. Record the outcome, update the changelog and runbook, notify
   stakeholders.

## Checklist

- [ ] Deploy strategy and version scheme chosen from the Decision Tree, not
      habit.
- [ ] Rollback plan tested in staging for the chosen deployment type.
- [ ] Staging smoke tests pass before production; required reviewer
      approved.
- [ ] Error rate and P95 latency baselines captured before deploy.
- [ ] Changelog generated from conventional commits; stakeholders notified.
- [ ] Full pre/deployment/post-release checklist in the runbook reference
      is complete.

## Error Handling

- Error rate > 2x baseline, or health check failing > 2 minutes: automatic
  rollback via the chosen strategy's method (recalibrate this multiplier
  against the service's own baseline; see the versioning reference).
- P95 latency degraded > 50%: investigate first, then manual rollback if
  unresolved.
- Critical bugs or CVEs: contain and assess affected versions; roll back
  only to a safer known-good release, not one that reintroduces the flaw.
- Rollback itself fails: use the database/runbook procedure in
  [rollback-scripts.md](references/rollback-scripts.md); do not repeat the
  same rollback blindly.
- Deploy blocked by failing smoke tests: hold the release; do not force
  through with manual overrides.

## Anti-Patterns

| Pattern | Fix |
|---------|-----|
| Friday/holiday deploy, no on-call | Deploy early-week, full team available |
| Untested rollback | Rehearse rollback in staging every release |
| Big-bang release bundling weeks of change | Ship smaller increments via canary/feature flags |
| Manual changelog written after the fact | Generate from conventional commits in the pipeline |
| Rebuilding the artifact per environment | Build once, promote the same artifact |

## Differentiation

Strategy, migration compatibility and rollback approval determine release risk.
Use the existing scripts and runbooks; calibrate thresholds to the service.

## References

- [Deployment strategy YAML examples](references/deployment-strategy-examples.md)
- [Release pipeline YAML (GitHub Actions + Azure Pipelines)](references/release-pipeline-examples.md)
- [Release automation workflows](references/release-automation-workflows.md)
- [Rollback scripts](references/rollback-scripts.md)
- [Runbook, communication template, full checklist](references/release-runbook-template.md)
- [Versioning schemes, rollback thresholds, extended checklist](references/release-versioning-and-checklist.md)
- [DevOps deployment doc template](references/devops-deployment-doc-template.md)
- [`version-bump.ps1`](scripts/version-bump.ps1) / [`generate-changelog.ps1`](scripts/generate-changelog.ps1)