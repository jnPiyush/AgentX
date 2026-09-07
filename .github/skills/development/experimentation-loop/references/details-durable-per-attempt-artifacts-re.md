# experimentation-loop: Durable Per-Attempt Artifacts (Recommended When Reuse Is Expected)

> MUST read before work involving **durable per-attempt artifacts (recommended when reuse is expected)**. This reference preserves complete source guidance relocated for context-budget compliance.

## Durable Per-Attempt Artifacts (Recommended When Reuse Is Expected)

The TSV log captures one row per attempt and is sufficient for short loops. When the experiment is expected to feed downstream reuse -- another agent resuming the loop, a learning capture, a model card, a leaderboard, or a peer critique -- promote each attempt to a durable artifact triad inspired by `hyperspaceai/agi`'s `run-NNNN.{json,md} + best.json + JOURNAL.md` pattern.

### Directory Layout

```
docs/execution/experiments/<issue>-<topic>/
  EXPERIMENT.md           # summary note (Goal, Status, Wins, Losses, Follow-ups)
  attempts.tsv            # append-only flat log
  runs/
    run-0001.json         # machine-readable result for attempt 1
    run-0001.md           # human-readable narrative for attempt 1
    run-0002.json
    run-0002.md
    ...
  best.json               # pointer to the current best run
  JOURNAL.md              # the agent's cognitive journal across attempts
```

The TSV remains the canonical append-only audit log. The triad is additive: it provides depth (per-attempt structure, narrative, cognitive trace) without replacing breadth (one-line-per-attempt history).

### `run-NNNN.json` Schema

```json
{
  "attempt": 7,
  "timestamp": "2026-05-21T09:14:33Z",
  "branch": "exp/198-test-time",
  "parent_commit": "a1b2c3d",
  "result_commit": "e4f5g6h",
  "hypothesis": "parallelize unit shard 3",
  "rationale": "shard 3 dominates wall time per attempt 4",
  "files_changed": ["test/unit/shard3.config.ts"],
  "files_added": [],
  "metric": {
    "name": "npm-test-wall-seconds",
    "value": 158.3,
    "unit": "seconds",
    "samples": [159.1, 158.0, 157.8],
    "aggregator": "median"
  },
  "best_before": 165.5,
  "delta": -7.2,
  "noise_threshold_pct": 2,
  "decision": "keep",
  "stop_signals": [],
  "follow_ups": ["check shard 5 next"]
}
```

Rules:

- One JSON file per attempt, monotonically numbered with zero-padding (`run-0001.json`).
- `decision` is one of `baseline`, `keep`, `revert`, `skip`.
- `samples` and `aggregator` MUST be present when the metric command is run more than once (noise control).
- Files are append-only. The agent MUST NOT rewrite `run-NNNN.json` after it is committed.

### `run-NNNN.md` Narrative

A short human-readable companion. Recommended sections:

```markdown
# Attempt 7 -- parallelize unit shard 3

**Decision**: keep  |  **Metric**: 158.3 s (median of 3)  |  **Delta**: -7.2 s vs 165.5 s best

## Hypothesis

shard 3 dominates wall time per attempt 4

## What I changed

- test/unit/shard3.config.ts: split into 4 parallel jobs

## What I observed

- Three runs converged within 1.3 s
- No new test failures
- CPU saturated at 87% for the shard window

## What I will try next

- Apply the same split to shard 5
- Watch for noisy-neighbor effects when both shards parallelize
```

### `best.json`

A single small file that always points at the current best run. Overwritten in place (the only file in the layout that is not append-only).

```json
{
  "run": "runs/run-0007.json",
  "metric_name": "npm-test-wall-seconds",
  "metric_value": 158.3,
  "result_commit": "e4f5g6h",
  "as_of": "2026-05-21T09:14:33Z"
}
```

### `JOURNAL.md`

The agent's cognitive journal across the whole experiment. Append-only, written in first person, focused on reasoning rather than results.

```markdown
# Journal -- exp/198-test-time

## 2026-05-21 09:00

Starting from baseline 182.0 s. First three attempts focused on the loud shards.
Shard 3 looks like the biggest single lever based on per-file timings.

## 2026-05-21 09:14

Parallelizing shard 3 worked (-7.2 s). The win is real -- three samples agreed
within noise. Worth probing shard 5 with the same shape before trying anything
structural like moving to vitest.

## 2026-05-21 09:42

Shard 5 split was a wash (delta within noise). The shape of shard 5 is different
-- mostly I/O bound. Switching strategy: mock the slow integration test in
shard 5 instead of parallelizing it.
```

### When to Promote to the Triad

| Signal | Use TSV only | Promote to triad |
|--------|--------------|------------------|
| Attempts expected | < 10 | >= 10 |
| Reuse expected | One-shot tuning | Downstream learning capture, leaderboard, peer critique |
| Multiple agents | Single agent in one session | Hand-off across sessions or agents |
| Metric noise | Deterministic / low noise | Multi-sample with aggregator required |
| Audit depth | Single-line per attempt is enough | Reviewer needs rationale + observations per attempt |

The TSV is always written. The triad is added on top when any signal in the right column applies.

### Done Criteria Addition

When the triad is in use, the loop is not complete until:

- Every attempt has both `run-NNNN.json` and `run-NNNN.md`
- `best.json` points at a run that exists and is committed
- `JOURNAL.md` covers each decision boundary at least once
- The summary note in `EXPERIMENT.md` references `best.json` instead of restating the value inline

---
