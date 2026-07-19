# Correctness and Faithfulness Rubric

Score whether the response is factually accurate and grounded in the provided
context, with no fabricated claims.

Blocking metric. Hard floor: `0.75` (3/4). A score below the floor fails the
evaluation regardless of the aggregate.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Fully accurate and grounded; every claim is supported.
- `3` = `0.75`: Accurate; only minor, non-material imprecision.
- `2` = `0.5`: Partially correct or one material claim unsupported.
- `1` = `0.25`: Major factual error or unsupported reasoning.
- `0` = `0.0`: Incorrect, hallucinated, or unverifiable.

## Failure Taxonomy

Tag each sub-floor score with one or more: `incorrect`, `hallucinated`,
`unverified_claim`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.