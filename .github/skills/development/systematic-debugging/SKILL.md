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

## Core Rules

- Change no production behavior before reproducing the symptom.
- Prefer instrumentation and binary narrowing over speculative edits.
- Separate root cause from nearby architectural concerns.

## Workflow

1. Reproduce and preserve the failure evidence.
2. Trace inputs and outputs across the smallest suspect boundary.
3. Design a discriminating experiment for one hypothesis.
4. Fix the proven cause and rerun regression plus surrounding checks.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [The Four Phases, AgentX Wiring, See Also](references/details-the-four-phases-and-see-also.md) - MUST read before work involving the four phases, agentx wiring, see also.
