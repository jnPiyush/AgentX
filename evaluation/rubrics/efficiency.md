# Efficiency Rubric

Score whether the response avoids unnecessary edits, tool calls, tokens, and
added complexity (Karpathy: surgical changes, simplicity first).

Target non-blocking metric. Advisory floor: `0.5` (2/4). When activated in the
executable manifest, express this as a warning threshold, not a failing gate.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Minimal, surgical change that fully meets the goal.
- `3` = `0.75`: Efficient; slight avoidable overhead.
- `2` = `0.5`: Noticeable unnecessary work or complexity.
- `1` = `0.25`: Substantial over-engineering or wasted steps.
- `0` = `0.0`: Bloated, redundant, or off-task effort.

## Failure Taxonomy

Tag each sub-floor score with: `inefficient`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
