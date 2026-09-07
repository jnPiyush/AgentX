# dispatching-parallel-agents: Patterns That Work, Reference Infrastructure In This Repo, Done Criteria

> MUST read before work involving **patterns that work, reference infrastructure in this repo, done criteria**. This reference preserves complete source guidance relocated for context-budget compliance.

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
# Convene via the agentx CLI (scripts/model-council.ps1 is the canonical implementation)
pwsh .agentx/agentx.ps1 council `
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