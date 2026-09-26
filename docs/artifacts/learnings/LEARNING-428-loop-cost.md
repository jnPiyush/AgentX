---
description: 'A per-file process launch in a mandatory gate is an O(N) cold-start tax, and loop cost usually lives in prose rather than in the machinery the prose describes.'
confidence: 0.5
observations: 1
status: draft
category: performance
---

# LEARNING-428: Loop Slowness Was Process Spawning And Prose, Not Loop Design

**Date**: 2026-09-25
**Issue**: #428
**Category**: performance
**Confidence**: 0.5  (auto-promote at >= 0.8)
**Observations**: 1

## Context

The quality loop was reported as taking far too long, and the obvious reading was
that the loop asks for too many iterations. Measuring instead of assuming found
two independent costs, and neither was the iteration count.

## Learning

1. **A mandatory gate that shells out per unit of work pays a cold start per
   unit.** The pre-commit deslop gate ran one `pwsh` process per staged file.
   At 116 staged files that is 116 interpreter startups for a scan whose actual
   work is milliseconds per file. Give the scanner a way to accept the whole set
   (here a newline-delimited manifest, because repository paths contain spaces
   and 100+ arguments approach the Windows command-line limit), then keep the
   per-unit loop only on the failure path, where attributing a finding to a file
   matters and N launches are affordable.

2. **When a tool's machinery is already permissive, look at the prose.** The CLI
   never required test counts: `--passing` was optional and the baseline check
   only hard-fails against an explicitly set integer. Agents ran full suites
   anyway because the protocol made "Run verification" step 1 and the rubric
   anchor asked for "focused tests and commands". The fix was editing the
   sentences that set the expectation, not the code that enforces it. Before
   changing a gate, verify what it actually enforces; the felt requirement and
   the coded requirement are often different objects.

3. **Extracting a fatal path into a function can change how it reports.**
   Moving target resolution into a helper turned each `Write-Error` into a
   PowerShell error record decorated with the calling frame, so a one-line
   diagnostic rendered as a stack excerpt -- and it regressed the pre-existing
   route, not only the new one. For messages that exist to be read by a human at
   a gate, write to the console error stream directly so the rendering does not
   depend on call depth.

## Evidence

- Batched vs per-file scan of the same targets: 20 files at 10s vs 73s (~7.3x)
  measured by the author; 8 files at 9.82s vs 24.38s (2.5x) measured
  independently by the reviewer on the same change.
- Gate semantics proven unchanged rather than assumed: a seeded stale-byline
  HIGH produced identical HIGH sets and identical exit codes on both paths, and
  the reviewer separately confirmed that the cross-file `duplicate-logic` finding
  newly visible to a batched scan is MEDIUM and exits 0 without `-Production`,
  which the hook never passes.
- `--passing` optionality confirmed at runtime: four of this change's five loop
  iterations omitted it and the CLI accepted each with a grey advisory.
- Validated by `tests/pre-commit-gate-behavior.ps1` (53/53),
  `tests/scrub-behavior.ps1` (48/48), `tests/loop-rollback-behavior.ps1`
  (50/50), `tests/harness-audit-behavior.ps1` (48/48),
  `scripts/validate-frontmatter.ps1` (635/0/0), `scripts/validate-references.ps1`
  (0 broken of 1223 links), and an independent review scoring 89/100 against
  `evaluation/rubrics/code-quality.md` with zero HIGH and zero MEDIUM findings.

## Why It Matters

This applies to every gate that iterates: lint runners, formatters, secret
scanners, doc validators. It also applies whenever a team believes a process is
too strict: measure which of its costs is real before relaxing its rules,
because relaxing the rule and removing the cost are frequently unrelated edits.

## Promotion Path

When confidence reaches >= 0.8 with at least 3 observations, this learning is
auto-promoted to `memories/conventions.md` and may be referenced in
`.github/instructions/project-conventions.instructions.md`.

## Related

- ADR(s): none
- Review(s): independent review and scored rubric report, archived to the
  git-ignored loop state under `.frontier/state/loop-evidence/`
- Other LEARNING(s): [LEARNING-428](LEARNING-428.md), same issue, different
  lesson (depth-derived paths during the runtime relocation)
