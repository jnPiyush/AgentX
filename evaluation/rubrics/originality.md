# Originality Rubric (Conditional)

Score whether the output adds unique, non-generic value. Apply ONLY to UI,
content, ideation, and design tasks; drop it for bug fixes, infrastructure, and
security work where novelty is not desired (see profiles in the rubrics README).

Target non-blocking metric. Advisory floor: `0.5` (2/4) when applied. When
activated in the executable manifest, express this as a warning threshold, not a
failing gate.

## Anchored Scale (0-4, normalized to 0-1)

- `4` = `1.0`: Distinct, insightful, non-generic output.
- `3` = `0.75`: Solid with some original framing.
- `2` = `0.5`: Competent but generic.
- `1` = `0.25`: Formulaic, boilerplate tells.
- `0` = `0.0`: Pure slop / template output.

## Failure Taxonomy

Tag each sub-floor score with: `generic_output`.

## Judge Output

Return `{ "score": 0-4, "normalized": 0-1, "failures": [..], "evidence": "..", "remediation": ".." }`.
