---
description: 'Preserve executable and semantic contracts while optimizing source structure and prompts.'
confidence: 0.7
observations: 2
status: curated
category: engineering
---

# LEARNING-20260906: Optimize contracts, not just file length

**Date**: 2026-09-06
**Issue**: User-requested repository structure and prompt optimization
**Category**: Engineering and prompt quality
**Confidence**: 0.7
**Observations**: 2

## Context

A repository-wide inventory covered 26 agents, 134 skills and 23 reusable
prompts. Edits targeted responsibility boundaries, demonstrated metadata defects
and high-impact prompt duplication. Inventory coverage was not a claim that
every source line or skill received a deep semantic audit.

## Learning

- For move-only extraction, freeze declarations as well as exports. All 39
  initializer declarations were compared with their pre-task source; unnecessary
  formatting and expression rewrites were removed before accepting the split.
- A high skill-rubric score does not prove preservation of meaning. Independent
  domain review found missing model-selection evidence, fallback/cadence/recovery
  rules and input schemas after an initially high-scoring compression.
- Read the actual helper before replacing examples with a link. The existing
  model comparer can skip missing baselines and uses weak length/non-error
  proxies; its reference now discloses those limits and requires preflight.
- Keep critical rules in skill roots; move examples and longer procedures to
  reachable references. Retain discovery and price provenance rather than mutable
  model rankings or invented snapshots.
- Reuse one metadata parser and batch filesystem inputs. A per-skill Node
  process introduced unacceptable overhead; one batch generated the full catalog
  in 3.55 seconds in the recorded local run. This is not a benchmark against the
  original simplistic parser.
- Validate the installed parser, not just the dependency-rich source checkout.
  Underscored keys and quotes inside plain YAML scalars exposed standalone gaps.
- A prepared Model Council brief is not three independent model responses.
  Centralized instructions require actual attribution, disclose unavailable or
  role-only results, and forbid simulated consensus.
- Display redaction can resemble broken example code. A suspected malformed
  smoke-test snippet parsed with zero TypeScript syntax errors. Validate syntax
  without exposing content rather than inferring defects from masked displays.

## Evidence

- Retired execution detail:
  `git show 7fd090a4:docs/execution/plans/EXEC-PLAN-20260906-structure-prompts.md`.
  This learning retains the decision record and preservation results.
- [Registry regression tests](../../../tests/registry-generation-behavior.ps1):
  array shapes, block scalars, invalid input and standalone parser compatibility.
- [Prompt contract tests](../../../tests/prompt-contract-behavior.ps1):
  routing, evidence, restored AI contracts and council honesty.
- [Council brief tests](../../../tests/council-brief-behavior.ps1):
  offline preparation, pending members, UTC timestamps and parsing markers.
- [Distribution tests](../../../tests/harness-distribution-behavior.ps1):
  canonical/seed/installed contents and complete nested-reference inventories.
- Frozen metadata comparison checked all 183 files without a difference.
- The measured 17 edited root prompts went from 60,474 to 43,738 estimated
  tokens (27.67%); the six skill roots went from 25,153 to 8,203 (67.39%).
  Estimates use LF-normalized characters/4. Extra reference material is separate;
  these are not provider token counts, billing savings or live-model evaluations.

## Why It Matters

Structural tests, semantic review and deployment-boundary checks catch different
failures. None can substitute for the others, and shorter prompts can be worse
when they lose an operational contract. Small additions for honest limitations
are justified even when a particular prompt grows.

## Promotion Path

Retain as a curated observation. Promote only after independent future tasks
confirm the pattern; do not treat this single optimization as universal evidence.

## Related

- [Documentation maintenance](../../guides/DOCUMENTATION-MAINTENANCE.md)
- [Documentation-drift learning](LEARNING-20260905-documentation-drift.md)
