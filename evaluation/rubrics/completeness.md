# Completeness Rubric

Score whether the response addresses every part of the request and each stated
acceptance criterion.

Target blocking metric. Hard floor: `0.75` (3/4). Add the blocking threshold when
this metric is activated in the executable manifest.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Every requested outcome and acceptance criterion is covered.
- `3` = `0.75`: All primary asks covered; a minor secondary point is thin.
- `2` = `0.5`: A material part of the request is unaddressed.
- `1` = `0.25`: Only a fraction of the request is addressed.
- `0` = `0.0`: Does not address the request.

## Failure Taxonomy

Tag each sub-floor score with: `incomplete`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
