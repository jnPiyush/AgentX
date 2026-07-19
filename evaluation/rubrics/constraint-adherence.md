# Constraint Adherence Rubric

Score whether the response follows the instructions, scope, output format, and
repository or task rules.

Target blocking metric. Hard floor: `0.75` (3/4). Add the blocking threshold when
this metric is activated in the executable manifest.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: All constraints, scope, and format rules honored.
- `3` = `0.75`: Honored; one cosmetic format deviation.
- `2` = `0.5`: One material constraint or scope rule violated.
- `1` = `0.25`: Multiple constraints violated.
- `0` = `0.0`: Ignores explicit instructions or scope.

## Failure Taxonomy

Tag each sub-floor score with: `constraint_violation`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
