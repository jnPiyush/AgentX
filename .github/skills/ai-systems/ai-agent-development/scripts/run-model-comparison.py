#!/usr/bin/env python3
"""Run evaluation suite against multiple models and generate comparison report.

Reads model configuration from config/models.yaml (or --config),
runs the same evaluation dataset against each model, and produces
a comparison report in JSON and Markdown.

Usage:
 # Run full comparison
 python run-model-comparison.py

 # Custom config + dataset
 python run-model-comparison.py --config path/to/models.yaml --dataset evaluation/core.jsonl

 # Compare from pre-existing result files (skip eval, just compare)
 python run-model-comparison.py --results-dir evaluation/results/

 # Gate check only (exit 1 if any model fails thresholds)
 python run-model-comparison.py --results-dir evaluation/results/ --check-gates

 # Fail CI if primary model regressed from baseline
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

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ModelSpec:
 """One model in the comparison matrix."""
 name: str
 deployment: str
 role: str # primary | challenger | fallback | budget | reasoning
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

# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

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
 print("Create config/models.yaml with model matrix. See model-change-test-automation.md", file=sys.stderr)
 sys.exit(1)

 with open(config_path) as f:
 return yaml.safe_load(f)

def load_thresholds(config: dict) -> Thresholds:
 """Extract thresholds from config, with sensible defaults."""
 raw = config.get("thresholds", {})
 return Thresholds(**{k: v for k, v in raw.items() if hasattr(Thresholds, k)})

def load_models(config: dict) -> list[ModelSpec]:
 """Extract model specs from config."""
 models = []
 for role, spec in config.get("models", {}).items():
 models.append(ModelSpec(
 name=spec["name"],
 deployment=spec.get("deployment", spec["name"]),
 role=role,
 provider=spec.get("provider", "azure"),
 ))
 return models

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

def load_dataset(path: str) -> list[dict]:
 """Load JSONL evaluation dataset."""
 dataset_path = Path(path)
 if not dataset_path.exists():
 print(f"ERROR: Dataset not found: {path}", file=sys.stderr)
 sys.exit(1)

 items = []
 with open(dataset_path, encoding="utf-8") as f:
 for lineno, line in enumerate(f, 1):
 line = line.strip()
 if not line:
 continue
 try:
 items.append(json.loads(line))
 except json.JSONDecodeError as e:
 print(f"WARNING: Invalid JSON on line {lineno}: {e}", file=sys.stderr)
 return items

# ---------------------------------------------------------------------------
# Evaluation runner (requires agent-framework)
# ---------------------------------------------------------------------------

async def run_single_model(
 model: ModelSpec,
 dataset: list[dict],
 system_prompt: str,
) -> list[dict]:
 """Run dataset through a single model. Returns per-query results."""
 try:
 from agent_framework.openai import OpenAIChatClient
 except ImportError:
 print("ERROR: agent-framework not installed. Use --results-dir to compare pre-existing results.", file=sys.stderr)
 sys.exit(1)

 client = OpenAIChatClient(
 model=model.deployment,
 api_key=os.getenv("FOUNDRY_API_KEY", ""),
 endpoint=os.getenv("FOUNDRY_ENDPOINT", ""),
 )

 results = []
 for i, item in enumerate(dataset):
 query = item.get("query", item.get("input", ""))
 start = time.perf_counter()

 try:
 response = await client.chat(
 messages=[
 {"role": "system", "content": system_prompt},
 {"role": "user", "content": query},
 ],
 )
 elapsed_ms = (time.perf_counter() - start) * 1000
 content = response.content if hasattr(response, "content") else str(response)
 tokens = getattr(response, "usage", {}).get("total_tokens", 0) if hasattr(response, "usage") else 0

 results.append({
 "index": i,
 "query": query,
 "response": content,
 "expected": item.get("expected_response", item.get("response", "")),
 "latency_ms": round(elapsed_ms),
 "tokens_used": tokens,
 "error": None,
 })
 except Exception as e:
 elapsed_ms = (time.perf_counter() - start) * 1000
 results.append({
 "index": i,
 "query": query,
 "response": "",
 "expected": item.get("expected_response", ""),
 "latency_ms": round(elapsed_ms),
 "tokens_used": 0,
 "error": str(e),
 })

 # Progress
 if (i + 1) % 10 == 0 or i == len(dataset) - 1:
 print(f" [{model.name}] {i + 1}/{len(dataset)} queries complete")

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
 print(f"\n{'='*60}")
 print(f" Evaluating: {model.name} ({model.role})")
 print(f"{'='*60}")

 results = await run_single_model(model, dataset, system_prompt)

 # Save results
 safe_name = model.name.replace("/", "-").replace(" ", "-")
 output_file = output_dir / f"{safe_name}.json"
 with open(output_file, "w", encoding="utf-8") as f:
 json.dump({
 "model": model.name,
 "role": model.role,
 "provider": model.provider,
 "timestamp": datetime.now(timezone.utc).isoformat(),
 "dataset_size": len(dataset),
 "results": results,
 }, f, indent=2)
 print(f" Saved: {output_file}")

# ---------------------------------------------------------------------------
# Comparison engine
# ---------------------------------------------------------------------------

def aggregate_scores(data: dict) -> ModelResult:
 """Calculate aggregate metrics from raw per-query results."""
 results = data.get("results", [])
 n = len(results)
 if n == 0:
 return ModelResult(name=data["model"], role=data.get("role", "unknown"))

 errors = [r for r in results if r.get("error")]
 successful = [r for r in results if not r.get("error")]
 s = len(successful) if successful else 1 # avoid division by zero

 return ModelResult(
 name=data["model"],
 role=data.get("role", "unknown"),
 dataset_size=n,
 # Task completion = % of queries that got a non-empty, non-error response
 task_completion=round(len(successful) / n, 3),
 # Format compliance = % of responses that are valid (non-empty)
 format_compliance=round(
 sum(1 for r in successful if len(r.get("response", "").strip()) > 10) / s, 3
 ),
 avg_latency_ms=round(sum(r["latency_ms"] for r in results) / n, 1),
 avg_tokens=round(sum(r.get("tokens_used", 0) for r in successful) / s, 1),
 )

def compare_models(
 results_dir: str,
 thresholds: Thresholds,
) -> dict[str, Any]:
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
 with open(result_file, encoding="utf-8") as f:
 data = json.load(f)
 scores = aggregate_scores(data)

 # Check thresholds
 checks = [
 ("task_completion", scores.task_completion, thresholds.task_completion, "min"),
 ("format_compliance", scores.format_compliance, thresholds.format_compliance, "min"),
 ("avg_latency_ms", scores.avg_latency_ms, thresholds.max_latency_ms, "max"),
 ]

 for metric, value, threshold, direction in checks:
 if direction == "min" and value < threshold:
 msg = f"{scores.name}: {metric} = {value:.3f} below threshold {threshold}"
 alerts.append(msg)
 scores.failures.append(msg)
 scores.passed = False
 elif direction == "max" and value > threshold:
 msg = f"{scores.name}: {metric} = {value:.1f} exceeds threshold {threshold}"
 alerts.append(msg)
 scores.failures.append(msg)
 scores.passed = False

 models.append(scores)

 # Determine winners
 winners = {}
 if models:
 viable = [m for m in models if m.passed] or models
 winners["task_completion"] = max(viable, key=lambda m: m.task_completion).name
 winners["format_compliance"] = max(viable, key=lambda m: m.format_compliance).name
 winners["latency"] = min(viable, key=lambda m: m.avg_latency_ms).name
 winners["token_efficiency"] = min(viable, key=lambda m: m.avg_tokens or float("inf")).name

 report = {
 "report_id": f"compare-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
 "timestamp": datetime.now(timezone.utc).isoformat(),
 "models_tested": len(models),
 "models": [asdict(m) for m in models],
 "winner_by_metric": winners,
 "alerts": alerts,
 "all_passed": all(m.passed for m in models),
 }

 return report

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def generate_markdown_report(report: dict) -> str:
 """Generate human-readable Markdown comparison report."""
 lines = [
 "# Model Comparison Report",
 "",
 f"**Generated**: {report['timestamp']} ",
 f"**Report ID**: {report['report_id']} ",
 f"**Models Tested**: {report['models_tested']}",
 "",
 ]

 # Summary table
 lines.append("## Results")
 lines.append("")
 lines.append("| Model | Role | Task Completion | Format Compliance | Avg Latency | Avg Tokens | Status |")
 lines.append("|-------|------|---------------:|------------------:|------------:|-----------:|--------|")

 for m in report["models"]:
 status = "[PASS] PASS" if m["passed"] else "[FAIL] FAIL"
 lines.append(
 f"| {m['name']} | {m['role']} | {m['task_completion']:.3f} | "
 f"{m['format_compliance']:.3f} | {m['avg_latency_ms']:.0f}ms | "
 f"{m['avg_tokens']:.0f} | {status} |"
 )

 # Winners
 if report.get("winner_by_metric"):
 lines.append("")
 lines.append("## Best By Metric")
 lines.append("")
 for metric, winner in report["winner_by_metric"].items():
 lines.append(f"- **{metric}**: {winner}")

 # Alerts
 if report.get("alerts"):
 lines.append("")
 lines.append("## Alerts")
 lines.append("")
 for alert in report["alerts"]:
 lines.append(f"- [WARN] {alert}")

 # Overall
 lines.append("")
 if report["all_passed"]:
 lines.append("## Verdict: [PASS] All models meet minimum thresholds")
 else:
 failed = [m["name"] for m in report["models"] if not m["passed"]]
 lines.append(f"## Verdict: [FAIL] {len(failed)} model(s) failed threshold checks")
 for name in failed:
 lines.append(f" - {name}")

 lines.append("")
 return "\n".join(lines)

def save_reports(report: dict, output_dir: str) -> None:
 """Save JSON and Markdown reports."""
 output = Path(output_dir)
 output.mkdir(parents=True, exist_ok=True)

 # JSON report
 json_path = output / "comparison-report.json"
 with open(json_path, "w", encoding="utf-8") as f:
 json.dump(report, f, indent=2)
 print(f" JSON report: {json_path}")

 # Markdown report
 md_path = output / "comparison-report.md"
 md_content = generate_markdown_report(report)
 with open(md_path, "w", encoding="utf-8") as f:
 f.write(md_content)
 print(f" Markdown report: {md_path}")

def print_summary(report: dict) -> None:
 """Print colored summary to terminal."""
 print("\n" + "=" * 60)
 print(" MODEL COMPARISON SUMMARY")
 print("=" * 60)

 for m in report["models"]:
 status = "PASS" if m["passed"] else "FAIL"
 print(f"\n [{status}] {m['name']} ({m['role']})")
 print(f" Task Completion: {m['task_completion']:.3f}")
 print(f" Format Compliance: {m['format_compliance']:.3f}")
 print(f" Avg Latency: {m['avg_latency_ms']:.0f}ms")
 print(f" Avg Tokens: {m['avg_tokens']:.0f}")
 if m["failures"]:
 for fail in m["failures"]:
 print(f" [!] {fail}")

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

# ---------------------------------------------------------------------------
# Regression check
# ---------------------------------------------------------------------------

def check_regression(report: dict, baseline_path: str | None, max_regression_pct: float) -> bool:
 """Check if primary model regressed from baseline. Returns True if OK."""
 if not baseline_path:
 # Try default location
 candidates = [
 "evaluation/baseline.json",
 "baseline.json",
 "evaluation/results/baseline.json",
 ]
 for candidate in candidates:
 if Path(candidate).exists():
 baseline_path = candidate
 break

 if not baseline_path or not Path(baseline_path).exists():
 print(" No baseline found - skipping regression check")
 return True

 with open(baseline_path, encoding="utf-8") as f:
 baseline = json.load(f)

 # Find primary model in current results
 primary = next((m for m in report["models"] if m["role"] == "primary"), None)
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
 print(f" REGRESSION: {metric} dropped {drop_pct:.1f}% "
 f"(baseline: {baseline_val:.3f} -> current: {current_val:.3f})")
 regression_found = True
 else:
 print(f" {metric}: {current_val:.3f} (baseline: {baseline_val:.3f}) - OK")

 return not regression_found

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
 parser = argparse.ArgumentParser(
 description="Run multi-model evaluation comparison for AI agents",
 formatter_class=argparse.RawDescriptionHelpFormatter,
 epilog="""
Examples:
 # Run full comparison using config
 python run-model-comparison.py --config config/models.yaml --dataset evaluation/core-regression.jsonl

 # Compare from pre-existing result files
 python run-model-comparison.py --results-dir evaluation/results/

 # CI gate check
 python run-model-comparison.py --results-dir evaluation/results/ --check-gates --fail-on-regression
 """,
 )

 parser.add_argument("--config", default="config/models.yaml",
 help="Path to model matrix config (default: config/models.yaml)")
 parser.add_argument("--dataset", default="evaluation/core-regression.jsonl",
 help="Path to evaluation dataset JSONL")
 parser.add_argument("--results-dir", default="evaluation/results",
 help="Directory for per-model result files")
 parser.add_argument("--output-dir", default="evaluation",
 help="Directory for comparison reports")
 parser.add_argument("--system-prompt",
 help="System prompt for the agent (or path to .txt file)")
 parser.add_argument("--check-gates", action="store_true",
 help="Check thresholds and exit with code 1 on failure")
 parser.add_argument("--fail-on-regression", action="store_true",
 help="Exit 1 if primary model regressed from baseline")
 parser.add_argument("--baseline", default=None,
 help="Path to baseline scores JSON")
 parser.add_argument("--skip-eval", action="store_true",
 help="Skip evaluation, only compare existing results")

 return parser.parse_args()

def main() -> int:
 args = parse_args()
 exit_code = 0

 # Load config for thresholds
 config = {}
 config_path = Path(args.config)
 if config_path.exists():
 config = load_config(args.config)
 thresholds = load_thresholds(config)

 # Step 1: Run evaluations (unless --skip-eval or --results-dir only)
 if not args.skip_eval and config.get("models") and Path(args.dataset).exists():
 import asyncio
 models = load_models(config)
 dataset = load_dataset(args.dataset)

 # Load system prompt
 system_prompt = "You are a helpful assistant."
 if args.system_prompt:
 sp_path = Path(args.system_prompt)
 if sp_path.exists():
 system_prompt = sp_path.read_text(encoding="utf-8")
 else:
 system_prompt = args.system_prompt

 print(f"\nRunning evaluation: {len(models)} models {len(dataset)} queries")
 asyncio.run(run_all_models(
 models=models,
 dataset=dataset,
 output_dir=Path(args.results_dir),
 system_prompt=system_prompt,
 ))

 # Step 2: Compare results
 results_path = Path(args.results_dir)
 if results_path.exists() and list(results_path.glob("*.json")):
 print("\nGenerating comparison report...")
 report = compare_models(args.results_dir, thresholds)

 # Save reports
 save_reports(report, args.output_dir)
 print_summary(report)

 # Gate check
 if args.check_gates and not report["all_passed"]:
 print("GATE CHECK FAILED: Not all models meet thresholds")
 exit_code = 1

 # Regression check
 if args.fail_on_regression:
 if not check_regression(report, args.baseline, thresholds.max_regression_pct):
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
