# Frontier Implementation Quality Rubric

Use this rubric for every quality-loop review that changes implementation code.
The independent reviewer scores the exact final scope, and
`scripts/score-code-quality.ps1` validates the report before `loop complete`.
Docs-only, test-only, and generated-file changes do not activate this rubric.

## Gate

- Overall score MUST be at least `80/100`.
- Every blocking dimension MUST meet its hard floor.
- Every dimension MUST include concrete evidence tied to the changed code, tests,
  or executed commands.
- `files`, `dimensions`, and every `findings` field MUST be JSON arrays.
- Required string fields MUST be real non-empty strings, not objects coerced to
  text.
- `reviewedAt` MUST be valid and MUST NOT be more than 5 minutes ahead of the
  validator clock.
- Evidence placeholders such as `TODO`, `TBD`, `untested`, or `no evidence`
  cannot pass when they appear alone.
- HIGH or MEDIUM findings block approval even if the numeric score is `80+`.
- Cosmetic lint/style findings are LOW advisories and do not block local
  completion. Do not fail a dimension or the overall gate solely for deferred
  cosmetic cleanup. Report them with scope and seek separate user approval.
  Genuine build/type, correctness, security, reliability and accessibility
  defects retain their impact-based severity and applicable blockers.
- The report file list and SHA-256 values MUST match the final implementation.
- Baseline or archived-evidence hash mismatches fail closed.

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
| `requirements-fit` | 15 | yes | 3 | Does the implementation satisfy every in-scope requirement and acceptance criterion without hidden scope cuts or drift? |
| `design-conformance` | 10 | yes | 3 | Does the implementation follow the approved ADR, spec, interfaces, data model, and UX contracts? |
| `logic-correctness` | 15 | yes | 3 | Are behavior, bug fixes, boundary cases, state transitions, and invariants correct? |
| `verification-tests` | 15 | yes | 3 | Do current non-test evidence and reviewed regression cases cover the changed contracts, with executed and deferred test scope reported accurately? |
| `security-privacy` | 10 | yes | 3 | Are inputs, authorization, secrets, injection risks, defaults, and sensitive data handled safely? |
| `reliability-errors` | 10 | yes | 3 | Are failures explicit, bounded, actionable, and free of broad swallow-or-default-success behavior? |
| `maintainability-readability` | 10 | no | 2 | Is the code cohesive, named clearly, consistent with local patterns, and free of avoidable AI slop? |
| `simplicity-scope` | 5 | no | 2 | Is this the smallest design that meets the requirement without duplicate logic or speculative abstraction? |
| `performance-resources` | 5 | no | 2 | Does the change avoid unbounded work, leaks, and obvious cost or latency regressions per verified outcome? |
| `documentation-operability` | 5 | no | 2 | Are public contracts, configuration, diagnostics, rollout, and operator impacts documented as needed? |

Weights total exactly `100`.

## Evidence anchors

- `requirements-fit`: map every in-scope acceptance criterion; complete coverage
  beats a high-level summary.
- `design-conformance`: cite the actual contract, interface, or approved design
  rather than "matches intent".
- `logic-correctness`: when fixing a bug, include bug reproduction or a precise
  counterexample; include boundary or negative evidence when those paths changed.
- `verification-tests`: map each acceptance criterion to its implementation,
  reviewed regression cases and actual non-test evidence. Reviewers MUST NOT
  execute suites or coverage to score this dimension. Record suites as not run
  and coverage as not measured unless supplied results prove otherwise; retain
  their original revision. Name unexecuted negative/contract cases and recommend
  post-loop testing. Approval measures review/test readiness, not a test pass.
  CI and release test gates remain independently required where applicable.
- `security-privacy`: call out broad allow/default paths, privilege gaps, unsafe
  logging, or fabricated "security reviewed" claims.
- `reliability-errors`: reject broad catch-and-continue, silent fallbacks,
  default-success returns, or timestamp refreshes used as fake freshness.
- `maintainability-readability` and `simplicity-scope`: flag duplicated logic,
  slop, decorative abstractions, and code that makes future review harder.
- `performance-resources`: measure cost, latency, or token use per verified
  outcome when the change affects those surfaces; raw totals without outcomes are
  weak evidence.
- `documentation-operability`: concise evidence is acceptable; semantic proof or
  long prose is not required.

## Required report

The independent review evidence is JSON with this shape:

```json
{
  "rubricVersion": "2.0.0",
  "reviewer": "independent-reviewer-id",
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
evaluator calculates the weighted score and ignores any claimed total.

## Review rules

1. Run `pwsh scripts/score-code-quality.ps1 -Mode Scope -Json` after the final
   implementation edit to obtain the exact paths and hashes.
2. Review after relevant non-test checks have produced current evidence.
   Inspect regression cases and supplied results without executing suites;
   retain deferred testing and separate CI/release requirements in the report.
3. Read the whole relevant execution surface: changed code, related tests,
   config, scripts, migrations, and operator-facing contract updates.
4. The reviewer MUST be independent of the implementation role. No specific
   model or brand is required; independence and evidence are.
5. Do not fabricate approval, inflate a score, or refresh `reviewedAt` to make a
   stale report look current. Any later code edit requires a fresh review.

## Failure taxonomy

Use concise finding tags where useful: `requirement_gap`, `scope_drift`,
`design_drift`, `incorrect`, `missing_test`, `unsafe`, `swallowed_error`,
`overengineered`, `duplicate`, `ai_slop`, `performance_regression`,
`undocumented_operation`, `fabricated_review`.
