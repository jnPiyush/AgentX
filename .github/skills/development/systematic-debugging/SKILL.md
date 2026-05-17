---
name: systematic-debugging
description: Disciplined debugging for stalled bug fixes. Use when an Engineer or Reviewer has tried two or more fixes that did not work, when symptoms keep moving, or when the same test keeps failing for different reasons. Forces root-cause investigation, pattern analysis, hypothesis testing, and a final implementation, in that order.
---

# Systematic Debugging

> WHEN: A bug fix has failed two or more times, the same test keeps failing for different reasons, or the symptom keeps moving when fixes are applied. Also use proactively for any `type:bug` that touches more than one file or crosses a module boundary.

## When to Use This Skill

Load this skill when:

- Two or more fixes for the same bug have not held
- The failing test now fails in a different way after each attempt
- A `type:bug` issue is non-trivial (more than a single-file typo)
- A Reviewer has issued `CHANGES REQUESTED` twice on the same defect
- You feel the urge to "try one more thing" instead of investigating

Skip when:

- The bug is a single-line obvious typo with no dependencies
- The failure mode is fully understood and the fix is mechanical

## Prerequisites

- Reproduction of the bug, or a failing test that captures it
- Access to the relevant logs, stack traces, and recent commits
- Time budget; this skill is slower than guess-and-fix, on purpose

## Rationalization Table

The three-failed-fixes rule exists because LLMs and humans both reach for these instead of investigating.

| Rationalization | Reality |
|-----------------|---------|
| "Let me try one more small change, it might work." | Three failed fixes is the signal that you do not understand the bug. Stop changing code; investigate. |
| "I know what's wrong, I just need to fix it." | If you knew, the first fix would have worked. Treat the failed fixes as evidence that the model is wrong. |
| "The stack trace points right at this line." | The stack trace points at the symptom. The cause is usually somewhere else in the call graph or in state set up earlier. |
| "I'll add a try/catch and move on." | Suppressing the error does not fix the bug; it hides it. The next failure will be harder to find. |
| "This bug is too weird, I'll work around it." | Workarounds compound. The next person to hit this pays the cost. Fix the cause. |
| "It works locally, must be an environment issue." | "Works on my machine" is a hypothesis, not a conclusion. Verify the environment difference is the actual cause. |
| "I'll revert and start over with a fresh approach." | Reverting without root cause loses evidence. Investigate first, then decide whether to revert. |

## The Four Phases

These run in order. Do not skip ahead. The most common debugging failure is jumping from Phase 1 to Phase 4 without Phase 2 or 3.

### Phase 1 -- Root Cause Investigation

Goal: Replace assumptions with evidence.

- Reproduce the bug deterministically (write a failing test if one does not exist)
- Capture the exact error, stack trace, and last-known-good commit
- Read the actual code path from entry point to failure, not your mental model of it
- List every assumption you made when you wrote the fixes that did not work
- For each assumption, find evidence that confirms or refutes it

Exit Phase 1 only when you can write one sentence: "The bug happens because X, evidenced by Y."

### Phase 2 -- Pattern Analysis

Goal: Place this bug in context.

- Has this kind of bug happened in this module before? (search git log + issue tracker)
- Is the failing pattern present elsewhere in the codebase?
- Is the bug at a boundary (network, disk, concurrency, encoding, locale, timezone)?
- Does the bug appear after a recent change? (`git log -p` the relevant files)

The pattern matters because: a one-off bug gets a targeted fix; a recurring pattern gets a refactor; a boundary bug gets a contract change.

### Phase 3 -- Hypothesis and Testing

Goal: Test, do not guess.

- Form one specific hypothesis from Phase 1: "If I change X, the test will pass for reason Y."
- Predict what will happen before you change anything
- Make the smallest change that tests the hypothesis
- Run the verification command (see [Verification Before Completion](../verification-before-completion/SKILL.md))
- If the prediction was wrong, return to Phase 1 with the new evidence. Do not patch.

The three-failed-fixes rule: if three Phase-3 hypotheses in a row fail, you are in the wrong subsystem. Return to Phase 1 and broaden the search.

### Phase 4 -- Implementation

Goal: Land the fix and prevent the recurrence.

- Apply the change that the validated hypothesis required, and only that change
- Keep or add a test that fails without the fix and passes with it
- If Phase 2 found a recurring pattern, file a follow-up issue for the refactor; do not expand the current change
- Record the root cause in the issue and (if reusable) in a learning capture

## AgentX Wiring

This skill is referenced from:

- **Engineer agent** for any `type:bug` issue with more than 3 files in scope
- **Reviewer agent** when the same defect produces two or more `CHANGES REQUESTED` cycles
- **Tester agent** when a flaky test refuses to stabilize after two retries

When this skill fires, the resulting issue close comment or learning capture MUST state the root cause, the pattern (if any), and the hypothesis that the fix validated.

## Architecture Question Threshold

If three Phase-3 hypotheses have failed in a row, do not write a fourth fix. Ask: "Is the architecture wrong, not the line?"

Symptoms that say yes:

- The same data is mutated in three or more places
- A class has more reasons to change than the number of methods it has
- The failing test passes only with mocks that contradict the production behavior
- The fix requires special-casing that is invisible to callers

Either escalate to the Architect agent or open a follow-up `type:spike` to investigate the structural problem before adding more fixes.

## Error Handling

| Symptom | Action |
|---------|--------|
| Cannot reproduce the bug | Do not fix. Get a reliable reproduction first, or downgrade the issue to "needs:repro". |
| Reproduction is flaky | Treat the flakiness itself as the bug; investigate it before the original report. |
| Fix would require changes outside Engineer scope | Escalate to Architect or open a spike. Do not silently expand scope. |
| Bug is in a third-party dependency | Pin the version, file upstream, document the workaround with an expiry. |

## Checklist

Before claiming the bug is fixed:

- [ ] Reproduction or failing test exists
- [ ] Root cause is stated in one sentence with evidence
- [ ] Pattern analysis was performed (or explicitly skipped with reason)
- [ ] The hypothesis that succeeded is documented
- [ ] The fix is the minimum change that validates the hypothesis
- [ ] The verification gate (verification-before-completion) was run
- [ ] If three or more attempts failed before this fix, the issue records why the earlier attempts were wrong

## See Also

- [Verification Before Completion](../verification-before-completion/SKILL.md)
- [Error Handling](../error-handling/SKILL.md)
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md)
- [Iterative Loop](../iterative-loop/SKILL.md)