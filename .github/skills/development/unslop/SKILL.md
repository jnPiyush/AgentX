---
name: "unslop"
description: "Scan recent changes for AI-generated slop -- redundant comments, over-abstraction, generic UI defaults, and design tells -- and optionally apply safe automated fixes. Use after a code-generation or refactor pass to remove the visible signs of machine authorship before review."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-05-02"
  updated: "2026-05-02"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Unslop

> **Purpose**: Detect and remove the visible tells of AI-generated code without changing behavior.
> **Scope**: Comment rot, over-abstracted code, generic design defaults, AI filler phrasing.

---

## When to Use This Skill

- Right after a code generation, refactor, or large patch
- Before opening a pull request or a review handoff
- After review approval but before merge -- final polish pass
- Periodically on a directory that has accumulated machine output

## When NOT to Use

- During active debugging -- focus on correctness first
- On generated code that is intentionally machine-owned (build output, OpenAPI clients)
- On vendored third-party files
- As a substitute for code review -- unslop catches presentation, review catches behavior

---

## What Counts As Slop

| Category | Examples | Action |
|----------|----------|--------|
| Comment rot | `// This function handles the logic for X`, `// Helper to do thing`, naked `// TODO` | Delete |
| Restating the obvious | `// Increment counter` above `counter++` | Delete |
| AI filler phrasing | "It is important to note that", "In order to", "We will now" in docs | Rewrite or delete |
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

Run the scanner over the directory or files that changed:

```pwsh
pwsh scripts/unslop.ps1 -Path src/components
```

The scanner walks the path, parses comments and content by file extension, and prints findings grouped by category and severity. It does not modify any file in scan mode.

### 2. Triage

Read the report. Each finding includes:

- File path and line number
- Category and severity
- The exact text that triggered detection
- Whether the category is safe to auto-fix

Findings come in three severities:

| Severity | Meaning |
|----------|---------|
| HIGH | Almost certainly slop. Auto-fix is safe in supported categories. |
| MEDIUM | Likely slop. Auto-fix is opinionated; review the diff. |
| LOW | Possible slop. Manual review only. |

### 3. Apply Safe Fixes

Only after reading the report, run with `--fix` to apply the auto-safe categories:

```pwsh
pwsh scripts/unslop.ps1 -Path src/components -Fix
```

Safe-fix categories (v1):

- Comment rot in code files
- Restating the obvious
- Stale `Created by` / `Last modified by` headers

Unsafe categories require manual edits and are flag-only:

- Over-abstraction (refactor judgment)
- Generic UI defaults (brand decisions)
- Empty try/catch (might be intentional in narrow cases)

### 4. Verify

After fixes:

- Run the test suite. Behavior must not change.
- Re-run the scanner. The remaining findings are the manual-triage list.
- Commit fixes as a single change with `chore: unslop <area>`.

---

## Done Criteria

- Scanner reports zero HIGH findings, or every HIGH finding has been addressed or explicitly justified
- Tests still pass after fixes
- Diff from `--fix` is small, mechanical, and reviewable line-by-line
- No behavior change introduced

---

## Anti-Patterns

- Running `--fix` without reading the scan report first
- Suppressing findings instead of fixing them
- Using unslop to refactor logic -- it is a presentation pass only
- Treating LOW findings as required fixes -- they are signals, not gates

---

## Related Skills

- [Code Hygiene](../code-hygiene/SKILL.md) -- broader cleanup discipline including dead code and over-engineering
- [Code Review](../code-review/SKILL.md) -- behavioral review that runs alongside unslop
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md) -- the underlying behavioral contract that prevents slop in the first place
