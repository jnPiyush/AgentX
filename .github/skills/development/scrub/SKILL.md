---
name: "scrub"
description: "Scan recent changes for AI-generated slop -- redundant comments, over-abstraction, generic UI defaults, and design tells -- and optionally apply safe automated fixes. Use after a code-generation or refactor pass to remove the visible signs of machine authorship before review."
user-invocable: false
metadata:
  author: "Frontier"
  version: "1.0.0"
  created: "2026-05-02"
  updated: "2026-05-02"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Scrub

## Core Rules

Presentation only, never behavior: comment rot, over-abstraction, generic design defaults, AI filler, and duplicate logic (single-file and cross-file) are in scope; anything that changes runtime semantics is not. **MANDATORY** on every Frontier run that changes files (`... -> implement -> scrub -> test -> review -> ship`); `ship.ps1` always runs it and ignores `-SkipScrub`. See `.github/instructions/project-conventions.instructions.md`.

## When to Use / Not Use

Use after generation, refactor, or a large patch; before a PR or review handoff; after approval but before merge; periodically on machine-heavy directories. No prerequisites -- it runs standalone through the Frontier CLI.

## When NOT to Use

- During active debugging -- focus on correctness first
- On generated code that is intentionally machine-owned (build output, OpenAPI clients)
- On vendored third-party files
- As a substitute for code review -- scrub catches presentation, review catches behavior

---

## What Counts As Slop

| Category | Examples | Action |
|----------|----------|--------|
| Comment rot | `// This function handles the logic for X`, `// Helper to do thing`, naked `// TODO` | Delete |
| Restating the obvious | `// Increment counter` above `counter++` | Delete |
| Dead code | Commented-out code blocks of 4+ code-like lines | Delete |
| AI filler phrasing | Phrases like "Note that", "To", or "Next" when they add no meaning | Rewrite or delete |
| Duplicate logic | Repeated normalized code blocks within one file | Consolidate manually (flag only) |
| Over-abstraction | Single-use interface, factory wrapping one constructor, getter-only class | Inline manually (flag only) |
| Generic UI defaults | `bg-gradient-to-r from-purple-500 to-blue-500`, placeholder lorem ipsum | Replace with brand palette (flag only) |
| Stale boilerplate | `Created by ... on ...`, `Last modified by ...` | Delete |
| Empty try/catch | `catch (e) { /* ignore */ }` with no logging | Flag for review |

Code-slop is about presentation, not behavior. Anything that changes runtime semantics is out of scope -- send it to the reviewer.

---

## Decision Tree

```
Recent diff contains machine-generated text?
+- No -> skip
+- Yes -> run scanner
   +- Findings, all in flag categories -> human triage required
   +- Findings, some in safe-fix categories -> run with --fix, review the diff
   +- No findings -> done
```

---

## Workflow

### 1. Scan

Run the scanner over the directory or files that changed. Invoke it through the agentx CLI so it resolves the bundled scanner in zero-copy workspaces (a literal `scripts/scrub.ps1` path does not exist there):

```pwsh
pwsh .agentx/agentx.ps1 scrub -Path src/components
```

For production-release readiness, use the stricter production gate. It keeps
normal scrub behavior advisory for MEDIUM/LOW findings, but blocks release on
categories that commonly turn generated code into production maintenance risk:

```pwsh
pwsh .agentx/agentx.ps1 deslop -Path src/components -Production
pwsh .agentx/agentx.ps1 antislop -Path src/components -Production
```

`deslop` and `antislop` are CLI aliases for the same scanner. Use `deslop` when
the main concern is production code hygiene, and `antislop` when the1. **Scan** via the CLI so it resolves in zero-copy workspaces: `pwsh .agentx/frontier.ps1 scrub -Path src/components`. Production gate (blocks release): `pwsh .agentx/frontier.ps1 deslop -Path src/components -Production` (`antislop` is the same alias).
2. **Triage**: each finding has file/line, category, severity (HIGH auto-fixable, MEDIUM opinionated fix, LOW manual review), snippet, safe-fix flag, and for `duplicate-logic` the original location. `-Production` also blocks on `empty-catch`, `generic-gradient`, and `ai-filler`.
3. **Fix safe categories**: `pwsh .agentx/frontier.ps1 scrub -Path src/components -Fix` applies comment rot, obvious restatement, stale headers, and dead code. Everything else stays flag-only, requiring manual judgment.
 findings plus these
production-blocking advisory categories:

| Category | Why It Blocks Production |
|----------|--------------------------|
| `duplicate-logic` | Repeated validation, mapping, parsing, or error handling can drift after release. |
| `empty-catch` | Swallowed failures hide production incidents and make support harder. |
| `generic-gradient` | AI-default UI styling is not release-ready without product/design intent. |
| `ai-filler` | Filler copy in release docs or product surfaces weakens operator trust. |

### 3. Apply Safe Fixes

Only after reading the report, run with `-Fix` to apply the auto-safe categories:

```pwsh
pwsh .agentx/agentx.ps1 scrub -Path src/components -Fix
```

Safe-fix categories (v1):

- Comment rot in code files
- Restating the obvious
- Stale `Created by` / `Last modified by` headers
- Commented-out code blocks

Unsafe categories require manual edits and are flag-only:

- Duplicate logic (requires refactor judgment)
- Over-abstraction (refactor judgment)
- Generic UI defaults (brand decisions)
- Empty try/catch (might be intentional in narrow cases)

### 4. Verify

After fixes:

- Run the test suite. Behavior must not change.
- Re-run the scanner. The remaining findings are the manual-triage list.
- For release candidates, re-run with `-Production` and clear or justify every production blocker.
- Commit fixes as a single change with `chore: scrub <area>`.

---

## Done Criteria

- Scanner reports zero HIGH findings, or every HIGH finding has been addressed or explicitly justified
- Production-release runs report zero production blockers, or every blocker has a documented release-owner waiver
- Tests still pass after fixes
- Diff from `--fix` is small, mechanical, and reviewable line-by-line
- No behavior change introduced

---

## Anti-Patterns

- Running `--fix` without reading the scan report first
- Suppressing findings instead of fixing them
- Using scrub to refactor logic -- it is a presentation pass only
- Treating LOW findings as required fixes -- they are signals, not gates

---

## Related Skills

- [Code Hygiene](../code-hygiene/SKILL.md) -- broader cleanup discipline including dead code and over-engineering
- [Code Review](../code-review/SKILL.md) -- behavioral review that runs alongside scrub
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md) -- the underlying behavioral contract that prevents slop in the first place
