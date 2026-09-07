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

## Anti-Patterns (Hard Block)

- **Parallel writes to the same file**: two subagents editing `README.md` -> one wins, one is silently lost.
- **Parallel git commits on the same branch**: produces non-fast-forward errors at best, repository corruption at worst.
- **Parallel issue status updates**: race the project board to an inconsistent state.
- **Parallel loop iterations**: loop state is single-writer; two iterations corrupt the state file.
- **Unbounded fan-out**: N=20 subagents with no throttle will OOM, rate-limit, or produce truncated results.
- **Free-form return without a schema**: dispatcher cannot merge mechanically; you end up re-reading every response by hand and losing the parallelism win.

## Core Rules

- Give each agent a complete, non-overlapping scope.
- Do not investigate work already delegated to another agent.
- Integrate only after checking evidence, conflicts, and missing outputs.

## Workflow

1. Partition the task by dependency and file ownership.
2. Launch only genuinely independent units.
3. Continue coordinator work that does not overlap.
4. Review results, resolve integration order, and verify the combined outcome.

## Error Handling

- Overlap discovered: stop one owner and reassign explicitly.
- Agent returns no usable evidence: perform the scope directly rather than relaunching repeatedly.
- Dependency emerges: serialize the affected units.

## Verification Checklist

- [ ] Scopes were disjoint.
- [ ] Every result includes actionable evidence.
- [ ] No delegated work was duplicated.
- [ ] Integrated output passes the parent checks.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Patterns That Work, Reference Infrastructure In This Repo, Done Criteria](references/details-patterns-that-work-and-done-criteria.md) - MUST read before work involving patterns that work, reference infrastructure in this repo, done criteria.
