from __future__ import annotations

import shutil
import sys
from pathlib import Path


def _install_prompt_fallbacks() -> None:
    import skillopt.gradient.aggregate as aggregate
    import skillopt.optimizer.clip as clip
    import skillopt.prompts as prompts

    original_load_prompt = prompts.load_prompt

    def load_prompt(name: str, env: str | None = None) -> str:
        try:
            return original_load_prompt(name, env=env)
        except FileNotFoundError:
            return (
                "Merge or rank SkillOpt patch JSON conservatively. "
                "Return valid JSON with an edits array and preserve all concrete edits."
            )

    prompts.load_prompt = load_prompt
    aggregate.load_prompt = load_prompt
    clip.load_prompt = load_prompt

    def chat_optimizer(system: str, user: str, **kwargs) -> tuple[str, dict]:
        raise RuntimeError(
            "deterministic SkillOpt pilot disables optimizer model calls"
        )

    aggregate.chat_optimizer = chat_optimizer
    clip.chat_optimizer = chat_optimizer


def _extract_config_path(args: list[str], default_config: Path) -> Path:
    for index, arg in enumerate(args):
        if arg == "--config" and index + 1 < len(args):
            return Path(args[index + 1])
    return default_config


def _clean_default_run(config_path: Path, repo_root: Path, args: list[str]) -> None:
    if "--resume" in args:
        args.remove("--resume")
        return
    import yaml

    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    out_root = (((config.get("env") or {}).get("out_root")) or "").strip()
    if not out_root:
        return
    out_path = (repo_root / out_root).resolve()
    runs_root = (
        repo_root / "evaluation" / "skillopt" / "agentx_scrub" / "runs"
    ).resolve()
    if runs_root in out_path.parents and out_path.exists():
        shutil.rmtree(out_path)


def main() -> None:
    pilot_root = Path(__file__).resolve().parent
    repo_root = pilot_root.parents[2]
    if str(pilot_root) not in sys.path:
        sys.path.insert(0, str(pilot_root))

    from agentx_skillopt.adapter import AgentXScrubAdapter
    import scripts.train as skillopt_train

    _install_prompt_fallbacks()
    skillopt_train._ENV_REGISTRY["agentx_scrub"] = AgentXScrubAdapter
    if not any(arg == "--config" for arg in sys.argv[1:]):
        sys.argv.extend(["--config", str(pilot_root / "config.yaml")])
    config_path = _extract_config_path(sys.argv[1:], pilot_root / "config.yaml")
    _clean_default_run(config_path, repo_root, sys.argv)
    if Path.cwd().resolve() != repo_root:
        print(f"[WARN] Run from repo root for relative config paths: {repo_root}")
    skillopt_train.main()


if __name__ == "__main__":
    main()
