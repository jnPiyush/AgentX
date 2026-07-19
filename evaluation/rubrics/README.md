# Evaluation Rubrics

Keep one rubric file per judged metric.

## Rubric Rules

- Define what a strong score means before running evaluations.
- Keep rubrics short, specific, and auditable.
- Prefer explicit scoring criteria over vague quality language.
- Recalibrate rubrics when the task or output format changes.

## Shared Scoring Scale

The target model-backed rubric library uses an anchored `0-4` scale normalized to
`0-1`:

| Score | Normalized | Meaning |
|-------|------------|---------|
| 4 | 1.0 | Fully meets the criterion with strong evidence |
| 3 | 0.75 | Meets it; only minor issues |
| 2 | 0.5 | Partially meets it; material improvement needed |
| 1 | 0.25 | Major failure |
| 0 | 0.0 | Missing, incorrect, unsafe, or unverifiable |

For the target model-backed judge, overall score is the weighted mean of normalized
scores. A **blocking** metric's hard-floor breach fails the evaluation regardless
of the aggregate -- a high mean must never mask a blocking failure. Non-blocking
metrics use advisory floors that warn but do not fail. The bundled deterministic
sample runner does not yet calculate this weighted score.

## Metrics, Weights, and Floors

Weights below are the **target default (coding / infra / security) profile** and
sum to `1.0`. Exactly one of `efficiency` or `originality` is active per profile
(see Task Profiles), so the active set is always 7 weighted metrics.
`task-completion` is a gate-only composite (weight `0`) retained for the runnable
sample. The current executable gates for both sample metrics remain `0.8`; the
table's anchored floors apply when the model-backed judge is activated.

| Metric | Weight | Blocking | Floor |
|--------|-------:|----------|------:|
| correctness (correctness + faithfulness) | 0.25 | yes (hard floor) | 0.75 |
| completeness | 0.15 | yes (hard floor) | 0.75 |
| constraint-adherence | 0.15 | yes (hard floor) | 0.75 |
| evidence-verification | 0.15 | yes (hard floor) | 0.75 |
| safety-security | 0.15 | yes (hard floor) | 1.0 |
| clarity | 0.10 | no (advisory floor) | 0.5 |
| efficiency (default profile) | 0.05 | no (advisory floor) | 0.5 |
| originality (ui/content profile, replaces efficiency) | 0.05 | no (advisory floor) | 0.5 |
| task-completion | 0.0 (gate-only) | yes (hard floor) | 0.75 |

A **hard floor** is enforced by a blocking threshold and fails the evaluation on
breach. An **advisory floor** is a minimum quality target for a non-blocking
metric. When a target metric is promoted into the executable `metrics` list, its
floor MUST also be added to `thresholds` as `blocking` or `warning`. The current
manifest thresholds cover only the two metrics emitted by the sample runner.

## Task Profiles

Rubrics are profile-aware. Each profile's weighted metrics sum to `1.0`; the
starred slot is swapped by profile.

| Profile | Weighted metrics (sum 1.0) |
|---------|----------------------------|
| coding / bug-fix / infra / security | correctness, completeness, constraint-adherence, evidence-verification, safety-security, clarity, efficiency |
| ui / content / ideation / design | correctness, completeness, constraint-adherence, evidence-verification, safety-security, clarity, originality |
| planning | correctness, completeness, constraint-adherence, evidence-verification, safety-security, clarity, efficiency |

For rag / retrieval work, add dedicated `faithfulness`, `answer-relevancy`, and
`context-recall` rubrics before use -- they are not declared in the current
manifest and MUST be added explicitly rather than substituted implicitly.

## Deterministic vs Judge Split

- Deterministic checks (schema, required format, file existence, tests, lint,
  acceptance-criterion coverage) MUST run before the judge and can hard-fail on
  their own.
- The LLM judge scores semantic criteria (correctness, completeness, clarity,
  and conditional originality) and returns per-criterion score, evidence,
  failure tags, and remediation -- never a single shared reasoning blob.

## Failure Taxonomy

Every sub-floor score MUST carry at least one tag: `incorrect`, `hallucinated`,
`incomplete`, `constraint_violation`, `unverified_claim`, `unsafe`, `unclear`,
`inefficient`, `generic_output`.

## Judge Reliability

- Use a stronger judge model than the model under test.
- Blind model identity; randomize answer order in pairwise comparisons.
- Calibrate against human-rated examples (target >80% agreement).
- Track score drift; use two judges or adjudication for borderline blocking calls.

## Sample Runner Note

The bundled `scripts/run-ai-eval-sample.ps1` is a deterministic placeholder that
emits continuous `0-1` values for only `correctness` and `task-completion`; their
manifest entries therefore retain `scoringScale: 0-1`. The anchored scales in
their rubric files define the future model-backed judge behavior. The remaining
metrics also require that judge and are declared here as the target contract.
