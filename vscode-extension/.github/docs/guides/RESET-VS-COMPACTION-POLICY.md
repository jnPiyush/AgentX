# Reset Vs Compaction Policy

This guide defines when AgentX should continue in-place, compact context, or start from a clean reset for long-running work.

## Decision Goals

- Keep work resumable from durable artifacts, not transcript luck.
- Use compaction when the work is still coherent and artifact state is current.
- Use a clean reset when the current session no longer provides a trustworthy execution surface.
- Stay provider-aware by reasoning from available context budget and artifact freshness, not from one model family.

## Preferred Order

1. Continue in the current session when the active slice is still coherent.
2. Compact when the session is still coherent but the prompt budget is under pressure.
3. Reset when coherence is lost or durable artifact state is no longer sufficient for safe continuation.

## Continue In Place

Prefer continue when all of the following are true:

- the active issue, plan, and current slice are still clear
- harness thread state is current
- loop state is current enough to explain the active iteration
- no unresolved blocker requires reframing the work
- the current provider still has enough prompt budget for the next bounded step

## Compact

Prefer compaction when all of the following are true:

- the work remains on the same issue and bounded slice
- plan, progress, contract, and evidence artifacts are current enough to reconstruct intent
- the main problem is token pressure, not workflow confusion
- the next step is still a continuation of the same bounded contract

Strong compaction signals:

- prompt budget is approaching the configured threshold
- the conversation contains repeated tool output or repeated review loops
- the active slice already has a durable contract and evidence summary

## Clean Reset

Prefer a clean reset when one or more of the following are true:

- the active issue or bounded slice changed materially
- the plan or progress log is stale enough that continuation would rely on chat history
- the current session accumulated contradictory assumptions or unresolved blocker drift
- the operator needs a fresh implementation pass from durable artifacts only
- provider or model changes materially alter the working token budget or reasoning mode

## Artifact-First Inputs

Reset and compaction decisions should prefer these durable inputs over transcript recall:

- active issue status
- execution plan freshness
- progress log freshness
- bounded work contract state
- evidence summary state
- harness thread status
- loop completion or staleness state
- durable review findings or learning capture when relevant

## Provider-Aware Rule

Provider awareness means using generic factors such as:

- available context window
- compaction threshold behavior
- whether summary-based continuation is already available
- whether the current runtime supports the necessary reasoning or tool pattern

Provider awareness does not mean hardcoding one model vendor or one model family into the policy.

## Minimum Safe Rule

If AgentX cannot answer these questions from durable artifacts, prefer reset over compaction:

1. What issue and bounded slice are active?
2. What changed already?
3. What checks passed or failed?
4. What blocker or next action remains?