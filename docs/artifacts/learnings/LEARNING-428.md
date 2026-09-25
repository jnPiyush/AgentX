---
description: 'Relocating a tracked runtime tree requires re-basing relative links and re-checking every call site that derives a root from script location.'
confidence: 0.5
observations: 1
status: draft
category: refactoring
---

# LEARNING-428: Relocating A Runtime Tree Breaks Depth-Derived Paths Silently

**Date**: 2026-09-25
**Issue**: #428
**Category**: refactoring
**Confidence**: 0.5  (auto-promote at >= 0.8)
**Observations**: 1

## Context

The Frontier runtime moved from `.agentx/` to `.frontier/runtime/`, adding one
directory level. The user directive was explicit: no backward compatibility. A
`git mv`-style relocation plus a text replacement of the old path looked
complete and all unit suites passed, but two whole classes of defect survived
that sweep because neither is a literal occurrence of the old path.

## Learning

When a tracked tree moves to a different depth, a path-string search is not
sufficient. Two additional sweeps are mandatory:

1. **Relative links in relocated files.** Every `../` chain inside a moved file
   is now under-resolved by the number of levels gained. Run the repository link
   validator after the move, not just before.
2. **Roots derived from script location.** Search the moved files for
   `$PSScriptRoot`, `__dirname`, `Split-Path -Parent`, `dirname "$0"` and every
   equivalent. These compute a root by counting levels up and are invisible to a
   path-string search. When one file has several such call sites, compare them
   against each other: a site that disagrees with its siblings is the bug.

A wrong derived root usually fails far from its cause. `Split-Path -Parent`
returned a wrong-but-plausible directory, so the failure surfaced later as
"agent definition not found" rather than as a path error. Prefer a form that
fails at the point of the mistake.

## Evidence

- `scripts/validate-references.ps1` reported 3 broken links in
  `.frontier/runtime/mcp-server/README.md` after the move; the file had gained a
  level and its `../../` prefixes needed to become `../../../`.
- `.frontier/runtime/agentic-runner.ps1:2572` still resolved the repo root one
  level up while its own siblings at lines 3012 and 4639 already resolved two.
  The intra-file disagreement, not the path text, is what exposed it.
- Validated by `tests/agentic-runner-behavior.ps1` (458/458),
  `scripts/validate-references.ps1` (0 broken of 1224 local links across 493
  files), `npm test` in `vscode-extension/` (1095 passing), and an independent
  review scoring the change 96/100 against `evaluation/rubrics/code-quality.md`.

## Why It Matters

This applies to any move that changes a tracked file's depth: extracting a
subdirectory, vendoring a tool, or promoting a nested folder to the root. It
prevents a migration that passes its own test suite from shipping a runtime that
cannot find its own assets.

## Promotion Path

When confidence reaches >= 0.8 with at least 3 observations, this learning is
auto-promoted to `memories/conventions.md` and may be referenced in
`.github/instructions/project-conventions.instructions.md`.

## Related

- ADR(s): `docs/artifacts/adr/COUNCIL-428-frontier-corp-rebrand.md`
- Review(s): independent review and scored rubric report, archived to the
  git-ignored loop state under `.frontier/state/loop-evidence/`
- Other LEARNING(s): none
