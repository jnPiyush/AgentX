#!/usr/bin/env python3
"""Run evaluation suite against multiple models and generate comparison report.

Reads model configuration from config/models.yaml (or --config), runs the same
evaluation dataset against each model, and produces a comparison report in JSON
and Markdown.

Usage:
 python run-model-comparison.py
 python run-model-comparison.py --config path/to/models.yaml --dataset evaluation/core.jsonl
 python run-model-comparison.py --results-dir evaluation/results/
 python run-model-comparison.py --results-dir evaluation/results/ --check-gates
 python run-model-comparison.py --results-dir evaluation/results/ --check-gates --fail-on-regression

Requirements:
 pip install pyyaml
 pip install agent-framework-azure-ai # only needed for --run mode
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class ModelSpec:
    """One model in the comparison matrix."""

    name: str
    deployment: str
    role: str
    provider: str = "azure"


@dataclass
class Thresholds:
    """Minimum pass criteria."""

    task_completion: float = 0.85
    coherence: float = 3.5
    relevance: float = 3.5
    format_compliance: float = 0.95
    tool_accuracy: float = 0.90
    max_latency_ms: float = 5000
    max_cost_per_1k: float = 15.0
    max_regression_pct: float = 10.0


@dataclass
class ModelResult:
    """Aggregated scores for one model."""

    name: str
    role: str
    dataset_size: int = 0
    task_completion: float = 0.0
    coherence: float = 0.0
    relevance: float = 0.0
    format_compliance: float = 0.0
    tool_accuracy: float = 0.0
    avg_latency_ms: float = 0.0
    avg_tokens: float = 0.0
    estimated_cost_per_1k: float = 0.0
    passed: bool = True
    failures: list[str] = field(default_factory=list)


def load_config(path: str) -> dict[str, Any]:
    """Load models.yaml configuration."""
    try:
        import yaml
    except ImportError:
        print("ERROR: PyYAML required. Install: pip install pyyaml", file=sys.stderr)
        sys.exit(1)

    config_path = Path(path)
    if not config_path.exists():
        print(f"ERROR: Config not found: {path}", file=sys.stderr)
        print(
            "Create config/models.yaml with model matrix. "
            "See model-change-test-automation.md",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(config_path, encoding="utf-8") as config_file:
        return yaml.safe_load(config_file)


def load_thresholds(config: dict) -> Thresholds:
    """Extract thresholds from config, with defaults."""
    raw = config.get("thresholds", {})
    return Thresholds(
        **{key: value for key, value in raw.items() if hasattr(Thresholds, key)}
    )


def load_models(config: dict) -> list[ModelSpec]:
    """Extract model specs from config."""
    models = []
    for role, spec in config.get("models", {}).items():
        models.append(
            ModelSpec(
                name=spec["name"],
                deployment=spec.get("deployment", spec["name"]),
                role=role,
                provider=spec.get("provider", "azure"),
            )
        )
    return models


def load_dataset(path: str) -> list[dict]:
    """Load JSONL evaluation dataset."""
    dataset_path = Path(path)
    if not dataset_path.exists():
        print(f"ERROR: Dataset not found: {path}", file=sys.stderr)
        sys.exit(1)

    items = []
    with open(dataset_path, encoding="utf-8") as dataset_file:
        for lineno, line in enumerate(dataset_file, 1):
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError as error:
                print(
                    f"WARNING: Invalid JSON on line {lineno}: {error}",
                    file=sys.stderr,
                )
    return items


async def run_single_model(
    model: ModelSpec,
    dataset: list[dict],
    system_prompt: str,
) -> list[dict]:
    """Run dataset through a single model. Returns per-query results."""
    try:
        from agent_framework.openai import OpenAIChatClient
    except ImportError:
        print(
            "ERROR: agent-framework not installed. "
            "Use --results-dir to compare pre-existing results.",
            file=sys.stderr,
        )
        sys.exit(1)

    client = OpenAIChatClient(
        model=model.deployment,
        api_key=os.getenv("FOUNDRY_API_KEY", ""),
        endpoint=os.getenv("FOUNDRY_ENDPOINT", ""),
    )

    results = []
    for index, item in enumerate(dataset):
        query = item.get("query", item.get("input", ""))
        start = time.perf_counter()

        try:
            response = await client.chat(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ]
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
            content = (
                response.content if hasattr(response, "content") else str(response)
            )
            tokens = (
                getattr(response, "usage", {}).get("total_tokens", 0)
                if hasattr(response, "usage")
                else 0
            )

            results.append(
                {
                    "index": index,
                    "query": query,
                    "response": content,
                    "expected": item.get("expected_response", item.get("response", "")),
                    "latency_ms": round(elapsed_ms),
                    "tokens_used": tokens,
                    "error": None,
                }
            )
        except Exception as error:
            elapsed_ms = (time.perf_counter() - start) * 1000
            results.append(
                {
                    "index": index,
                    "query": query,
                    "response": "",
                    "expected": item.get("expected_response", ""),
                    "latency_ms": round(elapsed_ms),
                    "tokens_used": 0,
                    "error": str(error),
                }
            )

        if (index + 1) % 10 == 0 or index == len(dataset) - 1:
            print(f" [{model.name}] {index + 1}/{len(dataset)} queries complete")

    return results


async def run_all_models(
    models: list[ModelSpec],
    dataset: list[dict],
    output_dir: Path,
    system_prompt: str = "You are a helpful assistant.",
) -> None:
    """Run evaluation for all models and save results."""
    output_dir.mkdir(parents=True, exist_ok=True)

    for model in models:
        print(f"\n{'=' * 60}")
        print(f" Evaluating: {model.name} ({model.role})")
        print(f"{'=' * 60}")

        results = await run_single_model(model, dataset, system_prompt)

        safe_name = model.name.replace("/", "-").replace(" ", "-")
        output_file = output_dir / f"{safe_name}.json"
        with open(output_file, "w", encoding="utf-8") as result_file:
            json.dump(
                {
                    "model": model.name,
                    "role": model.role,
                    "provider": model.provider,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "dataset_size": len(dataset),
                    "results": results,
                },
                result_file,
                indent=2,
            )
        print(f" Saved: {output_file}")


def aggregate_scores(data: dict) -> ModelResult:
    """Calculate aggregate metrics from raw per-query results."""
    results = data.get("results", [])
    total = len(results)
    if total == 0:
        return ModelResult(name=data["model"], role=data.get("role", "unknown"))

    successful = [result for result in results if not result.get("error")]
    success_count = len(successful) if successful else 1

    return ModelResult(
        name=data["model"],
        role=data.get("role", "unknown"),
        dataset_size=total,
        task_completion=round(len(successful) / total, 3),
        format_compliance=round(
            sum(
                1
                for result in successful
                if len(result.get("response", "").strip()) > 10
            )
            / success_count,
            3,
        ),
        avg_latency_ms=round(
            sum(result["latency_ms"] for result in results) / total, 1
        ),
        avg_tokens=round(
            sum(result.get("tokens_used", 0) for result in successful) / success_count,
            1,
        ),
    )


def compare_models(results_dir: str, thresholds: Thresholds) -> dict[str, Any]:
    """Load all result files and generate comparison report."""
    results_path = Path(results_dir)
    if not results_path.exists():
        print(f"ERROR: Results directory not found: {results_dir}", file=sys.stderr)
        sys.exit(1)

    result_files = list(results_path.glob("*.json"))
    if not result_files:
        print(f"ERROR: No .json result files in {results_dir}", file=sys.stderr)
        sys.exit(1)

    models: list[ModelResult] = []
    alerts: list[str] = []

    for result_file in sorted(result_files):
        with open(result_file, encoding="utf-8") as file_handle:
            data = json.load(file_handle)
        scores = aggregate_scores(data)

        checks = [
            (
                "task_completion",
                scores.task_completion,
                thresholds.task_completion,
                "min",
            ),
            (
                "format_compliance",
                scores.format_compliance,
                thresholds.format_compliance,
                "min",
            ),
            ("avg_latency_ms", scores.avg_latency_ms, thresholds.max_latency_ms, "max"),
        ]

        for metric, value, threshold, direction in checks:
            if direction == "min" and value < threshold:
                msg = (
                    f"{scores.name}: {metric} = {value:.3f} "
                    f"below threshold {threshold}"
                )
                alerts.append(msg)
                scores.failures.append(msg)
                scores.passed = False
            elif direction == "max" and value > threshold:
                msg = (
                    f"{scores.name}: {metric} = {value:.1f} "
                    f"exceeds threshold {threshold}"
                )
                alerts.append(msg)
                scores.failures.append(msg)
                scores.passed = False

        models.append(scores)

    winners = {}
    if models:
        viable = [model for model in models if model.passed] or models
        winners["task_completion"] = max(
            viable, key=lambda model: model.task_completion
        ).name
        winners["format_compliance"] = max(
            viable, key=lambda model: model.format_compliance
        ).name
        winners["latency"] = min(viable, key=lambda model: model.avg_latency_ms).name
        winners["token_efficiency"] = min(
            viable,
            key=lambda model: model.avg_tokens or float("inf"),
        ).name

    return {
        "report_id": f"compare-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "models_tested": len(models),
        "models": [asdict(model) for model in models],
        "winner_by_metric": winners,
        "alerts": alerts,
        "all_passed": all(model.passed for model in models),
    }


def generate_markdown_report(report: dict) -> str:
    """Generate human-readable Markdown comparison report."""
    lines = [
        "# Model Comparison Report",
        "",
        f"**Generated**: {report['timestamp']} ",
        f"**Report ID**: {report['report_id']} ",
        f"**Models Tested**: {report['models_tested']}",
        "",
        "## Results",
        "",
        "| Model | Role | Task Completion | Format Compliance | Avg Latency | Avg Tokens | Status |",
        "|-------|------|---------------:|------------------:|------------:|-----------:|--------|",
    ]

    for model in report["models"]:
        status = "[PASS] PASS" if model["passed"] else "[FAIL] FAIL"
        lines.append(
            f"| {model['name']} | {model['role']} | {model['task_completion']:.3f} | "
            f"{model['format_compliance']:.3f} | {model['avg_latency_ms']:.0f}ms | "
            f"{model['avg_tokens']:.0f} | {status} |"
        )

    if report.get("winner_by_metric"):
        lines.extend(["", "## Best By Metric", ""])
        for metric, winner in report["winner_by_metric"].items():
            lines.append(f"- **{metric}**: {winner}")

    if report.get("alerts"):
        lines.extend(["", "## Alerts", ""])
        for alert in report["alerts"]:
            lines.append(f"- [WARN] {alert}")

    lines.append("")
    if report["all_passed"]:
        lines.append("## Verdict: [PASS] All models meet minimum thresholds")
    else:
        failed = [model["name"] for model in report["models"] if not model["passed"]]
        lines.append(
            f"## Verdict: [FAIL] {len(failed)} model(s) failed threshold checks"
        )
        for name in failed:
            lines.append(f" - {name}")

    lines.append("")
    return "\n".join(lines)


def save_reports(report: dict, output_dir: str) -> None:
    """Save JSON and Markdown reports."""
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    json_path = output / "comparison-report.json"
    with open(json_path, "w", encoding="utf-8") as json_file:
        json.dump(report, json_file, indent=2)
    print(f" JSON report: {json_path}")

    md_path = output / "comparison-report.md"
    md_content = generate_markdown_report(report)
    with open(md_path, "w", encoding="utf-8") as markdown_file:
        markdown_file.write(md_content)
    print(f" Markdown report: {md_path}")


def print_summary(report: dict) -> None:
    """Print summary to terminal."""
    print("\n" + "=" * 60)
    print(" MODEL COMPARISON SUMMARY")
    print("=" * 60)

    for model in report["models"]:
        status = "PASS" if model["passed"] else "FAIL"
        print(f"\n [{status}] {model['name']} ({model['role']})")
        print(f" Task Completion: {model['task_completion']:.3f}")
        print(f" Format Compliance: {model['format_compliance']:.3f}")
        print(f" Avg Latency: {model['avg_latency_ms']:.0f}ms")
        print(f" Avg Tokens: {model['avg_tokens']:.0f}")
        if model["failures"]:
            for failure in model["failures"]:
                print(f" [!] {failure}")

    if report.get("alerts"):
        print(f"\n ALERTS ({len(report['alerts'])})")
        for alert in report["alerts"]:
            print(f" - {alert}")

    print("\n" + "=" * 60)
    if report["all_passed"]:
        print(" [PASS] All models meet minimum thresholds")
    else:
        print(" [FAIL] Some models failed threshold checks")
    print("=" * 60 + "\n")


def check_regression(
    report: dict,
    baseline_path: str | None,
    max_regression_pct: float,
) -> bool:
    """Check if primary model regressed from baseline. Returns True if OK."""
    if not baseline_path:
        for candidate in [
            "evaluation/baseline.json",
            "baseline.json",
            "evaluation/results/baseline.json",
        ]:
            if Path(candidate).exists():
                baseline_path = candidate
                break

    if not baseline_path or not Path(baseline_path).exists():
        print(" No baseline found - skipping regression check")
        return True

    with open(baseline_path, encoding="utf-8") as baseline_file:
        baseline = json.load(baseline_file)

    primary = next(
        (model for model in report["models"] if model["role"] == "primary"), None
    )
    if not primary:
        print(" No primary model found in results - skipping regression check")
        return True

    baseline_scores = baseline.get("scores", baseline)
    regression_found = False

    for metric in ["task_completion", "format_compliance"]:
        baseline_val = baseline_scores.get(metric, 0)
        current_val = primary.get(metric, 0)
        if baseline_val > 0:
            drop_pct = ((baseline_val - current_val) / baseline_val) * 100
            if drop_pct > max_regression_pct:
                print(
                    f" REGRESSION: {metric} dropped {drop_pct:.1f}% "
                    f"(baseline: {baseline_val:.3f} -> current: {current_val:.3f})"
                )
                regression_found = True
            else:
                print(
                    f" {metric}: {current_val:.3f} "
                    f"(baseline: {baseline_val:.3f}) - OK"
                )

    return not regression_found


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run multi-model evaluation comparison for AI agents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
 python run-model-comparison.py --config config/models.yaml --dataset evaluation/core-regression.jsonl
 python run-model-comparison.py --results-dir evaluation/results/
 python run-model-comparison.py --results-dir evaluation/results/ --check-gates --fail-on-regression
 """,
    )

    parser.add_argument(
        "--config",
        default="config/models.yaml",
        help="Path to model matrix config (default: config/models.yaml)",
    )
    parser.add_argument(
        "--dataset",
        default="evaluation/core-regression.jsonl",
        help="Path to evaluation dataset JSONL",
    )
    parser.add_argument(
        "--results-dir",
        default="evaluation/results",
        help="Directory for per-model result files",
    )
    parser.add_argument(
        "--output-dir",
        default="evaluation",
        help="Directory for comparison reports",
    )
    parser.add_argument(
        "--system-prompt", help="System prompt for the agent (or path to .txt file)"
    )
    parser.add_argument(
        "--check-gates",
        action="store_true",
        help="Check thresholds and exit with code 1 on failure",
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit 1 if primary model regressed from baseline",
    )
    parser.add_argument("--baseline", default=None, help="Path to baseline scores JSON")
    parser.add_argument(
        "--skip-eval",
        action="store_true",
        help="Skip evaluation, only compare existing results",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    exit_code = 0

    config = {}
    config_path = Path(args.config)
    if config_path.exists():
        config = load_config(args.config)
    thresholds = load_thresholds(config)

    if not args.skip_eval and config.get("models") and Path(args.dataset).exists():
        import asyncio

        models = load_models(config)
        dataset = load_dataset(args.dataset)

        system_prompt = "You are a helpful assistant."
        if args.system_prompt:
            prompt_path = Path(args.system_prompt)
            if prompt_path.exists():
                system_prompt = prompt_path.read_text(encoding="utf-8")
            else:
                system_prompt = args.system_prompt

        print(f"\nRunning evaluation: {len(models)} models {len(dataset)} queries")
        asyncio.run(
            run_all_models(
                models=models,
                dataset=dataset,
                output_dir=Path(args.results_dir),
                system_prompt=system_prompt,
            )
        )

    results_path = Path(args.results_dir)
    if results_path.exists() and list(results_path.glob("*.json")):
        print("\nGenerating comparison report...")
        report = compare_models(args.results_dir, thresholds)

        save_reports(report, args.output_dir)
        print_summary(report)

        if args.check_gates and not report["all_passed"]:
            print("GATE CHECK FAILED: Not all models meet thresholds")
            exit_code = 1

        if args.fail_on_regression:
            if not check_regression(
                report, args.baseline, thresholds.max_regression_pct
            ):
                print("REGRESSION CHECK FAILED: Primary model regressed from baseline")
                exit_code = 1
    else:
        print(f"\nNo results found in {args.results_dir}")
        print("Run with a valid --config and --dataset to generate results,")
        print("or provide --results-dir pointing to existing .json result files.")
        exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
