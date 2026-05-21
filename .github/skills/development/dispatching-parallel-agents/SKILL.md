---
name: dispatching-parallel-agents
description: Fan out independent work to multiple subagents with context isolation. Covers when to parallelize (independent reads, multi-file searches, parallel analysis), when not to (writes, dependent steps, shared mutable state), bounded concurrency limits, and the anti-patterns that turn parallel dispatch into corruption. Use whenever the active agent is tempted to run more than one subagent at the same time.
---

# Dispatching Parallel Agents

> WHEN: The active agent is about to spawn more than one subagent in the same step. The temptation is to parallelize everything for speed. The reality is that parallel writes, parallel state mutation, and parallel coupled steps create races that single-threaded execution would have caught.

## When to Use This Skill

Load this skill when:

- The agent is about to launch more than one subagent in the same step
- A task fans out into many independent reads (search, doc lookup, file inspection)
- A long analysis can be split into independent slices that each return a structured summary
- A research phase needs N viewpoints on the same artifact (council pattern)
- Skip when the work has any cross-subagent dependency, writes the same files, or mutates shared state

## Prerequisites

- Knowledge of whether the work is read-only or write-bearing
- A bounded concurrency primitive available (e.g. `tests/bounded-parallel-behavior.ps1`, language-native parallel runner, or `Start-ThreadJob` with a throttle)
- A structured return contract for each subagent (JSON / Markdown section with a stable schema) -- free-form prose is hard to merge

## Rationalization Table

The most common ways parallel dispatch goes wrong.

| Rationalization | Reality |
|-----------------|---------|
| "Parallel is faster, always run in parallel." | Parallel is only faster when the work is genuinely independent. Coupled steps run in parallel race, retry, and end up slower than sequential. |
| "Two subagents editing the same file is fine, git will merge it." | Two subagents editing the same file produce conflicting writes, lost edits, or a corrupt half-merge. Never parallelize writes to the same file. |
| "I will let three subagents run with no concurrency limit." | Unbounded fan-out exhausts rate limits, blows the token budget, and produces partial results when half the subagents time out. Always bound concurrency. |
| "Each subagent can inherit my full context." | Inheriting full context defeats the point. Subagents should receive only the slice they need. Context isolation is the feature, not a limitation. |
| "Free-form prose responses are easier to read." | Free-form responses are nearly impossible to merge mechanically. Require a structured schema (JSON, table, or fixed Markdown sections) per subagent. |

## When Parallel Dispatch Is Safe

Use parallel dispatch ONLY when ALL conditions hold:

- The work is read-only OR each subagent writes to a disjoint, named output slot
- Subagents share no mutable state (no shared files, no shared in-memory store, no shared CLI session)
- Each subagent returns a structured result the dispatcher can merge mechanically
- Total fan-out is bounded by a concurrency limit (default: 3-5)
- A single subagent failure does not corrupt the others' work

If any condition fails, run sequentially.

## When Parallel Dispatch Is Unsafe

Never parallelize when ANY of the following is true:

- Two or more subagents would edit the same file or commit on the same branch
- Subagent N depends on the output of subagent N-1
- The work mutates a shared store (issues, project status, loop state, memory files)
- Failure of one subagent must roll back the others
- Each subagent needs the full conversation context to do its job (the dispatcher should do the work instead)

## Patterns That Work

### Pattern 1 -- Fan-out search across N files / paths

Goal: read and summarize N files concurrently, then merge.

```pwsh
# Bounded by -ThrottleLimit; each subagent inspects one path and returns a JSON summary
$paths | ForEach-Object -Parallel {
    pwsh -NoProfile -Command ".\scripts\summarize-file.ps1 -Path '$_'"
} -ThrottleLimit 4 | ConvertFrom-Json
```

Output contract: each subagent emits one JSON object on stdout. The dispatcher concatenates and reasons over the merged array.

### Pattern 2 -- Council / N viewpoints on the same artifact

Goal: ask 3 different models (or 3 different framings) to evaluate the same document, then synthesize.

```pwsh
# scripts/model-council.ps1 is the canonical AgentX implementation
pwsh scripts/model-council.ps1 `
    -Topic "review-42" `
    -Question "What is the correct Approve / Request Changes decision?" `
    -Context "<diff + spec + test results>" `
    -OutputDir "docs/artifacts/reviews"
```

Output contract: a single `COUNCIL-*.md` file with one section per role and a Synthesis section that resolves divergences.

### Pattern 3 -- Independent analysis slices

Goal: break a large investigation into N independent slices (e.g. one slice per subsystem) and run them concurrently.

```pwsh
$slices = @(
    @{ Name = 'frontend'; Prompt = '...' },
    @{ Name = 'backend';  Prompt = '...' },
    @{ Name = 'infra';    Prompt = '...' }
)
$slices | ForEach-Object -Parallel {
    pwsh -NoProfile -Command "& '$using:runner' -Slice '$($_.Name)' -Prompt @'`n$($_.Prompt)`n'@"
} -ThrottleLimit 3
```

Output contract: each slice writes to a named output file under `docs/execution/contracts/EVIDENCE-<issue>-<slice>.md`. No two slices share an output path.

## Anti-Patterns (Hard Block)

- **Parallel writes to the same file**: two subagents editing `README.md` -> one wins, one is silently lost.
- **Parallel git commits on the same branch**: produces non-fast-forward errors at best, repository corruption at worst.
- **Parallel issue status updates**: race the project board to an inconsistent state.
- **Parallel loop iterations**: loop state is single-writer; two iterations corrupt the state file.
- **Unbounded fan-out**: N=20 subagents with no throttle will OOM, rate-limit, or produce truncated results.
- **Free-form return without a schema**: dispatcher cannot merge mechanically; you end up re-reading every response by hand and losing the parallelism win.

## Reference Infrastructure In This Repo

- `tests/bounded-parallel-behavior.ps1` exercises the bounded-parallel primitive used by AgentX runners; read it to understand the throttle and failure semantics.
- `scripts/model-council.ps1` is the canonical council fan-out for review / ADR / eval phases; reuse it instead of rolling a bespoke parallel dispatcher.
- `.agentx/agentic-runner.ps1` supports sequential subagent invocation; wrap it in `ForEach-Object -Parallel` only when the Safe / Unsafe rules above clear the work.

## Done Criteria

A parallel dispatch is well-formed when ALL are true:

- [ ] Each subagent's work is read-only OR writes to a disjoint, named output slot
- [ ] No subagent depends on another subagent's output (no chains)
- [ ] Concurrency is bounded by an explicit throttle (default 3-5)
- [ ] Each subagent returns a structured result the dispatcher can merge mechanically
- [ ] A single subagent failure does not corrupt other subagents' work or shared state
- [ ] The dispatcher records which subagents ran, with what input slice, and what they returned

If any item is unchecked, run sequentially instead.