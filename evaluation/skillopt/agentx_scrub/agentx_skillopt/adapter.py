from __future__ import annotations

import json
import os
from pathlib import Path

from skillopt.datasets.base import BatchSpec, SplitDataLoader
from skillopt.envs.base import EnvAdapter


def _load_json_items(split_path: str) -> list[dict]:
    path = Path(split_path) / "items.json"
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected JSON array in {path}")
    return [dict(item) for item in payload]


class AgentXScrubLoader(SplitDataLoader):
    def load_split_items(self, split_path: str) -> list[dict]:
        return _load_json_items(split_path)


class AgentXScrubAdapter(EnvAdapter):
    def __init__(
        self,
        split_dir: str = "",
        data_path: str = "",
        split_mode: str = "split_dir",
        split_ratio: str = "2:1:7",
        split_seed: int = 42,
        split_output_dir: str = "",
        seed: int = 42,
        limit: int = 0,
        **kwargs,
    ) -> None:
        self.dataloader = AgentXScrubLoader(
            split_dir=split_dir,
            data_path=data_path,
            split_mode=split_mode,
            split_ratio=split_ratio,
            split_seed=split_seed,
            split_output_dir=split_output_dir,
            seed=seed,
            limit=limit,
        )

    def setup(self, cfg: dict) -> None:
        super().setup(cfg)
        self.dataloader.setup(cfg)

    def get_dataloader(self):
        return self.dataloader

    def build_env_from_batch(self, batch: BatchSpec, **kwargs):
        return list(batch.payload or [])

    def build_train_env(self, batch_size: int, seed: int, **kwargs):
        batch = self.dataloader.build_train_batch(
            batch_size=batch_size, seed=seed, **kwargs
        )
        return self.build_env_from_batch(batch, **kwargs)

    def build_eval_env(self, env_num: int, split: str, seed: int, **kwargs):
        batch = self.dataloader.build_eval_batch(
            env_num=env_num, split=split, seed=seed, **kwargs
        )
        return self.build_env_from_batch(batch, **kwargs)

    def rollout(
        self, env_manager, skill_content: str, out_dir: str, **kwargs
    ) -> list[dict]:
        os.makedirs(out_dir, exist_ok=True)
        lowered_skill = skill_content.lower()
        results: list[dict] = []
        for item in env_manager:
            required_terms = [str(term) for term in item.get("required_terms", [])]
            missing_terms = [
                term for term in required_terms if term.lower() not in lowered_skill
            ]
            hard = 0 if missing_terms else 1
            soft = (
                1.0
                if not required_terms
                else (len(required_terms) - len(missing_terms)) / len(required_terms)
            )
            result = {
                "id": str(item.get("id", "")),
                "task_type": str(item.get("task_type", "scrub-guidance")),
                "hard": hard,
                "soft": soft,
                "missing_terms": missing_terms,
                "expected_guidance": str(item.get("expected_guidance", "")),
                "question": str(item.get("question", "")),
                "fail_reason": (
                    "missing guidance terms: " + ", ".join(missing_terms)
                    if missing_terms
                    else ""
                ),
            }
            results.append(result)
        with open(Path(out_dir) / "results.json", "w", encoding="utf-8") as handle:
            json.dump(results, handle, indent=2)
        return results

    def reflect(
        self, results: list[dict], skill_content: str, out_dir: str, **kwargs
    ) -> list[dict | None]:
        patches: list[dict | None] = []
        for result in results:
            if result.get("hard"):
                patches.append(None)
                continue
            guidance = str(result.get("expected_guidance", "")).strip()
            if not guidance or guidance.lower() in skill_content.lower():
                patches.append(None)
                continue
            patches.append(
                {
                    "patch": {
                        "edits": [
                            {
                                "op": "append",
                                "target": "",
                                "content": guidance,
                            }
                        ]
                    },
                    "source_type": "failure",
                    "batch_size": 1,
                }
            )
        return patches

    def get_task_types(self) -> list[str]:
        return ["scrub-guidance"]
