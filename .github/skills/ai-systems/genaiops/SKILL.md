---
name: "genaiops"
description: 'Operate generative AI systems safely in production. Use when designing GenAIOps workflows for prompt and model release management, evaluation gates, observability, drift detection, rollback, governance, and continuous improvement.'
metadata:
 author: "Frontier"
 version: "1.0.0"
 created: "2026-04-04"
 updated: "2026-04-04"
compatibility:
 frameworks: ["opentelemetry", "azure-ai-evaluation", "promptfoo", "langsmith", "mlflow", "github-actions"]
 languages: ["python", "typescript", "csharp"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["Versioned prompts and baselines", "Evaluation dataset", "Tracing pipeline", "Release workflow"]
---

# GenAIOps

> WHEN: Designing or operating production GenAI systems with release gates, prompt/model versioning, evaluation automation, observability, drift monitoring, rollback, and governance.

## When to Use

- Defining how prompts, models, and tools move from dev to production
- Setting blocking evaluation gates before promotion
- Designing LLM observability, tracing, and runtime dashboards
- Managing prompt/model rollout, canarying, rollback, and baseline updates
- Coordinating feedback loops, drift detection, and issue remediation

## Decision Tree

```
Operating GenAI in production?
+- Need pre-release quality control?
|  - Add evaluation gates and acceptance baselines
+- Need runtime visibility?
|  - Add tracing, cost, latency, and failure dashboards
+- Need safe rollout?
|  - Use canary/pilot plus rollback path
+- Need prompt and model governance?
|  - Track versions, approvals, and baseline deltas together
+- Need continuous quality improvement?
|  - Add drift monitoring and feedback loops
-- Need compliance or incident readiness?
   - Add audit trails, ownership, escalation, and change records
```

## Core Rules

1. Treat prompts, models, tools, eval datasets, and rubrics as release-managed artifacts.
2. No production promotion without baseline comparison and explicit pass/fail thresholds.
3. Trace every important agent run with enough metadata to explain regressions, cost spikes, and tool failures.
4. Rollout must include rollback: every prompt/model promotion needs a last-known-good fallback.
5. Drift detection is not optional for long-lived agents; monitor quality, not only uptime.

## Operating Model

```text
Prompt / Model Change
  -> local validation
  -> regression dataset run
  -> baseline comparison
  -> reviewer approval
  -> canary or pilot rollout
  -> runtime monitoring
  -> baseline promotion or rollback
```

## Required Artifact Families

- prompts and templates
- evaluation datasets and rubrics
- accepted baseline files
- release decision records
- tracing and telemetry configuration
- rollback instructions and fallback versions

## Production Signals

- task completion rate
- groundedness / faithfulness
- tool-call success rate
- format compliance rate
- refusal rate
- latency and token cost
- hallucination or policy-failure rate
- user feedback or correction rate

## Release Guidance

- Use canary traffic or scoped pilot cohorts before global rollout.
- Promote prompt and model changes separately where possible so regressions are attributable.
- Record what changed: prompt text, few-shot examples, model version, tool schema, thresholds.
- Update the accepted baseline only after a successful canary or pilot period.

## Incident Guidance

- Freeze promotions during unexplained quality regression.
- Route incidents by domain: prompt regression, model drift, retrieval issue, tool issue, or infrastructure issue.
- Roll back to the last-known-good prompt/model pair before attempting deeper tuning.
- Preserve traces, failed examples, and evaluator outputs as evidence.

## Error Handling

- If evaluation data is weak, stop and improve the dataset before automating promotion.
- If metrics conflict, prioritize blocking metrics such as task completion, groundedness, and safety.
- If runtime quality drops with no code change, investigate provider/model drift or upstream data drift first.
- If rollback is impossible, the release process is incomplete and must be fixed before the next promotion.

## Anti-Patterns

- **DemoOps**: Shipping prompts to prod with no baseline or canary -> Add release gates first.
- **Uptime-Only Monitoring**: Treating service health as AI quality health -> Monitor task and output quality directly.
- **One Big Promotion**: Changing prompt, model, tools, and retrieval together -> Separate changes when possible.
- **No Rollback Artifact**: Hoping the team remembers the previous version -> Record fallback prompt/model pairs explicitly.
- **Manual Mystery Fixes**: Hot-editing prompts with no diff, review, or evidence -> Keep all changes repo-local and reviewable.

## Checklist

- [ ] Prompt, model, and tool versions are explicit
- [ ] Baseline comparison exists for every promotion candidate
- [ ] Blocking and warning thresholds are defined
- [ ] Canary/pilot and rollback paths are documented
- [ ] Runtime tracing and quality signals are wired
- [ ] Drift and feedback loops feed back into the backlog

## References

- [Microsoft Foundry observability docs](https://learn.microsoft.com/en-us/azure/foundry/observability/)
- [Azure AI evaluation patterns](https://learn.microsoft.com/en-us/azure/foundry/observability/how-to/evaluate-agent)
- [OpenTelemetry](https://opentelemetry.io/)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Team ships prompts without evidence | Make eval and baseline deltas a required review artifact |
| Quality drops after rollout | Compare traces and baseline runs, then roll back to the last-known-good version |
| Cost grows faster than usage | Inspect token trends, tool loops, and retrieval chunk inflation |
| Ownership is unclear during incidents | Define release owner, runtime owner, and evaluator owner explicitly |