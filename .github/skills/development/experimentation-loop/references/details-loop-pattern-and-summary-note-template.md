# experimentation-loop: Loop Pattern, Attempt Log Format (TSV), Summary Note Template

> MUST read before work involving **loop pattern, attempt log format (tsv), summary note template**. This reference preserves complete source guidance relocated for context-budget compliance.

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
