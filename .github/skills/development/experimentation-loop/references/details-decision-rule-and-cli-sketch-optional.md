# experimentation-loop: Decision Rule through CLI Sketch (Optional)

> MUST read before work involving **decision rule through cli sketch (optional)**. This reference preserves complete source guidance relocated for context-budget compliance.

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

1. Run `git status --porcelain`. If any path is dirty or untracked AND not in `files_changed` union `files_added` for this attempt, abort the revert and surface the unexpected paths -- do not auto-clean.
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
