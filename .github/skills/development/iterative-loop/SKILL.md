---
name: "iterative-loop"
description: 'Implement Ralph Loop iterative refinement for AI agent tasks. Use when a task needs multiple passes to reach quality: TDD red-green-refactor cycles, incremental feature building, self-correcting code generation, or any work with verifiable completion criteria. Covers loop setup, completion promises, progress tracking, and escape hatches.'
user-invocable: false
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-24"
  updated: "2026-02-24"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Iterative Loop (Ralph Loop)

Use the CLI's verification gate for iterative refinement, not self-certification.

## When to Use This Skill

- Work needing several passes to a verifiable done state: TDD red-green-
  refactor, lint/build fixes, phased builds, or a mandatory adversarial pass
  on high-risk changes.
- Trivial edits use the standard one-pass loop, not elaborate patterns.
  Mandatory verification still applies.

## Prerequisites

- AgentX CLI available (`.agentx/agentx.ps1` or `.agentx/agentx.sh`; both
  delegate to `agentx-cli.ps1` with identical flags).
- A completion criterion a command can verify, set before `loop start`.

## Decision Tree

Route by what proves "done": failing tests -> TDD loop; a lint/build command
-> Quality loop; sequential milestones -> Phased loop. Any high-risk surface
(security, auth, secrets, payments, migrations, production, release) adds a
mandatory Adversarial pass before the final review iteration.

```
Verifiable criterion exists?
+- No -> define a criterion before claiming verified completion
+- Tests exist/writable  -> TDD Loop
+- Lint/build command    -> Quality Loop
+- Sequential milestones -> Phased Loop
+- High-risk surface     -> add Adversarial Loop before final review
```

## Core Rules

- The CLI is the gate, not agent judgment: `loop complete` re-validates
  the baseline against the recorded SHA-256.
- Minimum iterations are a floor by task class, never a ceiling: standard=1,
  auto-fix-review=2, complex-delivery/agent-x=3, high-risk=5. Pass
  `-r <role>` to record the role; check the printed class and minimum.
- `loop complete` needs a subagent review on the FINAL iteration:
  `--verdict approved --reviewer <id> --high 0 --medium 0`; any HIGH/MEDIUM,
  or later work, blocks completion.
- After `loop baseline -c <count>`, `loop iterate`/`loop complete` require
  `--passing <count>` and reject any regression below it.
- Every iteration after the first needs a fresh, existing evidence file; a
  stale or reused artifact is rejected (SHA-256 + freshness).
- Run `agentx doc-drift check` before final review; record
  `documentationReview` (status, rationale, reviewed hashes) in the report.

## Workflow

1. Reuse the active task's loop. Otherwise start with
   `.agentx/agentx.ps1 loop start -p "<task>" -m <max> -c "<criteria>"
   -i <issue>`; delegated workers must not reset the parent's loop.
2. Record `loop baseline -c <count>` once real tests exist.
3. Work, then `loop iterate -s "<summary>" -e <evidence-file>
   --passing <count>` after each verified fix/check cycle.
4. On a high-risk surface, run the applicable adversarial technique
   (property test, mutation run, fuzzing, boundary/failure injection) as
   its own iteration before review.
5. To redo a reviewed iteration: `loop rollback -n <target> -r "<reason>"`.
6. Record the reviewer pass: `loop iterate -s "Subagent Review: <outcome>"
   -e <review-evidence> --verdict approved --reviewer <id> --high 0
   --medium 0 --low <n>`. For code, evidence is a
   [code-quality](../../../../evaluation/rubrics/code-quality.md) v2.1 report
   with `documentationReview` and current file hashes.
7. `loop complete -s "<summary>" -e <final-evidence> --passing <count>`
   only once every gate above passes.

## Checklist

- [ ] Completion criterion is binary and command-verifiable.
- [ ] Minimum iterations for the task class are met (floor, not target).
- [ ] Every iteration after #1 has a fresh, existing evidence artifact.
- [ ] High-risk changes carry a completed adversarial pass before review.
- [ ] `agentx doc-drift check` ran; `documentationReview` is in the report.
- [ ] Final verdict is `approved`, zero HIGH/MEDIUM, on the last work
      iteration, backed by a fresh v2.1 report.
- [ ] `loop complete` succeeded this session before claiming done.

## Error Handling

- Missing, stale, or reused evidence is rejected; regenerate the artifact
  so it reflects the current state.
- `--passing` below the recorded baseline fails closed; fix the
  regression, do not lower the baseline.
- At `maxIterations`, report blockers. A restart must retain the task's
  carried-over code scope; do not hide edits by resetting the baseline.
- A `changes-requested` verdict, or any HIGH/MEDIUM count, blocks `loop
  complete`; fix findings and re-verify from step 1.
- No progress after 3+ iterations: document the blocker and approaches
  tried instead of repeating the same failed fix.
- Emergency exit: `loop cancel` clears the active state and logs why.

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Small change, skip the loop." | Costs seconds; forces the verification step models habitually skip. |
| "First attempt looks right, done." | Models over-rate first attempts; verify before claiming done. |
| "Hit the minimum count, done." | The minimum is a floor; needs done criteria AND an approved review. |

## Agent Value

The CLI binds verification, scope and independent review to the final files.
Free-text self-review cannot substitute for those checks.

## References

- [Shared loop and review contract](../../../AGENT-PROTOCOL.md#1-iterative-quality-loop-mandatory-no-skip)
- [Loop pattern templates](references/loop-patterns.md)
- [Code-quality rubric v2.1](../../../../evaluation/rubrics/code-quality.md)
- [Prompt Engineering Skill](../../ai-systems/prompt-engineering/SKILL.md)
