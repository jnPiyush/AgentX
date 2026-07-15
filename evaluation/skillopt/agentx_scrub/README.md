# AgentX Scrub SkillOpt Pilot

This pilot runs SkillOpt against the AgentX scrub skill with a deterministic local adapter. It proves the SkillOpt training loop, validation gate, and output artifacts without requiring model credentials.

## What It Optimizes

- Seed skill: `.github/skills/development/scrub/SKILL.md`
- Environment: `agentx_scrub`
- Dataset: labeled guidance checks for scrub skill coverage
- Output: `runs/local-deterministic/best_skill.md`

The adapter scores a skill by checking whether it contains required guidance terms for each task. Failed tasks emit deterministic SkillOpt patch suggestions, so the normal SkillOpt rollout, reflect, aggregate, update, gate, and final test path can run locally.

## Run

```powershell
python .\evaluation\skillopt\agentx_scrub\run_skillopt_pilot.py --config .\evaluation\skillopt\agentx_scrub\config.yaml
```

## Real Model-Backed Next Step

For a real model-backed AgentX skill optimization run, replace the deterministic `reflect` implementation with `skillopt.gradient.reflect.run_minibatch_reflect`, keep the same split layout, and provide a configured backend such as Azure OpenAI, OpenAI-compatible, Anthropic, Qwen, Codex exec, or Claude Code exec.
