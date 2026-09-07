# systematic-debugging: The Four Phases, AgentX Wiring, See Also

> MUST read before work involving **the four phases, agentx wiring, see also**. This reference preserves complete source guidance relocated for context-budget compliance.

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
- Run the verification command (see [Verification Before Completion](../../verification-before-completion/SKILL.md))
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

## See Also

- [Verification Before Completion](../../verification-before-completion/SKILL.md)
- [Error Handling](../../error-handling/SKILL.md)
- [Karpathy Guidelines](../../karpathy-guidelines/SKILL.md)
- [Iterative Loop](../../iterative-loop/SKILL.md)