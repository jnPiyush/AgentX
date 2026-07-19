# Evidence and Verification Rubric

Score whether claims are backed by observable evidence -- tests, tool output,
command results, or cited artifacts -- rather than asserted.

Target blocking metric. Hard floor: `0.75` (3/4). Add the blocking threshold when
this metric is activated in the executable manifest.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Every material claim is backed by cited, checkable evidence.
- `3` = `0.75`: Backed; one minor claim relies on assertion.
- `2` = `0.5`: A key claim is asserted without evidence.
- `1` = `0.25`: Most claims are unverified.
- `0` = `0.0`: No evidence; claims are unverifiable.

## Failure Taxonomy

Tag each sub-floor score with: `unverified_claim`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
