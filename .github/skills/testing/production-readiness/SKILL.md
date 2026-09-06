---
name: "production-readiness"
description: 'Comprehensive production readiness certification covering quality gates, release checklists, chaos/resilience testing, rollback validation, observability verification, and go/no-go decision frameworks. Use before any production deployment.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-03-01"
  updated: "2026-03-01"
compatibility:
  frameworks: ["k6", "chaos-toolkit", "litmus", "playwright", "trivy", "semgrep"]
  languages: ["typescript", "javascript", "python", "csharp", "java", "go"]
  platforms: ["github-actions", "azure-pipelines", "azure", "aws", "gcp"]
---

# Production Readiness

Certify quality, security, performance and operations before deployment.

## When to Use This Skill

- Certifying a release candidate, running pre-release quality gates, or
  making a go/no-go production deployment decision.
- Validating rollback/recovery, chaos/resilience testing, or verifying
  observability before go-live.
- Not for writing feature tests, building CI pipelines, or initial
  security/performance benchmarking -- use the dedicated testing skills.

## Prerequisites

- Feature development complete (code freeze); unit/integration/e2e suites
  passing; SAST/DAST/SCA scans complete.
- Performance baselines established; staging matches production topology.

## Decision Tree

Route by what is being certified: a release candidate needs the full
quality-gate and checklist pass; a rollback question needs the matching
migration/stateless/flag test; a resilience question needs the matching
chaos injection; a release call needs the weighted decision matrix scored
end to end, not skimmed.

```
Pre-release cert?    -> quality gate pipeline + full checklist (references/)
Rollback question?   -> DB: expand-contract; stateless: redeploy image;
                         flag: disable path
Resilience question? -> upstream: latency/5xx injection; infra: pod kill or
                         partition; data store: connection drop
Go/no-go?            -> score the decision matrix; any category < 3 blocks GO
```

## Core Rules

1. Required gates must pass. Risk acceptance applies only where policy permits;
   non-waivable blockers remain NO-GO.
2. Rollback is tested in staging every release, not assumed to work.
3. Observability (dashboards, alerts, health endpoints) is verified working
   before go-live.
4. Migrations are expand-contract and backward-compatible; never drop a
   column in the same release that stops using it.
5. Go/no-go requires sign-off from Engineering, QA, and Operations.
6. User-facing production workloads use canary or blue-green, never a
   big-bang deploy.
7. Automated smoke tests run immediately after every deployment.
8. Risky features ship behind flags so they can be disabled without a
   redeploy.
9. Accepted risks and deferred fixes are recorded in the decision record.
10. Resilience experiments run in staging before major releases.

## Workflow

1. Confirm prerequisites: code freeze, suites passing, scans complete,
   baselines set.
2. Run the quality gate pipeline (tests, SAST, dependency/secret scan,
   performance smoke) -- full gate YAML in references/.
3. Verify observability: health/ready/live endpoints, dashboards, alerts.
4. Rehearse rollback in staging for this release's deployment type; record
   the recovery time.
5. Run the chaos/resilience experiment matching the changed surface;
   confirm graceful degradation.
6. Score the go/no-go decision matrix; GO only when every category >= 3
   and the total >= 4.0, or record a documented CONDITIONAL GO.
7. Deploy via canary/blue-green; run post-deploy smoke tests; watch
   metrics against baseline before widening traffic.

## Checklist

- [ ] All quality gates pass, or a risk acceptance is documented.
- [ ] Rollback rehearsed in staging for this release's deployment type.
- [ ] Observability verified: health/ready/live endpoints, dashboards, alerts.
- [ ] Go/no-go matrix scored; every category >= 3, total >= 4.0 (or a
      documented CONDITIONAL GO).
- [ ] Multi-person approval recorded (Engineering, QA, Operations).
- [ ] Post-deploy smoke tests pass before widening canary traffic.

## Error Handling

- Any quality gate fails: block the deploy; fix the root cause or record
  an explicit, approved risk acceptance.
- Rollback rehearsal fails: this blocks the release; it is not a
  follow-up item.
- A chaos experiment reveals cascading failure or no self-healing: block
  release, add the missing breaker/backoff/fallback, re-run before
  certifying.
- A decision-matrix category scores below 3: NO-GO; remediate before
  re-scoring, do not average it away with other categories.
- Post-deploy smoke test or canary gate fails: auto-rollback on the
  trigger (error rate > 2x baseline, P95 > 2x baseline, health-check
  failures) under the approved policy; stop widening traffic.
  These illustrative thresholds require service-specific calibration.

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Deploy Friday afternoon | Deploy early week with the team available |
| Skip rollback testing | Test rollback every release |
| Big-bang release | Canary or blue-green deployment |
| Manual repetitive checks | Automate checks; retain required approval decisions |
| Skip chaos testing | Run resilience tests before major releases |
| One-person approval | Require multi-person go/no-go |

## Differentiation

Weighted go/no-go floors, migration rollback and verified observability
distinguish certification from running tests. Reuse the decision record
and chaos cases instead of inventing thresholds under release pressure.

## References

- [Quality gate CI pipeline and chaos experiments](references/quality-gate-and-chaos.md)
- [Full checklist, migration safety, decision record](references/checklists-and-decision-record.md)
- [Release management skill](../../operations/release-management/SKILL.md)