# Evaluation Assets

This directory holds lightweight, repo-local evaluation artifacts for AI work.

## Goals

- Keep evaluation evidence versioned and reviewable.
- Separate prompt assets, datasets, rubrics, baselines, and reports.
- Support AgentX workflows without copying an external product's configuration surface.

## Files

- `agentx.eval.yaml`: compact evaluation contract for the current project.
- `baseline.json`: accepted reference scores for regression comparison.
- `datasets/`: benchmark, regression, and adversarial inputs.
- `rubrics/`: judge criteria and scoring guidance.
- `../scripts/run-ai-eval-sample.ps1`: lightweight local evaluator for the issue-classification example prompt and dataset.
- `rubrics/code-quality.md`: mandatory implementation-review rubric, enforced by `../scripts/score-code-quality.ps1` during quality-loop completion.

## Usage

1. Update prompts under `prompts/`.
2. Update datasets or rubrics if the task changed.
3. Run evaluation using your chosen local or managed workflow.
4. Record normalized outputs under `.copilot-tracking/eval-reports/`.
5. Promote `baseline.json` only after review.

For implementation work, run `pwsh scripts/score-code-quality.ps1 -Mode Scope
-Json` after the final code edit. The independent reviewer writes the rubric JSON
report and `loop complete` validates it automatically. Docs-only and test-only
changes skip this gate.

## Starter Behavior

The default manifest is wired to `scripts/run-ai-eval-sample.ps1`.

- It is intentionally lightweight.
- It evaluates one concrete AgentX example: classifying work into the right `type:*` label.
- It uses a deterministic local heuristic as a baseline runner, which keeps the example runnable without external model dependencies.
- It should be replaced or extended when a project has a real model-backed evaluation path.