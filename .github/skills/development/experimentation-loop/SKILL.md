---
name: "experimentation-loop"
description: "Run a metric-driven autonomous experimentation loop on an isolated branch. Use when a task has a measurable target (latency, bundle size, test pass-rate, build time, memory, score, accuracy) and the agent should propose changes, measure each attempt against a baseline, keep wins and revert losses, and produce a durable audit trail. Distinct from iterative-loop, which is correctness-driven."
metadata:
  author: "AgentX"
  version: "1.1.0"
  created: "2026-04-28"
  updated: "2026-05-21"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Experimentation Loop

> **Purpose**: Drive a measurable metric in a chosen direction by running many small, isolated experiments, keeping wins, and reverting losses.
> **Scope**: Branch isolation, metric definition, attempt audit trail, keep/revert decision rule.

---

## When to Use This Skill

- A target metric exists and can be measured by a deterministic command
- The desired direction is known (lower latency, higher pass-rate, smaller bundle)
- Many small attempts are likely needed
- Reverting a bad attempt is cheap (single git checkout)
- A durable record of every attempt is valuable

## When NOT to Use

- Correctness work where the goal is binary "tests pass" -- use `iterative-loop`
- Tasks without a measurable metric or a way to compute it from a single command
- Risk-bearing changes that should not auto-revert (use a normal review flow)
- Production hotfixes (use targeted change with explicit review)

## Prerequisites

- Clean working tree on a non-main branch
- A metric command that exits 0 and prints a single numeric value, OR a JSON value reachable by a fixed JSON pointer
- A baseline measurement captured before the loop starts
- Permission to commit on the experimentation branch
- The loop runner MUST record `files_changed` (modified tracked files) and `files_added` (new untracked files) per attempt; reverts without that list are forbidden

---

## Decision Tree

```
Is the goal a measurable number?
+- No -> use iterative-loop or standard workflow
- Yes
   +- Can the metric be computed by one command?
   |  +- No -> wrap it in a script that prints one number, then proceed
   |  - Yes -> proceed
   - Is each attempt cheap to revert?
      +- No -> do not auto-revert; require human gate per attempt
      - Yes -> use this loop
```

---

## Loop Pattern

```
1. Capture baseline metric on isolated branch
2. Propose a single, narrow change with a hypothesis
3. Apply the change
4. Run the metric command
5. Compare against current best
   +- Improvement -> commit, update best, log win
   - Regression or no change -> revert working tree, log loss
6. Optional: stop if N consecutive losses or budget exhausted
7. Repeat until target reached, max attempts hit, or diminishing returns
```

The loop owns three durable artifacts:

- The experimentation branch (e.g. `exp/<issue>-<topic>`)
- An attempt log at `docs/execution/experiments/EXPERIMENT-<issue>-<topic>.tsv`
- A summary note at `docs/execution/experiments/EXPERIMENT-<issue>-<topic>.md`

---

## Attempt Log Format (TSV)

One line per attempt. Tab-separated for easy diffing and shell post-processing.

```
attempt    timestamp    hypothesis    files_changed    metric    delta    decision    notes
1    2026-04-28T10:00:00Z    baseline    -    1820    -    baseline    initial measurement
2    2026-04-28T10:04:00Z    cache hot path    src/app/router.ts    1655    -165    keep    confirmed by repeated run
3    2026-04-28T10:08:00Z    inline small helper    src/app/util.ts    1670    +15    revert    no measurable win
4    2026-04-28T10:13:00Z    drop dev-only middleware    src/app/server.ts    1601    -54    keep    verify in staging
```

Columns:

| Column | Meaning |
|--------|---------|
| `attempt` | Monotonic counter starting at 1 |
| `timestamp` | UTC ISO-8601 |
| `hypothesis` | One short sentence; what the agent expects this change to do |
| `files_changed` | Comma-separated paths or `-` for baseline |
| `metric` | Numeric result of the metric command |
| `delta` | Signed delta vs current best |
| `decision` | `baseline`, `keep`, `revert`, `skip` |
| `notes` | Optional: confidence, follow-ups, blockers |

The TSV is append-only. The agent MUST NOT rewrite past rows.

---

## Summary Note Template

```markdown
# Experiment: <topic> (issue #<n>)

## Goal

- Metric: <name>
- Direction: <minimize | maximize>
- Target: <value or "best effort within N attempts">
- Baseline: <value> (commit <sha>)
- Best so far: <value> (commit <sha>)

## Status

- Branch: exp/<issue>-<topic>
- Attempts: <n> total, <kept> kept, <reverted> reverted
- Stop reason: <target hit | max attempts | diminishing returns | manual stop>

## Verified Wins

- Attempt <n>: <hypothesis>, delta <signed>, commit <sha>

## Notable Losses

- Attempt <n>: <hypothesis>, delta <signed>, learned <one line>

## Open Follow-ups

- <list>
```

---

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

## Decision Rule

For each attempt, after running the metric command:

| Condition | Action |
|-----------|--------|
| `delta` improves the metric in the desired direction by more than `noise_threshold` | `keep`: `git add -A && git commit -m "exp(<n>): <hypothesis>"` |
| `delta` regresses or is within `noise_threshold` | `revert`: scoped restore (see below) |
| Metric command failed to run | `skip`: revert and log the failure mode |
| Same `hypothesis` keyword tried in last 3 attempts | `skip`: avoid re-running near-identical changes |

### Scoped Revert Procedure

A blanket `git checkout -- .` plus `git clean -fd` will destroy unrelated untracked work. The loop MUST revert only what the current attempt produced:

1. Run `git status --porcelain`. If any path is dirty or untracked AND not in `files_changed` ∪ `files_added` for this attempt, abort the revert and surface the unexpected paths -- do not auto-clean.
2. Restore tracked changes scoped to this attempt:
   - `git restore --source=HEAD --staged --worktree -- <files_changed>`
3. Remove untracked files this attempt created, one path at a time:
   - `Remove-Item -LiteralPath <path>` (or `rm <path>`) for each entry in `files_added`
4. Re-run `git status --porcelain` and assert it is empty before the next attempt begins.

If the runner cannot produce reliable `files_changed` / `files_added` lists, the loop MUST stop and escalate rather than fall back to a blanket revert.

`noise_threshold` SHOULD be set explicitly per metric (for example, 1% for benchmark times, exact equality for integer counts).

---

## Stop Conditions

The loop stops when ANY of:

- Target metric value reached
- `max_attempts` exhausted
- N consecutive `revert` decisions (recommended N = 5)
- Best metric has not improved in the last M attempts (recommended M = 8)
- Manual stop signal in the summary note

---

## Worked Example: Reduce Test Suite Wall Time

```
Goal: minimize wall-clock time of `npm test`
Direction: minimize
Baseline: 182.0 s
Target: under 150 s
Branch: exp/198-test-time
Noise threshold: 2%
Max attempts: 20
```

Per attempt the agent:

1. Picks a single hypothesis from a short backlog (e.g. parallelize a slow file group, mock a slow integration call, prune a duplicated setup)
2. Applies a narrow change, often touching one or two files
3. Runs `npm test --silent` three times, takes the median
4. Computes delta against current best
5. Keeps or reverts per the decision rule
6. Appends a row to the TSV and updates the summary note

Stop after either reaching `< 150 s` or after 8 attempts without improvement.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Running multiple changes per attempt | Cannot attribute the delta to one cause |
| Skipping the revert step | Loop accumulates noise and regressions |
| Trusting a single noisy measurement | False positive `keep` decisions pollute the branch |
| Rewriting past TSV rows | Destroys the audit trail |
| Running on `main` directly | Removes the cheap revert guarantee |
| Using a subjective metric | Loop becomes a code review, not an experiment |

---

## Integration With Other Skills

- `iterative-loop`: Use when the goal is "tests pass". Use `experimentation-loop` when the goal is a number to push.
- `code-hygiene`: Run after a series of `keep` attempts to clean up incidental drift.
- `karpathy-guidelines`: Apply the "narrow change" and "verifiable success" rules to each attempt.
- `performance` (architecture): Source of hypotheses for performance-style metrics.

---

## CLI Sketch (Optional)

If a workspace adds CLI plumbing later, the loop maps cleanly onto:

```
experiment start --metric "npm test --json" --direction minimize --target 150 --max 20 --noise 2pct
experiment record --hypothesis "parallelize unit shard 3"
experiment measure
experiment decide
experiment stop
```

This skill does not require a CLI. The loop can be driven entirely from the TSV and summary note.

---

## Done Criteria

- TSV log exists and reflects every attempt
- Summary note is current
- Branch has only `keep` commits, no abandoned dirty state
- Best metric, target, and stop reason are recorded
- Open follow-ups are linked to the originating issue
- If the durable triad is in use (see "Durable Per-Attempt Artifacts"): `run-NNNN.{json,md}` exists for every attempt, `best.json` is consistent, and `JOURNAL.md` is current
