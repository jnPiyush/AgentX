# AgentX Implementation Quality Rubric

Use this rubric for every AgentX quality loop that changes implementation code.
The final independent reviewer scores the exact changed-code scope, and
`scripts/score-code-quality.ps1` validates the report before `loop complete`.
Docs-only, test-only, and generated-file changes do not activate this rubric.

## Gate

- Overall score MUST be at least `80/100`.
- Every blocking dimension MUST meet its hard floor.
- Every dimension MUST include concrete evidence from the changed code or tests.
- HIGH or MEDIUM findings MUST be resolved before approval.
- The report file list and SHA-256 values MUST match the final implementation.
- The loop baseline and every archived iteration artifact MUST match their
  SHA-256 values recorded by the CLI.

Scores use an anchored `0-4` scale:

| Score | Meaning |
|------:|---------|
| 4 | Strong implementation with direct evidence and no material issue |
| 3 | Meets the bar with only minor, non-blocking improvement available |
| 2 | Partially meets the bar; material improvement is required |
| 1 | Major defect or unsupported quality claim |
| 0 | Missing, unsafe, incorrect, or unverifiable |

## Dimensions

| ID | Weight | Blocking | Floor | Review Question |
|----|-------:|----------|------:|-----------------|
| `requirements-fit` | 15 | yes | 3 | Does the implementation satisfy every in-scope requirement and acceptance criterion without scope drift? |
| `design-conformance` | 10 | yes | 3 | Does the implementation follow the approved ADR, specification, interfaces, data model, and UX contracts? |
| `logic-correctness` | 15 | yes | 3 | Are behavior, boundary cases, state transitions, and invariants correct? |
| `verification-tests` | 15 | yes | 3 | Do focused and regression tests prove changed behavior, failures, requirements, and design contracts? |
| `security-privacy` | 10 | yes | 3 | Are inputs, authorization, secrets, injection risks, and sensitive data handled safely? |
| `reliability-errors` | 10 | yes | 3 | Are failures explicit, actionable, bounded, and recoverable without swallowed errors? |
| `maintainability-readability` | 10 | no | 2 | Is the code cohesive, typed where supported, named clearly, and consistent with local patterns? |
| `simplicity-scope` | 5 | no | 2 | Is this the smallest design that meets the requirement without duplication or speculative abstraction? |
| `performance-resources` | 5 | no | 2 | Does the change avoid avoidable blocking, unbounded work, leaks, and obvious hot-path regressions? |
| `documentation-operability` | 5 | no | 2 | Are public contracts, configuration, migration, diagnostics, and operator impacts documented as needed? |

Weights total exactly `100`.

## Required Report

The independent-review evidence is JSON with this shape:

```json
{
  "rubricVersion": "2.0.0",
  "reviewer": "reviewer-id",
  "reviewedAt": "2026-08-29T12:00:00Z",
  "files": [
    { "path": "src/example.ts", "sha256": "<64 uppercase hex characters>" }
  ],
  "dimensions": [
    {
      "id": "requirements-fit",
      "score": 4,
      "evidence": "Named tests and code locations that support the score.",
      "findings": []
    }
  ]
}
```

Include all ten dimensions exactly once. A finding uses `severity`, `file`,
`issue`, and `suggestedFix`; severity is `high`, `medium`, or `low`. The
evaluator calculates the weighted score rather than trusting a reported total.

## Review Rules

1. Run `pwsh scripts/score-code-quality.ps1 -Mode Scope -Json` after the final
   implementation edit to obtain the exact paths and hashes.
  After a stale-session reset, start with `loop start --include-existing-changes`
  when the current dirty implementation belongs to the resumed task.
2. Review only after focused tests, the full required suite, lint, and applicable
   security checks have produced evidence.
3. Score dimensions independently. Do not raise one dimension to compensate for
   a blocking floor breach.
4. Cite concrete files, symbols, tests, or command results in each evidence field.
5. Write the report as the final independent-review evidence. Any later code edit
   changes a hash and requires a fresh review.

## Failure Taxonomy

Use concise finding tags where useful: `requirement_gap`, `scope_drift`,
`design_drift`, `incorrect`, `missing_test`, `unsafe`, `unhandled_failure`,
`overengineered`, `duplicate`, `performance_regression`,
`undocumented_operation`.
