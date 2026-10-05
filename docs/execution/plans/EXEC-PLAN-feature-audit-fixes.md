---
title: Feature audit corrections
description: Bounded fixes for the 13 implementation gaps identified at d1074854.
---

## Scope and authority

Issue #411. The user authorized careful, simple corrections to the feature audit
of source commit `d1074854`. Preserve the 88-claim inventory and its historical
snapshot. No new feature framework, provider, live account integration, deployment,
commit, push or release is included.

This is high-risk bug-fix work because provider authorization and review integrity
are affected. Use implementation plus independent review. The host does not
attest distinct model families or controller isolation; no formal multi-family
execution qualification is claimed. The existing repository quality gate applies.

## Research and alternatives

- Keep provider choice at initialization, where enabled/readiness policy already
  exists. Reject authentication errors during execution instead of adding a
  second fallback/approval state machine. Check the live execution identity
  against the saved interaction at model and tool boundaries.
- Extend the existing bounded process helper for stdin, then reuse it for native
  Claude invocation and readiness. Do not create a parallel process framework.
- Reuse the quality evaluator for later gate checks. Include all supported
  JavaScript/TypeScript module extensions in scope and semantic selection.
- Run the inexpensive Git diff check fresh. Hashing every effective Git setting,
  attribute and executable dependency adds complexity without useful savings.
- Reuse repository-aware issue calls and existing dependency/state helpers.
  Unknown dependencies block readiness; changed parallel units lose approval.
- Align the registered learning template with the existing retrieval contract.
  Accept both supported JSON collection shapes at the issue-list boundary.
- Keep extracted plugin files alive through selection/install and clean up in
  the owning command. Prefer compatible bundled source over an unusable published
  catalog. Do not relabel old binaries or invent release checksums.

## Acceptance and file inventory

| ID | Required correction | Existing implementation and regression surface |
| --- | --- | --- |
| A01 | Auth failure cannot reach disabled providers or transfer plan approval; execution identity drift blocks effects | `agentic-runner.ps1`; runner and guided-interaction behavior cases |
| A02 | Native HTTP and Claude/readiness processes have finite deadlines, output bounds and cancellation cleanup | `agentic-runner.ps1`, `hydrafusion-protocol.ps1`; runner/process cases |
| A03 | `.mjs`, `.cjs`, `.mts`, `.cts` receive scored scope; TypeScript modules receive semantic checks | `score-code-quality.ps1`, `loop-engineering.ps1`; rubric and loop-engineering cases |
| A04 | Later commit/handoff gates reject current files that differ from the approved scope/hashes | Native loop CLI and existing delivery gate consumers; loop scope/parity cases |
| A05 | Git diff results are never reused with incomplete input identity | `loop-engineering.ps1`; receipt/cache behavior cases |
| A06 | A completed registered learning template can be ranked without a separate incompatible scaffold | `LEARNING-TEMPLATE.md`, learning engine/scaffold as needed; learning tests |
| A07 | GitHub issue reads and writes honor the same configured repository | `frontier-cli.ps1`; provider behavior cases |
| A08 | Structured and text-only MCP results work; malformed/error results remain explicit failures | `frontier-cli.ps1`; provider behavior cases |
| A09 | Unfetched, missing and unreadable dependencies cannot appear complete | `frontier-cli.ps1`; provider/dependency cases |
| A10 | Replacing parallel units invalidates reconciliation; incomplete units cannot close out | `frontier-cli.ps1`; bounded-parallel cases |
| A11 | Singleton issue objects and arrays produce equivalent next-step guidance | `workflowGuidance.ts`; workflow guidance tests |
| A12 | Archive picks exist during selection/install; cancellation and failure clean owned temporary files | `pluginsCommandInternals.ts`; plugin command tests |
| A13 | Current-host bundled plugins are discoverable/installable without false published compatibility/checksum claims | Plugin command/catalog and bundled manifests as needed; plugin catalog/command tests |

The source paths above resolve under `.frontier/runtime`, `scripts`,
`.github/templates`, and `vscode-extension/src`. Reuse their existing tests under
`tests` and `vscode-extension/src/test`. Update directly related operating docs,
this plan, a concise learning artifact and current memory. No ADR changes.

## Verification

Author discriminating regression cases before their fixes. Include disabled and
explicit provider choices, identity drift, timeout/cancellation and output limits,
module-only changes, staged edits after approval, empty/singleton collections,
unresolved dependencies, replaced approved units and plugin cancellation/failure.

During the loop, use syntax/schema checks, TypeScript typechecking, changed-area
scrub and delivery verification. Do not execute suites inside the loop or review.
After independent approval and successful loop completion, offer the named
affected suites and run only the approved post-loop scope. Unanswered means not
run. No live provider, deployment or installed-release qualification is implied.

An independent final report must cover the entire current implementation scope,
score at least 80 under the code-quality rubric, and have no HIGH/MEDIUM findings.
Edits after that report require fresh review.

## Progress

- Research: audit evidence and current source inspected; prior completed companion
  evidence archived separately. Clean starting worktree at `d1074854`.
- Implementation: A01-A13 have source corrections and regression cases.
  Native gates verify the full source snapshot at delivery; editor state-only
  guidance is not a substitute for that check. Bundled plugins are the supported
  current-host installation path; unverifiable registry releases and source
  manifest distribution placeholders were withdrawn rather than relabeled.
- Verification: syntax and TypeScript checks pass for completed slices. The
  current loop records exact checks, hashes and final review status. Suites
  remain a separate post-loop consent step.
- Review corrections: distinguish delivery identity from PATH-sensitive check
  reuse; retain resolved tool/configuration bindings while permitting Git's hook
  PATH changes. Exercise real fixture commits and UTF-8 shim input in regression
  cases. Preserve native early-exit diagnostics, isolate readiness failures, and
  align learning promotion and generated registry metadata with the template.
- Deferred LOW suggestions: per-command dependency memoization and automatic
  watch retry are outside these corrections. Remote read failures remain
  explicit and stop routing rather than silently assuming dependency state.
  Tool hashing is duplicated between check and delivery identities; avoid
  refactoring it in this correctness fix. Readiness and invocation use the same
  supported command types rather than treating profile functions as executables.
- Closure corrections: load snapshot helpers in the caller's scope and exclude
  absent files from delivery membership so staging an approved deletion is not
  a source change. Real-commit regression cases cover unchanged, modified and
  deleted inputs. Shim arguments stay strings, including date-like values.
- Non-test scan budget: the exact 28-file advisory scan completed successfully
  in 92.8 seconds after repeated 90-second preflight timeouts. Give the complete
  scan the same bounded 180-second budget as semantic typechecking; do not skip
  files, suppress failures or substitute old evidence.
