# Harness Pruning Rubric

> When to simplify, remove, or tighten harness constraints as model capabilities improve.
> The harness exists to compensate for model weaknesses -- when those weaknesses disappear,
> the harness should shrink rather than accumulate indefinitely.

---

## Purpose

AgentX's harness layer (quality loops, self-review evaluator, bounded contracts, stall
detection, minimum iteration gates) adds reliability but also adds token cost, latency,
and complexity. As foundation models improve, some harness components become unnecessary
overhead. This rubric defines when and how to prune them.

---

## Pruning Decision Framework

### When to Evaluate

Run a pruning evaluation when ANY of these triggers occur:

| Trigger | Signal |
|---------|--------|
| Model upgrade | A new model version is adopted as default (e.g., `claude-opus-4.6` -> `claude-opus-5`) |
| Success rate plateau | Self-review approval rate exceeds 90% on first attempt for 30+ tasks |
| Latency budget exceeded | Harness overhead (self-review + stall detection) exceeds 40% of total session time |
| New capability | Model gains native tool verification, structured output, or planning that overlaps a harness function |
| Cost threshold | Token spend on harness mechanics exceeds 25% of total session tokens |

### Pruning Candidates by Layer

| Layer | Component | Prune When | Preserve When |
|-------|-----------|------------|---------------|
| **Minimum iterations** | 5-iteration floor | First-pass approval rate > 85% across all roles | Any role still needs multiple passes to reach quality |
| **Stall detection** | 3-failure pivot prompt | Models self-correct before hitting 3 consecutive failures | Stall events still occur in production runs |
| **Evaluator verbosity** | Per-category verdict format | Model reliably produces granular feedback without explicit category prompts | Evaluator skips categories or gives vague verdicts without the structure |
| **Calibration examples** | Inline few-shot examples in review prompt | Model correctly distinguishes PASS/FAIL without examples | Evaluator rubber-stamps or nitpicks without calibration |
| **Bounded contracts** | Work-slice contracts for complex tasks | Model can maintain coherent multi-phase delivery without explicit slice boundaries | Multi-phase work still produces partial or drifted results |
| **Sprint decomposition** | Multi-sprint planning | Model handles full feature scope in a single pass | Features still require explicit scope gating |
| **Research-first gate** | Mandatory read-before-write | Model reliably reads context before modifying | Premature edits still occur without the gate |

### Decision Checklist

Before removing any harness component:

1. **Evidence required**: Run at least 10 representative tasks WITH and WITHOUT the component
2. **Failure mode check**: Document what failure the component prevents; verify the model no longer exhibits that failure
3. **Reversibility**: Ensure the component can be re-enabled via config without code changes
4. **Gradual rollout**: Disable for one role first (e.g., Engineer), measure, then expand
5. **Monitor after removal**: Track self-review approval rate, rework rate, and user-reported quality for 2 weeks

---

## Configuration Surface

Harness components should be configurable in `.agentx/config.json` so pruning does not require
code changes:

```json
{
  "harness": {
    "selfReview": {
      "minIterations": 5,
      "maxIterations": 15,
      "stallThreshold": 3,
      "enableCategoryVerdicts": true,
      "enableCalibrationExamples": true,
      "enableStallDetection": true
    },
    "researchFirst": {
      "enabled": true,
      "minSteps": 2
    }
  }
}
```

When a component is disabled via config, the runner should skip it silently rather than
removing the code path, so re-enabling is a config change rather than a deploy.

---

## Anti-Patterns

### DO NOT prune based on:
- A single successful run ("it worked once without the guard")
- Model marketing claims ("the changelog says it handles multi-step tasks")
- Token savings alone (correctness always outweighs cost)
- Anecdotal developer preference ("the loop feels slow")

### DO prune based on:
- Statistically significant improvement in first-pass quality (>= 10 task sample)
- The specific failure mode the component prevented no longer occurs
- The model demonstrates the capability the component was compensating for

---

## Pruning Log

Record all pruning decisions here for traceability.

| Date | Component | Decision | Evidence | Model |
|------|-----------|----------|----------|-------|
| (none yet) | - | - | - | - |

---

**See Also**: [WORKFLOW.md](../WORKFLOW.md) | [EVALUATOR-CALIBRATION.md](EVALUATOR-CALIBRATION.md) | [tech-debt-tracker.md](../tech-debt-tracker.md)