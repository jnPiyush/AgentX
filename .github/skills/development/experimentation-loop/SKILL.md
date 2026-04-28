---
name: "experimentation-loop"
description: "Run a metric-driven autonomous experimentation loop on an isolated branch. Use when a task has a measurable target (latency, bundle size, test pass-rate, build time, memory, score, accuracy) and the agent should propose changes, measure each attempt against a baseline, keep wins and revert losses, and produce a durable audit trail. Distinct from iterative-loop, which is correctness-driven."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-28"
  updated: "2026-04-28"
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

## Decision Rule

For each attempt, after running the metric command:

| Condition | Action |
|-----------|--------|
| `delta` improves the metric in the desired direction by more than `noise_threshold` | `keep`: `git add -A && git commit -m "exp(<n>): <hypothesis>"` |
| `delta` regresses or is within `noise_threshold` | `revert`: `git checkout -- .` and `git clean -fd` for new files |
| Metric command failed to run | `skip`: revert and log the failure mode |
| Same `hypothesis` keyword tried in last 3 attempts | `skip`: avoid re-running near-identical changes |

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
