---
name: verification-before-completion
description: Block false completion claims. Force the agent to identify the claim, run the exact verification command, read the actual output, compare against the claim, and only then report. Use whenever an agent is about to say "done", "fixed", "tests pass", "deployed", "loop complete", or close an issue.
user-invocable: false
---

# Verification Before Completion

> WHEN: Any time the active agent is about to claim work is finished -- "done", "complete", "fixed", "tests pass", "loop complete", "ready for review", "deployed", "issue closed". The single most common AgentX failure mode is reporting completion that fresh verification would have caught.

## When to Use This Skill

Load this skill when:

- An Engineer agent is about to close an issue or run `agentx loop complete`
- A Reviewer agent is about to set `APPROVED`
- A Tester agent is about to mark a test plan green
- A DevOps agent is about to claim a deployment succeeded
- Any agent is about to report results in chat without having re-run the check on the current commit

Skip when:

- The work is purely exploratory and no completion claim is being made
- The user has explicitly asked for a partial / in-progress report

## Prerequisites

- Access to the verification surface (test runner, CLI, build, app under test, deployed URL)
- Knowledge of the exact command that proves the claim
- Current commit SHA or build identifier to anchor the evidence

## Rationalization Table

The five most common ways agents skip verification. Push back against each.

| Rationalization | Reality |
|-----------------|---------|
| "The tests passed last time I ran them, the diff is small." | A small diff is the highest-risk place to skip verification because nobody scrutinizes it. Re-run. |
| "The CI run on the previous commit was green." | Fresh commit, fresh run. The "previous commit was green" claim is the canonical false-completion pattern. |
| "I can see by reading the code that it works." | Reading the code is necessary but not sufficient. The compiler, interpreter, and runtime have rejected obviously-correct-looking code before and will again. Run it. |
| "The change is too small to break anything." | The change history of every codebase is full of one-line outages. Run the verification anyway. |
| "Running the full suite is slow, I'll trust the targeted test." | Trust nothing. Run at least the targeted test on the current commit and record the output. Run the full suite if the change crosses module boundaries. |
| "The loop iteration count is satisfied, I can mark complete." | The loop count is a floor. Completion requires the done criteria to actually pass on the current commit, not just the counter to advance. |

## Error Handling

| Symptom | Action |
|---------|--------|
| Command fails on the current commit | Do not report completion. Fix the failure, then re-run the gate. |
| Command hangs | Treat as failure. Investigate before claiming completion. |
| Command output is suspiciously fast (no tests found, cached result) | Force a clean run. `dotnet test --no-build` is not a substitute for `dotnet test`. |
| Cannot run the command locally | Run it in CI on the current commit and link the run. Do not claim completion from a prior run. |
| The claim is unprovable in the current environment | Restate the claim as "claimed but not verified in this session" and surface the gap. |

## Checklist

Before reporting completion, confirm:

- [ ] Claim is stated in one specific sentence
- [ ] Verification command was run on the current commit
- [ ] Full output was read, not skimmed
- [ ] Output matches the claim, including counts and codes
- [ ] Report cites the command, the output excerpt, and the commit SHA
- [ ] If anything in the output contradicts the claim, the claim was retracted or narrowed

## Core Rules

- Run checks against the final bytes, not an earlier iteration.
- Reproduce the original symptom or acceptance outcome directly.
- Report failures and unavailable prerequisites without softening them.

## Workflow

1. Re-read requirements and inspect the final diff.
2. Run the smallest decisive behavior check.
3. Run mandatory lint, build, security, or repository gates.
4. Confirm persistent state and summarize exact evidence.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [The Gate Function (5 Steps), AgentX Wiring, See Also](references/details-the-gate-function-5-steps-and-see-also.md) - MUST read before work involving the gate function (5 steps), agentx wiring, see also.
