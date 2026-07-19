# Task Completion Rubric

Score whether the system completed the requested job in the required format
without violating a stated constraint. This is the composite delivery metric;
for finer diagnosis use the `completeness` and `constraint-adherence` rubrics.

Blocking metric. Hard floor: `0.75` (3/4).

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Fully completed, correct format, no missing steps.
- `3` = `0.75`: Completed; only trivial follow-up needed.
- `2` = `0.5`: Partially completed or needs manual follow-up.
- `1` = `0.25`: Largely incomplete.
- `0` = `0.0`: Not completed or violates a required constraint.

## Failure Taxonomy

Tag each sub-floor score with one or more: `incomplete`, `constraint_violation`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.