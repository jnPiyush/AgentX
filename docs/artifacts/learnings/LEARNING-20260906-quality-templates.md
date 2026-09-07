---
description: 'Preservation and integration checks for prompt-budget and template remediation.'
confidence: 0.7
observations: 1
status: draft
category: 'engineering-workflow'
---

# LEARNING-20260906-quality-templates: Verify preservation and consumer behavior

**Date**: 2026-09-07
**Source**: Local delivery commit `7fd090a4`; retired execution detail is available
with `git show 7fd090a4:docs/execution/plans/EXEC-PLAN-20260906-quality-templates.md`.
**Baseline**: `55f02840`

## Context

Prompt-budget remediation relocated detailed guidance from skill roots. Template
compaction also changed the surfaces read by registry generation and the extension.
Smaller files and high rubric scores did not establish a correct result.

## Learning

Require independent evidence for each contract:

| Contract | Decisive check |
|----------|----------------|
| Content preservation | Account for every original paragraph and complete code fence |
| Useful entry points | Keep specialized root rules and explicit topic routes |
| Metadata | Compare frozen inputs through every real consumer, including malformed cases |
| Navigation | Validate target files and fragments after relocation |
| Budget | Check the whole tree, including newly created references |
| Evidence currency | Bind results to current file hashes, not a worker's earlier delivery |
| Visual clarity | Render actual final diagrams; retain evidence and decision sections |

Whitespace/path-normalized equivalence is not permission to excuse arbitrary
missing content. Record each deliberate correction separately from relocation.

## Evidence

- Manual-publish preparation exposed a stale, single-quoted upgrade guard and
  repeated Bash comparisons missed by version stamping. Derive guards and warnings
  from the target release, update every repeated comparison, and test upgrades
  from the immediately preceding patch as well as an older minor. Assert that
  static guard markers exist before comparing their positions.
- Delivery completed through the normal quality loop and commit hooks in
  `7fd090a4`. Final independent review recorded zero HIGH/MEDIUM findings and
  two nonblocking informational LOW notes. Extension lint, compilation and
  1,080 tests passed; final harness and distribution checks passed 57/57 and 43/43.
- The 15 templates fell from 60,070 to 27,683 estimated tokens (53.9%), using
  LF-normalized characters/4. This is not provider billing or a live-model result.
  Live Agents-window GUI validation was not performed. The failed full-framework
  run and corrective targeted evidence remain distinguished below.
- An independent preservation check found deleted Azure CLI guidance despite
  passing root budgets. Restoring it produced seven complete outlier passes.
- Template semantic review restored missing model identity, tool, evaluation and
  review-evidence contracts. The final 15-template check passed 79 assertions;
  all 34 Mermaid diagrams rendered locally.
- A strict whole-tree check caught an oversized Databricks reference missed by
  root-only checks. Relocating complete sections to an existing linked reference
  preserved all 27 platform roots' original source units and passed its budgets.
- Nine engineering paragraph differences required explicit equivalent path/anchor
  checks; all code fences remained exact. These were not reported as byte identity.
- Two compacted references reappeared at baseline size; the worker later confirmed
  restoration outside its root scope. Preservation passed while budgets failed:
  current hashes, both checks, and explicit reference ownership were necessary.
- Runtime integration found that a new process wrapper flattened a path containing
  spaces and stopped only its immediate process. Representative path and descendant
  tests are required before accepting a bounded-runner claim. A later regression
  showed that inherited output handles can outlive the parent, requiring a shared
  exit-and-drain deadline and fixture-owned cleanup rather than PID-based discovery.
- Six new ADO reference files were missing from the CLI pack manifest. Source-link
  checks could not detect this installed boundary. Adding supporting entries and
  actual installation/bundle/seed hash checks produced 52 passing parity checks.
- Actual Bash installation also preserved all six companion hashes. Its integration
  suite exposed a prose-skill root carrying generic visual-UI workflow instructions
  despite passing numeric scoring. Root semantics need independent review; retaining
  the right prose workflow in a reference does not excuse a contradictory root.
- PowerShell host options belong before `-File`; script arguments belong after it.
  A real prompt-rejection regression detected incorrect placement even though the
  child process itself started successfully.
- Hidden or fenced copies of superseded guidance are not a valid preservation
  strategy. Keep one active contract and document verified equivalences instead.
- Whole-tree budgets passed across 640 files; 88 changed roots passed score and
  baseline-regression checks. A 341-file navigation audit found zero broken
  internal or incoming fragments. None of these replaces executable integration.
- A full framework run timed out its pre-commit child despite an earlier 50/50
  standalone pass. Record the failure and isolate it; do not silently increase
  the timeout or report the full run as passing.
- The final measured pre-commit wrapper completed process and capture in 736.683
  seconds. An earlier successful log's 902.7-second write span is weaker timing
  evidence; distinguish it from Stopwatch duration. A bounded 1,200-second
  suite allowance retains headroom without changing individual process limits.
- After regeneration, all other previously failing integration cases passed a
  22-check targeted rerun. The original full run remains a 274/282 result, not a
  retroactively green run. Record both the failure and the corrective evidence.
- Progressive disclosure changes where contracts live, not whether they apply.
  Verify mandatory links and linked report content rather than obsolete root
  headings. Keep required checks separate from evidence of actual execution;
  prefilled fallback success is not a safe report template.
- A later production harness collector reproduced saturated-stderr deadlock.
  Both audit collectors now share bounded concurrent capture and reject silent
  nonzero exits. Separately, dirty-tree compliance launched one PowerShell host
  per changed file. Reusing script scope preserved scan results and exit handling:
  52 harness assertions pass, and real compliance finished 334 scans in 68.229
  seconds. Distinguish these two causes rather than calling every delay a deadlock.
- Final independent preservation adjudication accepted 15 equivalent relocations
  and six deliberate improvements. It also found a stale audit count outside the
  relocated sections. Correct all live entry points, not only the first occurrence;
  both ten-pass references and the real TypeScript dependency were re-reviewed.
- Removing process boundaries also removes exception isolation. Independent review
  found that a thrown scrub error skipped later scans and post-batch metadata,
  despite controlled exit-code tests passing. A typed per-invocation error boundary
  restores failed-target reporting and continued scanning without hiding the failure.
  The actual-command regression failed four assertions before repair; all 57 harness
  assertions now pass, including thrown/stopping errors and later HIGH findings.
- Name the analysis tool and scope in evidence. Configured PSScriptAnalyzer reports
  zero findings in each corrected PowerShell file; the separate scrub scanner has
  three baseline duplicate-logic MEDIUM findings in the test file. One tool's clean
  result does not erase another tool's debt. Retain per-file counts, not only an
  empty findings array that leaves the scanned scope implicit.

## Why It Matters

Quality metrics are complementary, not interchangeable. A smaller document can
lose its contract; a larger baseline restoration can pass preservation while
undoing the requested optimization; an isolated smoke test can miss real host paths.

## Promotion Path

This is a single remediation observation, not an automatically promoted convention.
Reconfirm in independent tasks before increasing confidence. Parent-only shared-loop
ownership and non-overlapping root/reference ownership belong in handoff planning;
recover interrupted loops through supported CLI commands and fresh verification.

## Related

- [Documentation maintenance](../../guides/DOCUMENTATION-MAINTENANCE.md)
- [Cross-cutting protocol](../../../.github/AGENT-PROTOCOL.md)
- [Code-quality rubric](../../../evaluation/rubrics/code-quality.md)
