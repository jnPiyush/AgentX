# Clarity Rubric

Score whether the output is concise, well-structured, and understandable.

Target non-blocking metric. Advisory floor: `0.5` (2/4). When activated in the
executable manifest, express this as a warning threshold, not a failing gate.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Clear, well-organized, and appropriately concise.
- `3` = `0.75`: Clear; minor structure or verbosity issues.
- `2` = `0.5`: Understandable but poorly organized or padded.
- `1` = `0.25`: Hard to follow.
- `0` = `0.0`: Incoherent.

## Failure Taxonomy

Tag each sub-floor score with: `unclear`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
