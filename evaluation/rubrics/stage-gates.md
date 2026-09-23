# Frontier Stage-Gate Rubric

Stage gates evaluate the deliverable of each pipeline stage before it is handed to
the next role. They complement the implementation rubric
([code-quality.md](code-quality.md)); code changes are still gated by
`scripts/score-code-quality.ps1`.

The machine-readable catalog is [stage-gates.json](stage-gates.json). It is the
single source of truth for required sections, deterministic checks, dimensions,
weights and floors; this file explains the contract.

## Stages

| Stage | Artifacts | Owner |
|-------|-----------|-------|
| `requirements` | `PRD-*.md` | Product Manager |
| `ux` | `UX-*.md` plus a linked HTML prototype | UX Designer |
| `architecture` | `ADR-*.md` and `SPEC-*.md` | Architect |
| `plan` | `EXEC-PLAN-*.md` | Engineer |
| `review` | `REVIEW-*.md`, `*-REVIEW-*.md` | Reviewer |
| `certification` | `CERT-*.md` (legacy `TEST-*.md`) | Tester |

## Flow

1. The author runs `frontier stage-gate plan -Stage <stage> -Path <artifact>[,<artifact>]`
   until every deterministic check passes. Checks are cheap and objective:
   required sections, unfilled template placeholders, one explicit verdict,
   at least three ADR options, diagram-only fences in ADRs and specs, and an
   existing prototype for UX. Verdict lines follow these rules:
   - A verdict line names exactly one catalog value after its label
     (`Decision: CHANGES REQUESTED`, `| Certification Decision | PASS |`) or
     leads a line under a heading that is exactly a label (`## Decision`,
     `## Go / No-Go Decision`, not `## Decision Log`). Emphasis such as
     `**APPROVED**` or `_CHANGES REQUESTED_` is allowed.
   - A checked box (`[x]`) or a `[PASS]`, `[FAIL]` or `[WARN]` marker may
     precede the verdict; `[PASS]` and `[FAIL]` must agree with the catalog's
     `approving` verdicts. An unchecked box is an unselected option.
   - These void the line: other markers such as `[TODO]`; negation
     (`NOT APPROVED`, `**NOT** APPROVED`, `NOT YET APPROVED`); option lists such
     as `APPROVED | BLOCKED`; uncertainty in the verdict clause (`?`, probably,
     possibly, tentative, preliminary, draft, for now, TBD); and a condition on
     an unconditional approval (`APPROVED if CI passes`, `when`, `upon`,
     `provided`, `on condition that`, `PASS pending sign-off`). For an approval
     with conditions, use a catalog `conditional` verdict such as
     `CONDITIONAL PASS`, or a rejection.
   - The verdict clause ends at ` - `, `;`, `because`, `since` or a period
     followed by a capitalized sentence, so `(see sec. 3) if CI passes` is still
     a condition. Condition words inside the clause void an approval even when
     they report history (`Approved when CI went green`); put rationale after
     the clause end instead.
   - Under a decision heading, a verdict word in sentence case that opens a
     longer term is prose (`Go-live`, `Pass rate: 91%`, `Blocked items: none`),
     and so is a tally in a list or table (`- PASS: 120 tests`, `| FAIL | 0 |`).
   - A void line fails the check even beside a clean verdict. All verdict lines
     in the artifact, including lines under one heading, must agree on approval
     (`PASS` and `GO` agree), so a summary `Status: APPROVED` cannot contradict a
     later `Decision: CHANGES REQUESTED`. The message names the line and the
     reason.
   - A `Status:`, `Decision:` or `Verdict:` line anywhere in the artifact is a
     verdict line when it leads with a catalog value. Describe per-finding state
     with other words, such as `Status: Resolved` or `Status: Open`.
   - The parser is a heuristic. It ignores lines it cannot read, so one of them
     fails the artifact only when no other verdict line is clean. It does not
     read a value outside the stage's catalog (`Verdict: FAIL` in a review), a
     second checkbox on one line or a numbered checkbox, and it does not treat
     `after` as a condition because the word usually reports history.

   The placeholder check ignores code fences, inline code and HTML comments, so
   write literal braces such as a route `/api/v1/{resource}` or
   `Showing {count} results` in inline code.
2. An independent reviewer (a different person or subagent that sees only the
   artifacts, not the author's reasoning) scores every dimension printed by
   `plan` and writes the report to
   `docs/artifacts/reviews/gates/GATE-<stage>-<id>.json`. `plan -Json` emits a
   `reportTemplate` bound to the current SHA-256 of each artifact.
3. `frontier stage-gate validate -Stage <stage> -Path <artifacts> -ReportPath <report>`
   re-runs the checks and validates the report.
4. `frontier validate <issue> <role>` runs the same gate for `pm`, `ux`,
   `architect`, `reviewer` and `tester` handoffs.

Exit codes: `0` ready or passed, `1` blocked, `2` invalid input.

## Gate Rules

- Every deterministic check passes.
- `rubricVersion` matches the catalog and `stage` matches the gate.
- `reviewer` is a non-empty string; an optional `author` must differ from it.
- `reviewedAt` is a valid timestamp no more than 5 minutes in the future.
- `files` lists exactly the gated artifacts with their current SHA-256, computed
  over the UTF-8 text with LF line endings and no BOM so Windows and Linux
  checkouts of a committed artifact agree. Any content edit after review
  invalidates the report, so re-review the final version.
- Every catalog dimension appears once with an integer score from 0 to 4 and
  specific evidence. `TODO`, `TBD`, `untested`, `no evidence`, `n/a` and `none`
  are rejected.
- Each finding has `severity` (`high`, `medium` or `low`), `file`, `issue` and
  `suggestedFix`. Any HIGH or MEDIUM finding blocks the gate.
- Blocking dimensions meet their floor (3); the weighted score is at least 80.

Scores use the shared anchored scale in [README.md](README.md#shared-scoring-scale):
4 fully meets with strong evidence, 3 meets with minor issues, 2 partial,
1 major failure, 0 missing or unverifiable.

## Report Shape

```json
{
  "rubricVersion": "1.0.0",
  "stage": "requirements",
  "reviewer": "reviewer-subagent",
  "author": "product-manager",
  "reviewedAt": "2026-09-20T10:00:00Z",
  "files": [{ "path": "docs/artifacts/prd/PRD-42.md", "sha256": "<uppercase hex>" }],
  "dimensions": [
    {
      "id": "testable-requirements",
      "score": 3,
      "evidence": "FR-1..FR-6 each have Given/When/Then criteria; FR-4 lacks a timeout path.",
      "findings": [
        {
          "severity": "low",
          "file": "docs/artifacts/prd/PRD-42.md",
          "issue": "FR-4 has no failure-path criterion.",
          "suggestedFix": "Add a criterion for the upstream timeout."
        }
      ]
    }
  ]
}
```

## Enforcement Mode

`frontier validate` reads `stageGates` from `.frontier/config.json`:

| Value | Behavior |
|-------|----------|
| `advisory` (default) | Deterministic checks print as warnings; an existing report must pass |
| `required` | Deterministic checks and a passing report are required for handoff |
| `off` | Only artifact existence is checked |

An unrecognized value is treated as `required` (with a warning), so a typo cannot
silently weaken the gate. Set it with `frontier config set stageGates required`.

## Limits

Deterministic checks prove structure, not quality. A passing report proves that an
attributed reviewer scored the exact artifact content; it does not prove which model
or person did the review, and the SHA-256 binding is integrity evidence, not a
signature. Keep independent review real: one agent grading its own draft is not a
stage gate.
