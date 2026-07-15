# AgentX Scrub SkillOpt Pilot Report

## Claim

SkillOpt was installed and run locally against the AgentX scrub skill through a deterministic `agentx_scrub` benchmark adapter.

## Command

```powershell
python .\evaluation\skillopt\agentx_scrub\run_skillopt_pilot.py --config .\evaluation\skillopt\agentx_scrub\config.yaml
```

The wrapper deletes the configured local run directory before each run. Pass `--resume` to keep SkillOpt's native resume behavior for the same output root.

## Result

- Seed skill: `.github/skills/development/scrub/SKILL.md`
- Output root: `evaluation/skillopt/agentx_scrub/runs/local-deterministic`
- Baseline selection score: `0.0000`
- Candidate selection score: `1.0000`
- Gate action: `accept_new_best`
- Held-out test score: `0.0000 -> 1.0000`
- Token calls: `0`; no model backend credentials were used

## Generated Artifacts

- `runs/local-deterministic/best_skill.md`: accepted SkillOpt candidate skill
- `runs/local-deterministic/history.json`: step-level rollout, patch, gate, and score history
- `runs/local-deterministic/runtime_state.json`: resume state showing `best_step = 1`
- `runs/local-deterministic/summary.json`: final score summary
- `runs/local-deterministic/config.json`: resolved runtime configuration

## Proposed Skill Changes

The accepted candidate appends two guidance points to the scrub skill:

- Mention PowerShell block comments (`<# ... #>`) as a dead-code surface.
- Guard duplicate-logic findings against string-only declarative lists to avoid false positives on repeated configuration/data arrays.

These changes are staged in `best_skill.md` only. The production scrub skill was not overwritten.

## Constraints

The installed PyPI wheel did not include generic prompt markdown files under `skillopt/prompts/`. The pilot wrapper installs local prompt and chat fallbacks before calling SkillOpt so the deterministic adapter can exercise the training loop without mutating the installed package or calling a model backend.

The held-out split checks different wording for the same two guidance concepts. It proves the SkillOpt loop can improve this local benchmark, not that the generated wording is production-ready without human review.

For a true model-backed SkillOpt run, configure a backend and replace the deterministic `reflect` method with SkillOpt's `run_minibatch_reflect`.
