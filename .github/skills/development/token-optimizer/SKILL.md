---
name: token-optimizer
description: 'Use when managing instruction/context budgets, cache-aware tokenomics and cost estimates while preserving acceptance criteria, safety and verified quality.'
metadata:
  version: '1.1.0'
---

# Token Optimizer

## When to Use

Use for oversized instructions, costly delegation or context preflight. Separate
file-authoring limits, model context capacity and billing: they are not synonyms.

## Prerequisites

Read workspace policy and supplied usage/price evidence. Local checks need
PowerShell 7; they require no network connection or provider credentials.

## Workflow

1. Read `.token-limits.json` for this workspace's actual per-file policy.
   Do not copy limits from another skill or assume a model's context window.
2. Measure before editing; separate character estimates from provider usage.
3. Load only the current task/phase's references. Keep paths and concise evidence
   summaries for delegation instead of copying the whole conversation.
4. Move tutorials, long examples and repeated checklists to existing references.
   Retain requirements, ownership, failure behavior and non-skippable gates.
5. Re-run the same measurement and requirement tests. A shorter prompt that
   loses correctness is a regression, not an optimization.

## File budgets

```powershell
pwsh .agentx/agentx.ps1 tokens report -Json
pwsh .agentx/agentx.ps1 tokens check -Path .github/instructions
pwsh scripts/token-counter.ps1 -Action count -Path .github/skills/development/token-optimizer -Json
```

The estimator is `ceil(characters / 4)`, not a tokenizer. Exact tokenization
depends on the active provider/model. Reports expose covered and uncovered files
and violations; an absent policy is unconfigured, not a verified pass.
Nested globs and exact overrides come from the workspace policy.
Line endings are normalized to LF for comparable measurements.

`tokens check -BaselineRef <commit>` is an explicit no-regression gate for
inherited budget debt. It retains every violation in the report but fails new
or growing overages, using the same current policy for both revisions.
Default `check` remains strict. Do not label a no-regression result debt-free.

## Core Rules

Before expensive work, reserve response/tool headroom and a safety margin using
the active host's verified context and output limits. Missing limits are unknown;
never silently truncate acceptance criteria or increase a cap to force a pass.

Use the offline [tokenomics contract](references/tokenomics.md) and
`agentx budget -File <request.json> -Json` for explicit context/capability
preflight and rate-based accounting. It makes no model call, changes no model,
does not enforce provider billing, and does not authorize additional spend.

- Normalize input to include cached subsets; output includes reasoning when the
  provider already includes it. Never count either twice.
- Account separately for cache reads, cache writes and ordinary input.
- Include retries and every delegated call. Report credits separately from USD.
- Unknown usage/rates are null, not zero. Do not assume a subscription is free.
- Keep stable prefixes where caching is supported, but measure hits.
- Report cost per verified successful task, including failed attempts; with no
  successes the metric is undefined.

## Bounded delegation

Delegate only work with separate context and file ownership. Set a task budget,
worker count, output limit and stopping rule. Use a small/fast model only when
measured capability satisfies the task; do not downgrade high-risk work because
the user said "quick". Retrying an unchanged failed command wastes tokens and
does not create fresh evidence.

## Checklist

- Before/after measurements used the same estimator and scope.
- Covered/uncovered files and existing budget debt are visible.
- Important facts survive compaction and no guardrail was removed for savings.
- Price/model data has provenance and is not described as live unless verified.
- Required tests and independent review remain part of the budget.
- No token reduction is presented as billing savings without measured usage.

## Decision Guide

File over budget -> reduce duplication or load references on demand. Context
over capacity -> compact verified state or split the task. Required cost unknown
-> obtain evidence or stop; never trade away required validation for a cheap run.

## Rationalization Table

| Temptation | Required response |
|------------|-------------------|
| "Cached input is free" | Supply the cache-read rate and measured hit count |
| "Fewer tokens means better output" | Compare requirement pass rates first |

## Error Handling

Inspect exit status and report details. Invalid policy/usage must be corrected;
an unconfigured policy or an inherited overage is not a strict budget pass.
