---
name: "scrub"
description: "Scan recent changes for AI-generated slop -- redundant comments, over-abstraction, generic UI defaults, duplicate logic, and design tells -- and optionally apply safe fixes. Use when reviewing a code-generation or refactor pass, before a commit, PR, or merge."
user-invocable: false
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-02"
  updated: "2026-05-02"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Scrub

## Core Rules

Presentation only, never behavior: comment rot, over-abstraction, generic design defaults, AI filler, and duplicate logic (single-file and cross-file) are in scope; anything that changes runtime semantics is not. **MANDATORY** on every AgentX run that changes files (`... -> implement -> scrub -> test -> review -> ship`); `ship.ps1` always runs it and ignores `-SkipScrub`. See `.github/instructions/project-conventions.instructions.md`.

## When to Use / Not Use

Use after generation, refactor, or a large patch; before a PR or review handoff; after approval but before merge; periodically on machine-heavy directories. No prerequisites -- it runs standalone through the AgentX CLI.
Skip during active debugging, on intentionally machine-owned output (build artifacts, OpenAPI clients), on vendored files, or as a substitute for behavioral review.

## What Counts As Slop

| Category | Example | Action |
|----------|---------|--------|
| Comment rot | `// This function handles X`, naked `// TODO` | Delete |
| Obvious restatement | `// Increment counter` above `counter++` | Delete |
| Dead code | 4+ commented-out code lines | Delete |
| AI filler | Empty "Note that"/"To"/"Next" phrasing | Rewrite/delete |
| Duplicate logic | Repeated normalized blocks, in-file or cross-file | Flag only |
| Over-abstraction | Single-use interface/factory/getter-only class | Flag only |
| Generic UI | Purple/blue gradient defaults, lorem ipsum | Flag only |
| Stale boilerplate | `Created by ... on ...` | Delete |
| Empty try/catch | `catch (e) { }` with no logging | Flag |

Presentation only; runtime changes go to the reviewer, not scrub.

## Cross-File Duplicate Logic

Directory scans compare normalized 5-line windows across every file, not just within one. Each `duplicate-logic` finding carries both `file`/`line` (the duplicate) and `originalFile`/`originalLine` (the earliest occurrence); other categories emit these two fields as `null`. Traversal is deterministic -- skip-dirs pruned before descending, entries sorted ordinally, reparse points never followed -- so results repeat exactly every run. Adjacent overlapping windows collapse into one finding spanning the full range. Matches only occur within the same language group (ts/tsx/js/jsx together, never vs. py/cs).

**Ignored as false positives**: structural-only/short blocks (<4 distinct non-keyword tokens), declarative `key: value`/string-list data, vendor/generated dirs (`node_modules`, `dist`, `build`, `.git`, `coverage`; see `$SkipDirs`), and anything behind a symlink or junction.

**Not implied by a match**: authorship -- can't be inferred from repeated text; a defect -- shared logic can be intentional; or correctness -- zero findings means none was found, not that code is safe. Never auto-rewritten -- flag-only always; `-Production` only changes whether it blocks the gate.

## Failure Modes: Scan Failures Are Explicit

A missing or unreadable target or nested file fails (exit 2, stderr), never a partial clean result. `-Json` stays an array for zero, one, or many findings on successful scans. Incomplete scans emit no success-shaped findings array.

## Decision Tree

No qualifying change -> skip. Otherwise scan: flag-only findings need human triage; safe-fix findings can run with `-Fix` and be reviewed before commit.

## Workflow

1. **Scan** via the CLI so it resolves in zero-copy workspaces: `pwsh .agentx/agentx.ps1 scrub -Path src/components`. Production gate (blocks release): `pwsh .agentx/agentx.ps1 deslop -Path src/components -Production` (`antislop` is the same alias).
2. **Triage**: each finding has file/line, category, severity (HIGH auto-fixable, MEDIUM opinionated fix, LOW manual review), snippet, safe-fix flag, and for `duplicate-logic` the original location. `-Production` also blocks on `empty-catch`, `generic-gradient`, and `ai-filler`.
3. **Fix safe categories**: `pwsh .agentx/agentx.ps1 scrub -Path src/components -Fix` applies comment rot, obvious restatement, stale headers, and dead code. Everything else stays flag-only, requiring manual judgment.
4. **Verify**: run tests (behavior must not change); re-scan (remaining findings are the manual-triage list); re-run `-Production` for release candidates; commit as `chore: scrub <area>`.

## Done Criteria

Complete scan, zero HIGH findings and zero required production blockers; tests still pass; the `-Fix` diff is small and mechanical; no behavior change. False positives need documented review, not a silent waiver.

## Anti-Patterns

- Running `-Fix` before reading the report
- Suppressing findings instead of fixing them
- Using scrub to refactor logic -- it is a presentation pass only
- Treating LOW findings as mandatory
- Treating `duplicate-logic` as proof of AI authorship or a defect, or auto-extracting/rewriting the flagged code

## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "The scanner flagged it twice, so it must be AI-written." | A match is evidence for review, not proof of authorship or a defect; `duplicate-logic` stays flag-only -- never auto-rewrite. |

## Related Skills

- [Code Hygiene](../code-hygiene/SKILL.md) -- cleanup discipline
- [Code Review](../code-review/SKILL.md) -- behavioral review
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md) -- prevents slop
