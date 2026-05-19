# Contract Harness Pilot And Pruning Guide

This guide defines how AgentX should pilot the contract-driven harness flow and decide what to keep, simplify, or remove after real usage evidence is collected.

## Recommended Pilot Path

Start with one bounded story that has all of the following properties:

- clear issue scope
- an execution plan and progress log already present
- at least one bounded work contract
- at least one evidence summary
- workflow guidance visible in the extension

Recommended first pilot:

- a `type:story` implementation slice with one active harness thread, one active contract, and one reviewer-visible evidence summary

## Pilot Questions

During the pilot, collect answers to these questions:

1. Did the bounded contract reduce scope drift?
2. Did the evidence summary improve review clarity?
3. Did shared workflow guidance make the next action obvious?
4. Did any runtime field or document section go unused?
5. Did any operator step feel duplicative with another artifact?

## Pruning Rubric

### Keep

Keep a control when:

- it changes operator behavior in a useful way
- it makes review or recovery materially easier
- it is reused across multiple slices without custom explanation

### Simplify

Simplify a control when:

- it is useful but carries too much ceremony
- multiple fields capture the same decision or state
- operators repeatedly infer the same information from different artifacts

### Remove

Remove a control when:

- it is rarely populated or never consulted
- it duplicates another durable artifact without adding signal
- the pilot shows the runtime or review surface works equally well without it

## Feedback Loop

After each pilot pass:

1. Record what helped and what did not.
2. Update the relevant execution or workflow guide first.
3. Create runtime follow-on work only when the pilot exposed a real repeated friction point.
4. Link the finding back to the pilot issue and changed guide or runtime surface.

## Minimum Outcome

The pilot should produce enough evidence to classify each new control as:

- keep
- simplify
- remove

If the pilot cannot justify a control from real operator or review value, that control should not be allowed to linger by default.