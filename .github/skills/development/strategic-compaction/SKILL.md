---
name: "strategic-compaction"
description: "Decide when to compact, reset, or continue a long-running agent session. Use when context pressure rises, when a checkpoint boundary is reached, or when a clean handoff to a different agent is needed. Encodes the rule that compaction is safe between phases but dangerous mid-implementation, and that reset beats compaction once durable artifacts diverge from the chat transcript."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-17"
  updated: "2026-05-17"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Strategic Compaction

> **Purpose**: Choose between continue, compact, and reset without losing work or fabricating context.
> **Scope**: Long-running sessions, checkpoint transitions, agent handoffs, token-pressure events.

---

## When to Use This Skill

- Token budget is approaching the provider's compaction trigger.
- A workflow checkpoint just changed (Plan -> Work, Work -> Review, Review -> Compound Capture).
- The user explicitly says "compact", "reset", "start over", or "switch agent".
- The chat transcript and the repo state have begun to disagree.

## When NOT to Use

- Mid-implementation, halfway through editing a file. Finish the bounded slice first.
- During an active validation run (tests executing, command in flight).
- Inside a self-review iteration where the next step is already queued.

## Decision Order

Try these in order. Pick the first one whose preconditions hold.

1. **Continue in place** when the active issue, plan, slice, and blocker state are still coherent and the budget will hold for at least one more bounded step.
2. **Compact** when the work is still coherent but token pressure is the main constraint, and a durable plan + progress log already record the state.
3. **Reset** when continuing would rely on stale chat state or conflicting assumptions instead of durable artifacts.

If you cannot reconstruct the active slice, blocker, and next action from durable artifacts, prefer reset over compaction. A compaction that summarizes a confused state preserves the confusion.

## Compaction Pre-Conditions

Do not compact unless ALL of these are true:

- [ ] Active issue number is recorded in `.agentx/state/loop-state.json` or equivalent.
- [ ] Active execution plan exists under `docs/execution/plans/` and reflects the current state.
- [ ] Active bounded contract (if any) is in `Active` or `Complete` status, not `Proposed`.
- [ ] Recent verification evidence is linked from the plan or progress log.
- [ ] No tool call is in flight.

If any item is false, write the missing artifact first, THEN compact.

## Anti-Patterns to Reject

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Compact mid-edit to "free up budget" | The edit state is in the transcript, not yet on disk. Compaction loses it. |
| Compact before reading the spec | The summary will record "spec not yet read" forever. Read first, then compact. |
| Reset without writing the open decisions to a plan | The next session boots blind. |
| Use compaction as a substitute for an execution plan | The summary is volatile; the plan is durable. Compaction is not memory. |
| Compact every N turns on a fixed schedule | Schedule-driven compaction interrupts active slices and loses work. |

## Self-Check Before Compacting

- [ ] Plan, progress, and any active contract are current
- [ ] Verification evidence for the current slice is recorded
- [ ] No tool call is mid-flight
- [ ] The summary I am about to produce can boot the next session by itself
- [ ] If any of the above is false, I will write the missing artifact FIRST

---

**See Also**: [context-management](../../ai-systems/context-management/SKILL.md) | [iterative-loop](../iterative-loop/SKILL.md) | [verification-before-completion](../verification-before-completion/SKILL.md) | [docs/guides/RESET-VS-COMPACTION-POLICY.md](../../../../docs/guides/RESET-VS-COMPACTION-POLICY.md)

## Prerequisites

Know the model context limit, current token estimate, unresolved work, tool results, file ownership, and a durable checkpoint destination.

## Core Rules

- Never compact system instructions, active user constraints, unresolved decisions, or exact failure evidence.
- Retain file paths, commands, outputs, ownership, and next actions.
- Treat provider limits as runtime facts, not guessed constants.

## Workflow

1. Estimate remaining headroom and identify completed segments.
2. Write a structured checkpoint of facts and open state.
3. Compact only eligible history and verify retained constraints.
4. Reset only after the checkpoint is durable and resumable.

## Error Handling

- Unknown context limit: use the host-reported value or stop claiming safety.
- Missing checkpoint: do not reset.
- Lost dependency or evidence: restore from the source transcript before continuing.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| summarize away exact commands or unresolved errors. | Never compact system instructions, active user constraints, unresolved decisions, or exact failure evidence. |
| reset context merely because a conversation is long. | Drop redundant chatter first, summarize completed work second, checkpoint before reset, and reset only when compaction cannot preserve adequate working headroom. |

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Checkpoint Heuristics through Integration With AgentX](references/details-checkpoint-heuristics-and-integration-with-agentx.md) - MUST read before work involving checkpoint heuristics through integration with agentx.
