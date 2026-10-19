---
title: Hook, Loop and Memory Reliability
description: Bounded fixes for the observed DogFacebook workflow delays without weakening delivery gates.
status: in-progress
---

## Purpose / Big Picture

The user requested fixes for hook overhead, false stuck-loop behavior and lesson
saving. The user authorized autonomous execution of the presented scoped plan.
Changes apply to Frontier source, not the running DogFacebook session, installed
extension, user-global Azure telemetry hooks or unrelated assessment documents.
The subsequent user request authorizes commit and push on the current branch.
No publication, model change or external service change is included.

## Decision Log

* Installed Local-agent hooks probe a missing repository-local launcher, so
  zero-copy use pays for PowerShell without reaching policy enforcement.
* A valid active loop becomes STUCK solely because its last evidence iteration
  is old; fresh evidence can already be recorded with `loop iterate`.
* Lesson promotion appends to conventions before marking its source promoted,
  allowing duplicate capture on retries; memory instructions lack a bounded
  failure/defer policy.

Alternatives rejected: raising all timeouts, fabricating activity timestamps,
disabling gates, hot-patching installed assets, or copying runtime trees into
every workspace. Prefer a shared bounded hook bridge, an explicit checkpoint-due
health state, and idempotent local lesson writes.

## Acceptance Criteria

| ID | Required outcome | Verification |
| --- | --- | --- |
| H1 | Loaded-extension hooks resolve their bundled runtime; portable repository hooks retain a fallback | Activation/environment contract and isolated hook cases |
| H2 | Known read-only calls avoid PowerShell; mutations retain authoritative policy validation | Fast-path and protected-state regression cases |
| H3 | Malformed input, missing runtime and child timeout return explicit bounded outcomes | Hook input/failure-path cases; syntax and packaging checks |
| L1 | An aged valid active loop requests a fresh evidence checkpoint, not destructive reset | CLI/TypeScript parity cases at age boundaries |
| L2 | Completion remains blocked until fresh evidence/review; invalid state and completed-loop staleness remain blocked | Existing gate cases and new recovery cases |
| M1 | Repeated lesson promotion does not append duplicate entries, and errors do not claim a save | Promotion retry and write-failure cases |
| M2 | Memory lookup/save attempts stay bounded and optional; failure defers capture without claiming success | Instruction review and context budget check |
| D1 | Canonical and packaged runtime paths, hooks and inventories remain consistent | Build, manifest, frontmatter and asset checks |

## Plan of Work

1. Implement checkpoint-due health and recovery messaging in CLI/TypeScript.
2. Add a small Node hook bridge and bind its runtime through the loaded extension;
   retain portable fallback and explicit unsupported-host diagnostics.
3. Make lesson promotion retry-safe and tighten memory persistence guidance.
4. Update regression cases, packaging inventories and documentation.
5. Run non-test checks, review exact final scope independently, complete the loop,
   then offer focused test execution with explicit consent.

## Validation and Acceptance

During the loop: syntax, typechecking, source/asset validation, instruction checks
and independent review. Test suites run only after loop completion and explicit
consent. Host hook environment propagation needs extension-host qualification;
source/unit checks alone do not prove every supported host works.

## Artifacts and Notes

Evidence: commit `137886fa` contains the reviewed reliability implementation;
the local quality loop completed at 91/100 with no HIGH/MEDIUM review findings.
Tests were not run locally. PR #439 CI subsequently found missing plan sections,
six curly-rule findings and separate release/dependency blockers. Release 9.8.1
tracks those repairs without treating the earlier local review as CI approval.

## Progress

* Implemented checkpoint-due CLI/TypeScript parity without changing evidence
  freshness, iteration counts or review requirements.
* Added the bounded hook bridge, loaded-extension bindings and ownership-checked
  portable shim. Inspected Local hook executor inheritance of `process.env`;
  live qualification of a newly installed build remains outside this source fix.
* Lesson promotion uses the workspace root, bounded YAML processing, a promotion
  lease, duplicate detection and checked atomic replacement. Host-memory guidance
  explicitly defers optional saves after bounded failure.
* Typecheck and syntax checks passed. The real loop checkpoint caught and verified
  a repair for an async PowerShell result leak. Prompt no-regression passes;
  98 inherited overages remain. Regression cases are authored, not executed.
* Rebuilt the bundle and verified canonical/runtime hook parity. Strict inventory
  verification reports 360 files with no missing or modified entries.
* The interim independent review identified six medium findings. Repairs cover
  context opt-out, incomplete bindings, hybrid protected state and hard-link
  aliases, linked workspace roots, launcher recovery and valid private fixtures.
* Final exact-scope independent review, loop completion and the post-loop test
  offer are required before the authorized commit and push.