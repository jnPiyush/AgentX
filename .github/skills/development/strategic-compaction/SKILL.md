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

## Checkpoint Heuristics

| Checkpoint Transition | Safe to compact? | Why |
|-----------------------|------------------|-----|
| `Brainstorm -> Plan` | Yes | Plan is the durable artifact; transcript can be summarized. |
| `Plan -> Work` | Yes, after research | Compact AFTER you have read the spec, BEFORE you start editing. |
| Mid-Work, mid-file-edit | No | Implementation context is in the head, not yet in any artifact. Finish the slice. |
| Mid-Work, between bounded slices | Yes | Slice contract and evidence summary carry state across the boundary. |
| `Work -> Review` | Yes | Diff, tests, and evidence summary are durable. |
| `Review -> Compound Capture` | Yes | Review artifact + findings file carry the state. |
| Inside an active retry / pivot decision | No | The decision rationale only lives in the transcript right now. |

## Compaction Pre-Conditions

Do not compact unless ALL of these are true:

- [ ] Active issue number is recorded in `.agentx/state/loop-state.json` or equivalent.
- [ ] Active execution plan exists under `docs/execution/plans/` and reflects the current state.
- [ ] Active bounded contract (if any) is in `Active` or `Complete` status, not `Proposed`.
- [ ] Recent verification evidence is linked from the plan or progress log.
- [ ] No tool call is in flight.

If any item is false, write the missing artifact first, THEN compact.

## What Compaction Must Preserve

A correct compaction summary keeps:

1. The active issue and its acceptance criteria.
2. The current checkpoint and the next required action.
3. Decisions made in this session that are NOT yet in a durable artifact (and a note to write them down before the next compaction).
4. Open blockers and the agent or skill responsible for each.
5. Any user preferences expressed in the session that affect future turns.

A correct compaction summary discards:

- Tool-call output that has been read and acted on.
- Failed approaches that are already documented in `pitfalls.md` or the plan's Decision Log.
- Greetings, acknowledgements, and chain-of-thought scaffolding.

## Reset Pre-Conditions

Reset (start a fresh session from durable artifacts) when:

- The transcript contradicts the repo state.
- A compaction would have to summarize "I think I did X but I am not sure."
- The user has switched topic completely and the previous context is not needed.
- You have crossed three or more failed self-review iterations on the same problem -- a fresh read of the artifacts often beats more iteration.

On reset, the next session must boot from:

1. `AGENTS.md`, `docs/WORKFLOW.md`, relevant agent definition.
2. Active issue + linked plan + progress log + bounded contract.
3. Latest evidence summary.
4. `memories/` files for cross-session lessons.

If any of those are missing, write them BEFORE the reset, not after.

## Provider Awareness

Different providers compact differently. The decision rule is provider-aware but provider-agnostic in intent.

- Some providers compact silently when the context window fills. In that case, "compact" means "stop adding noise before the silent compaction happens, so it has a clean transcript to summarize."
- Some providers expose an explicit compact command. Use it at the checkpoint boundary, not mid-implementation.
- Some providers do not compact at all. There, the only options are continue or reset; "compact" collapses into "summarize into a durable artifact and reset."

Do not hardcode behavior for one model family. Reason from available context budget, compaction behavior, and summary support.

## Anti-Patterns to Reject

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Compact mid-edit to "free up budget" | The edit state is in the transcript, not yet on disk. Compaction loses it. |
| Compact before reading the spec | The summary will record "spec not yet read" forever. Read first, then compact. |
| Reset without writing the open decisions to a plan | The next session boots blind. |
| Use compaction as a substitute for an execution plan | The summary is volatile; the plan is durable. Compaction is not memory. |
| Compact every N turns on a fixed schedule | Schedule-driven compaction interrupts active slices and loses work. |

## Integration With AgentX

- The Reset-vs-Compaction policy in [docs/WORKFLOW.md](../../../../docs/WORKFLOW.md#reset-vs-compaction-policy) is the source of truth; this skill is the day-to-day operational distillation.
- Pair with the `context-management` skill for token-budget arithmetic.
- Pair with the `iterative-loop` skill: never compact inside an unverified iteration; verify, record evidence, then compact.
- The `verification-before-completion` skill applies here too: do not declare "compaction complete" without checking that the durable artifacts cover the state that was compressed.

## Self-Check Before Compacting

- [ ] Plan, progress, and any active contract are current
- [ ] Verification evidence for the current slice is recorded
- [ ] No tool call is mid-flight
- [ ] The summary I am about to produce can boot the next session by itself
- [ ] If any of the above is false, I will write the missing artifact FIRST

---

**See Also**: [context-management](../../ai-systems/context-management/SKILL.md) | [iterative-loop](../iterative-loop/SKILL.md) | [verification-before-completion](../verification-before-completion/SKILL.md) | [docs/guides/RESET-VS-COMPACTION-POLICY.md](../../../../docs/guides/RESET-VS-COMPACTION-POLICY.md)

