# Model Change Test Automation

Use this reference when a prompt or model change needs executable comparison
evidence instead of a narrative claim.

## What already exists here

- [`../scripts/run-model-comparison.py`](../scripts/run-model-comparison.py)
  compares a configured model matrix on one dataset. It accepts `--config`,
  `--dataset`, `--results-dir`, `--output-dir`, `--system-prompt`,
  `--check-gates`, `--fail-on-regression`, `--baseline`, and `--skip-eval`.
  Today it writes per-model JSON, emits Markdown/JSON reports, gates
  `task_completion`, `format_compliance`, and `avg_latency_ms`, and compares the
  primary model with a baseline on `task_completion` and `format_compliance`.
- [`../scripts/check-model-drift.ps1`](../scripts/check-model-drift.ps1)
  performs a heuristic readiness scan for recorded model identity,
  externalized config, baseline files, migration notes, dataset freshness,
  drift signals, out-of-domain handling, and judge setup.
- [`../scripts/validate-agent-checklist.ps1`](../scripts/validate-agent-checklist.ps1)
  performs a heuristic production-readiness scan for secrets, env/config usage,
  tracing, evaluation assets, termination controls, and input validation.
- [`../scripts/scaffold-agent.py`](../scripts/scaffold-agent.py) creates a starter
  project with `--name <project> --with-eval`; generated evaluation scaffolds are
  not evidence that a model has passed.

The PowerShell validators accept `-Path <workspace> -Strict`; strict mode makes
warnings blocking. Invoke these files from this skill's `scripts` directory, or
use their full paths. They inspect artifacts, not live provider behavior.

## Input and output contracts

`config/models.yaml` has a `models` mapping keyed by role. Each model requires
`name`; `deployment` defaults to that name and `provider` defaults to `azure`.
The regression comparison requires the role key `primary`.

```yaml
models:
  primary:
    name: replace-with-resolved-model-id
    deployment: replace-with-approved-deployment
    provider: azure
thresholds:
  task_completion: 0.95
  format_compliance: 0.99
  max_latency_ms: 5000
  max_regression_pct: 10
```

Replace these illustrative thresholds with approved numeric service criteria;
the helper does not expand environment-variable placeholders in this YAML.
The JSONL dataset contains one case per line with `query` (or `input`).
Reject empty cases in preflight: missing both keys sends an empty prompt that can
still score as a non-errored call. `expected_response` (or `response`) is read but
does not turn the helper's heuristic metrics into a correctness grader.

A baseline JSON contains `scores.task_completion` and
`scores.format_compliance` as actual measured numeric fractions, not example
values. Retain `model`, `timestamp`, `dataset` and `dataset_size` provenance.
For example, the shape is `{"scores":{"task_completion":0.97,"format_compliance":0.99}}`;
those example scores MUST NOT be used as evidence. Require both metrics and a
`primary` result. Missing or non-positive baseline values are skipped by the
percentage check; handle that case explicitly rather than claiming no regression.
Pass `--baseline` explicitly and verify its provenance. When omitted, the helper
searches `evaluation/baseline.json`, `baseline.json`, then
`evaluation/results/baseline.json`; an unrelated stale file can be selected.

Per-model JSON is written under `--results-dir`; comparison reports are
`comparison-report.json` and `comparison-report.md` under `--output-dir`
(default `evaluation`). Keep the exact inputs and run provenance with those files.

## Minimal workflow

1. Save the last accepted baseline and the current resolved deployment identity.
   Assert that config, dataset and baseline exist and are valid before invoking
   CI gates; verify that stored results belong to this dataset and candidate.
2. Resolve the candidate deployment from the active host or provider catalog.
3. Run the same dataset and system prompt across the comparison set.
4. Review gate failures before promotion, especially structured output and tool
   regressions.
5. Use the heuristic PowerShell validators as smoke tests, not as proof that the
   migration is safe.
6. Archive the report, fallback choice, and rollback decision with the release.

## Evidence caveats

Do not copy placeholder model IDs or sample thresholds from documentation. The
Python comparer reads thresholds from config when present and otherwise falls
back to script defaults, which are starter values rather than universal policy.
Its current report does not independently prove coherence, relevance, or cost
quality. `task_completion` measures non-errored calls; `format_compliance` checks
response length exceeds ten characters. Neither validates task success, schemas
or tool calls, and the runner sends no tools. The declared `coherence`,
`relevance`, `tool_accuracy` and `max_cost_per_1k` thresholds are not enforced.
Use real schema/tool/task graders and calibrated judges before promotion.

Cost figures are not supplied reliably by this helper. Resolve prices for each
deployment at run time and retain the source, verification timestamp and measured
usage with the report. Unknown cost is not zero.

## Failure modes

Missing PyYAML when loading config, or an absent/empty results directory, stops
the run. A missing config or dataset skips evaluation; existing result files can
still be compared using default thresholds. A missing baseline or primary result
skips the regression check and can yield exit 0 even with `--fail-on-regression`.
Fail CI preflight on those omissions before trusting an exit code.

Use `--skip-eval --results-dir <captured-results>` for offline comparisons when
provider access is unavailable; assert result freshness and completeness first.
A clean helper run does not replace privacy, safety or coverage review.

## Related references

- [Model drift and judge patterns](model-drift-judge-patterns.md)
- [Tracing and evaluation](tracing-and-evaluation.md)
- [Prompt engineering](../../prompt-engineering/SKILL.md)
