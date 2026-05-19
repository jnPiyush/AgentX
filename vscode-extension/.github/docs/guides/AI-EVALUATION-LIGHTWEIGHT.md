# Lightweight AI Evaluation

This guide adopts the useful engineering habits behind prompt and evaluation tooling without copying any specific product shape.

## Principles

- Keep prompts, datasets, rubrics, baselines, and reports as plain repo files.
- Borrow the workflow discipline, not the config model.
- Treat prompt changes like code changes: diffable, reviewable, and regression-checked.
- Keep the contract small enough that a contributor can understand it in one read.
- Prefer project-owned metrics and rubrics over framework-specific assertions.

## What To Adopt

- Prompt files live under `prompts/` and are versioned as Markdown.
- Evaluation inputs live under `evaluation/datasets/`.
- Judge criteria live under `evaluation/rubrics/`.
- Accepted baselines live in `evaluation/baseline.json`.
- Regression evidence lives under `.copilot-tracking/eval-reports/`.

## What Not To Copy

- A large assertion DSL.
- Framework-specific plugin or provider semantics.
- Product-shaped terminology that only makes sense if you already know another tool.
- Heavy execution wiring before the team has good datasets, rubrics, and baselines.

## Minimal Workflow

1. Edit or add a prompt in `prompts/`.
2. Run the prompt against a fixed regression dataset.
3. Score outputs against explicit rubrics and thresholds.
4. Compare the result to the accepted baseline.
5. Promote a new baseline only when quality improves or intended tradeoffs are documented.

## Minimum Artifacts Per AI Change

- One prompt file or prompt diff.
- One evaluation dataset with happy-path, edge-case, and adversarial rows.
- One rubric per judged metric.
- Thresholds for blocking and warning gates.
- A baseline file that records the accepted comparison point.

The repo starter pack also includes a tiny sample runner so teams can exercise the file-based workflow before they have a full evaluator. That runner should be replaced once real evaluation logic exists.

The current repo example uses a simple issue-classification prompt plus a deterministic local baseline runner. It is concrete enough to show the workflow end to end, but still intentionally small.

## Metric Guidance

- `correctness`: Did the output solve the task accurately?
- `task-completion`: Did the system finish the requested job?
- `groundedness`: Was the answer supported by the provided context?
- `safety`: Did the output avoid critical policy or harm failures?
- `latency` and `cost`: Track them, but do not let them replace quality metrics.

## Suggested Ownership

- Data Scientist: datasets, baselines, thresholds, comparison logic.
- Prompt Engineer: prompt versions, rubric wording, few-shot examples.
- Engineer: execution path, evidence persistence, CI wiring.
- Reviewer: verify prompt diffs, rubric clarity, baseline deltas, and failure slices.

## Starter Layout

```text
prompts/
evaluation/
  agentx.eval.yaml
  baseline.json
  datasets/
  rubrics/
.copilot-tracking/
  eval-reports/
```

## Keep It Light Test

If the workflow still makes sense after removing all references to other evaluation tools, it is lightweight enough.

If the starter runner is still the main source of truth after real prompts and datasets exist, the workflow is too light and needs to graduate to a project-specific evaluator.