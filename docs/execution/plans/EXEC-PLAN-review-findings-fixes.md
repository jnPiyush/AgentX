---
title: Fix review findings across graph, workspace state, guided interaction and Cursor
description: Resolve the HIGH and MEDIUM findings from the post-delivery review of commits b07ee1fe and a00a2813 without widening scope.
---

## Purpose / Big Picture: contract

The user asked to fix every issue reported by the read-only review of the pushed
guided-interaction, repository-graph, automatic-workspace, Frontier-only and Cursor
work (#411). Fixes stay inside the reviewed surfaces. Design observations that are
not defects (for example, a read-only fast path for guided mode or replacing
milestone self-reporting) are out of scope and recorded below.

The previous completed loop and its evidence were archived to the session files
under `frontier-only-completed-before-review-fixes` before this loop started.

## Decision Log: approach

- Rejected: suppress failures (for example, swallow parser timeouts or ignore stale
  markers). That hides defects and can admit unsafe states.
- Rejected: one large refactor of each subsystem. The findings are local, and the
  existing contracts already passed independent review.
- Selected: targeted fixes per finding. Each fix keeps fail-closed behavior and adds
  an explicit recovery or isolation path plus a regression case.

The graph findings were delegated to one background engineer with a fixed file
scope; the remaining fixes were made directly. One independent reviewer covers the
combined result.

## Plan of Work: findings and fixes

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | HIGH | Parser `safeText` regex backtracks exponentially; one file fails every refresh | Truncate before matching, use non-overlapping quote patterns, retry failed batches per file within a bounded budget |
| 2 | MEDIUM | Hierarchy and relation rebuild scale with groups x edges | Single-pass indexes and cached candidate lookups; hierarchy scan budget with visible truncation |
| 3 | MEDIUM | Interrupted `transition.lock` blocks all later transitions and editor writes | Exclusive holder removes stale markers; marker records its owner; editor treats exited owners as stale |
| 4 | MEDIUM | Orphan editor leases block repository mode with no recovery | `frontier workspace-state recover` plus automatic removal of leases whose owner exited or whose pid was reused |
| 5 | MEDIUM | Guided run stopped before plan approval could not resume | `continue` allowed from discovery with the current identity; writes stay blocked until approval |
| 6 | MEDIUM | `@frontier continue "approve"` became a revision | Strip one wrapping quote pair; hint no longer suggests quotes |
| 7 | MEDIUM | One plugin with a retired engine key failed the whole catalog | Skip unsupported releases and plugin folders with a warning; bundled ranges cover 9.x |
| 8 | MEDIUM | Reroute workflow dispatched the missing `agent-x.yml` | Dispatch `frontier.yml` |
| 9 | MEDIUM | Graph rejected workspaces opened through a junction ancestor | Resolve the root to its final path; validate links only below the trusted root |
| 10 | MEDIUM | Cursor hooks started PowerShell for every tool call | Node hook launcher with cached runtime binding; launcher fast path; migration of previous hook entries |
| 11 | MEDIUM | Dev-only `undici` override below the TLS fix | Override and lock at 7.29.1 |
| 12 | MEDIUM | Held-out evaluation exercised only exact identifiers | Natural-language, partial-identifier and one-hop held-out cases |
| - | LOW | Stale init messages, Unicode case folding in Cursor, orphaned owned Cursor assets, partial `FRONTIER_STATE_*` fallback, trailing dot/space identity drift, fail-open link check, lease release errors, Cursor setup environment, legacy pending records, `ship.ps1` role ID, undocumented removals | Each corrected in place with docs updated |

## Out of scope (recorded, not changed)

- Guided-mode design observations: read-only fast path, unrelated chat text as
  revision feedback, model-chosen impact labels, self-reported milestones.
- Terminal approval through `frontier run --input-decision`: host-owned terminals
  keep host permissions; this boundary is already documented.
- Graph cold-load cost and the token-savings comparison against plain search need
  a measured evaluation arm, not a code change in this pass.
- Published registry releases keep their declared ranges; changing them requires
  republishing their artifacts.

## Validation and Acceptance

1. Each finding has a code fix and, where behavior changed, a regression case.
2. Build/type/syntax checks and bounded operational probes give fresh evidence:
   parser adversarial input, graph timing and output equality, junction aliases,
   lock and lease recovery, guided continuation, Cursor hook latency.
3. Test suites and the held-out evaluation wait for loop completion and explicit
   user consent.
4. Independent review covers the final bytes with zero HIGH/MEDIUM findings.

## Progress

All findings are implemented. Probe evidence: the adversarial parser input dropped
from a 30-second batch timeout to under 1 ms in the sanitizer; hierarchy build
time dropped from 8.98 s to 0.46 s, with relations from 7.15 s to 4.92 s and
identical JSON; Cursor read hooks dropped from 1.3 s to about 0.35 s and policy
hooks from 4.4 s to about 2.5 s. Independent review and loop completion remain.

## Artifacts and Notes

- Evidence: delivery commit c6171669 (`feat: optimize quality loops and resolve review findings (#411)`).
