---
name: "experimentation-loop"
description: "Run a metric-driven autonomous experimentation loop on an isolated branch. Use when a task has a measurable target (latency, bundle size, test pass-rate, build time, memory, score, accuracy) and the agent should propose changes, measure each attempt against a baseline, keep wins and revert losses, and produce a durable audit trail. Distinct from iterative-loop, which is correctness-driven."
metadata:
  author: "AgentX"
  version: "1.1.0"
  created: "2026-04-28"
  updated: "2026-05-21"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Experimentation Loop

> **Purpose**: Drive a measurable metric in a chosen direction by running many small, isolated experiments, keeping wins, and reverting losses.
> **Scope**: Branch isolation, metric definition, attempt audit trail, keep/revert decision rule.

---

## When to Use This Skill

- A target metric exists and can be measured by a deterministic command
- The desired direction is known (lower latency, higher pass-rate, smaller bundle)
- Many small attempts are likely needed
- Reverting a bad attempt is cheap (single git checkout)
- A durable record of every attempt is valuable

## When NOT to Use

- Correctness work where the goal is binary "tests pass" -- use `iterative-loop`
- Tasks without a measurable metric or a way to compute it from a single command
- Risk-bearing changes that should not auto-revert (use a normal review flow)
- Production hotfixes (use targeted change with explicit review)

## Prerequisites

- Clean working tree on a non-main branch
- A metric command that exits 0 and prints a single numeric value, OR a JSON value reachable by a fixed JSON pointer
- A baseline measurement captured before the loop starts
- Permission to commit on the experimentation branch
- The loop runner MUST record `files_changed` (modified tracked files) and `files_added` (new untracked files) per attempt; reverts without that list are forbidden

---

## Decision Tree

```
Is the goal a measurable number?
+- No -> use iterative-loop or standard workflow
- Yes
   +- Can the metric be computed by one command?
   |  +- No -> wrap it in a script that prints one number, then proceed
   |  - Yes -> proceed
   - Is each attempt cheap to revert?
      +- No -> do not auto-revert; require human gate per attempt
      - Yes -> use this loop
```

---

## Anti-Patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Running multiple changes per attempt | Cannot attribute the delta to one cause |
| Skipping the revert step | Loop accumulates noise and regressions |
| Trusting a single noisy measurement | False positive `keep` decisions pollute the branch |
| Rewriting past TSV rows | Destroys the audit trail |
| Running on `main` directly | Removes the cheap revert guarantee |
| Using a subjective metric | Loop becomes a code review, not an experiment |

---

## Done Criteria

- TSV log exists and reflects every attempt
- Summary note is current
- Branch has only `keep` commits, no abandoned dirty state
- Best metric, target, and stop reason are recorded
- Open follow-ups are linked to the originating issue
- If the durable triad is in use (see "Durable Per-Attempt Artifacts"): `run-NNNN.{json,md}` exists for every attempt, `best.json` is consistent, and `JOURNAL.md` is current
## Core Rules

- Change one hypothesis at a time.
- Record tracked and untracked paths before any revert.
- Keep only results beyond the noise threshold.
- Never clean paths not owned by the current attempt.

## Workflow

1. Measure and record the baseline.
2. Apply one narrow hypothesis and collect comparable samples.
3. Keep or revert by the declared rule and append the attempt record.
4. Stop at target, budget, or diminishing-return threshold and summarize.

## Error Handling

- Unexpected dirty path: abort automatic revert and surface it.
- Metric command failure: mark the attempt invalid without claiming a result.
- Noisy samples: increase measurement repetitions or stop.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| use destructive blanket cleanup. | Change one hypothesis at a time. |
| keep an unmeasured or statistically indistinguishable change. | Use this loop for numeric optimization with cheap scoped reverts; use the correctness loop for binary behavior and require a human gate for risky or irreversible attempts. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Loop Pattern, Attempt Log Format (TSV), Summary Note Template](references/details-loop-pattern-and-summary-note-template.md) - MUST read before work involving loop pattern, attempt log format (tsv), summary note template.
- [Durable Per-Attempt Artifacts (Recommended When Reuse Is Expected)](references/details-durable-per-attempt-artifacts-re.md) - MUST read before work involving durable per-attempt artifacts (recommended when reuse is expected).
- [Decision Rule through CLI Sketch (Optional)](references/details-decision-rule-and-cli-sketch-optional.md) - MUST read before work involving decision rule through cli sketch (optional).
