---
title: Incremental verification and impact-aware loop reviews
description: Implement both approved optimization phases without weakening Frontier quality or consent gates.
---

## Contract

Issue #411. The user approved both phases of the loop-time recommendation:
batched non-test preflight, factual review packets, reviewer capability checks,
phase timing, safe result reuse, impact-based follow-ups and early boundary
review for high-risk work. The previously approved, uncommitted review fixes
remain intact. Their evidence was archived before starting this high-risk loop.

No test suite runs inside a loop or review. An independent final report still
covers the complete current implementation scope. No approval, authorization
decision or mutation-policy result is cached.

## Research and alternatives

- Reuse the native CLI's bounded checker process and hash-bound quality report.
  Reuse `scrub -PathsFrom` rather than another scanner. Use the existing
  verification result vocabulary and evidence-summary structure.
- Rejected: a persistent daemon or a second TypeScript workflow controller.
  Neither is needed for the measured repeated-check and review-preparation costs.
- Rejected: file-hash-only review inheritance and arbitrary configured commands.
  Dependencies can change behavior; a command wrapper can execute tests.
- Selected: one native helper, a bounded static JavaScript/TypeScript checker,
  and thin CLI/editor/MCP entry points. Unknown impact expands review. Checks
  whose complete dependency set cannot be established execute fresh.

## Interfaces and reuse inventory

| Surface | Decision | Contract |
| --- | --- | --- |
| Native loop CLI | Extend | `preflight`, `review-packet`, `reviewer-check`, `timing`; preflight before iterations and completion |
| Loop engineering helper | New | Source snapshots, check receipts, impact selection, neutral packets and phase ledger under selected state |
| Static checker | New | Syntax and Mocha declaration inspection without importing or running tests |
| Existing checker runner | Reuse | Bounded child processes, explicit failures and no package lifecycle commands |
| Existing scrub | Reuse | One manifest, advisory output, no automatic fixes |
| Existing verification model | Reuse | Passed/failed/skipped counts, individual timings and honest evidence |
| Editor loop menu | Extend | Invoke native actions; do not duplicate loop decisions |
| MCP loop tools | Extend | Expose bounded preparation actions without authorizing reviews or tests |
| Runtime delivery and sandbox | Extend | Ship and protect both helpers across installed and standalone layouts |
| Agent protocol and loop skill | Extend | Neutral packet, capability check, impact follow-up and boundary-review instructions |

## Design and safety

1. Snapshot file bytes, membership and contract inputs. Include workspace/loop
   identity and checker/tool identity in reuse keys. Preserve the original
   execution time and result for reused checks.
2. Syntax checks depend on their exact files and parser; whole-scope checks
   depend on the whole relevant snapshot. Semantic typechecks execute fresh
   when installed dependency closure is unknown. Failure, timeout and missing
   required tools cannot create a reusable passing result.
3. Preflight executes only built-in non-test actions. It never runs package
   scripts, installs dependencies, formats source, executes test discovery code
   or invokes test suites.
4. Review packets contain requirements references, full final scope, changed
   inputs, conservative impact, actual check receipts and outstanding findings.
   They contain no author-provided correctness argument or automatic verdict.
5. Reviewer diagnostics verify actual file/diff access in the calling host.
   They are not identity attestation, a read-only sandbox or approval. A host
   without those capabilities reports unavailable before doing a long review.
6. Boundary packets recommend early contract review for high-risk/cross-cutting
   work. They never replace the independent final review.
7. Phase timing is attributed wall time, not CPU/model time. Unreported intervals
   remain unattributed. Waiting is recorded explicitly; no percentage saving is
   inferred from unrelated tasks.

## Acceptance and regression plan

| Criterion | Regression cases / evidence |
| --- | --- |
| Checks are non-test, batched and fail closed | Syntax failure, missing executable, timeout, no package scripts or suites invoked |
| Cache reuse is safe and visible | Same inputs reuse original timestamp; content/config/tool/addition/deletion changes invalidate; failures rerun |
| Review remains complete | Full scope retained, changed dependencies widen impact, stale packet rejected, no inherited approval |
| Capabilities are diagnosed early | Real source read and diff result; missing Git/nonexistent source reported explicitly |
| Timing separates work and waiting | Deterministic phase transitions, overlap handling, unattributed time and check durations |
| Private state and delivery work | No source-state writes, packaged helpers and protected paths, CLI/editor/MCP parity |
| Quality gates remain unchanged | Existing review score/hash checks and post-loop test consent retained |

Tests are authored during implementation and offered only after loop completion.
Non-test validation includes parsing, typechecking, current-artifact checks and
bounded operational inspection. No commit, push or installation is requested.

## Progress

Both phases are implemented through the native loop commands, editor menu and
MCP preparation tool. Actual loop evidence records current checks and timings.
Private-profile operational checks confirmed original receipt timestamps survive
reuse, invalid JSON fails, waiting attribution stops explicitly and stale packets
are rejected. The live MCP catalog exposes the bounded preparation actions and
rejects unsupported actions. The generator now supplies a read-only parity check
using the same link transformations as copying. Final independent approval and
post-loop test execution remain separate.

The first independent review requested five corrections: trusted standalone scrub
delivery, JavaScript package-mode invalidation/selection, cache publication only
after stable-input validation, composite-compatible private compiler metadata,
and non-blocking cosmetic whitespace. Each has a focused regression case; the
closure review must verify all five before the final verdict.
