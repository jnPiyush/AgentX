# strategic-compaction: Checkpoint Heuristics through Integration With AgentX

> MUST read before work involving **checkpoint heuristics through integration with agentx**. This reference preserves complete source guidance relocated for context-budget compliance.

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

## Integration With AgentX

- The Reset-vs-Compaction policy in [docs/WORKFLOW.md](../../../../../docs/WORKFLOW.md#reset-vs-compaction-policy) is the source of truth; this skill is the day-to-day operational distillation.
- Pair with the `context-management` skill for token-budget arithmetic.
- Pair with the `iterative-loop` skill: never compact inside an unverified iteration; verify, record evidence, then compact.
- The `verification-before-completion` skill applies here too: do not declare "compaction complete" without checking that the durable artifacts cover the state that was compressed.
