---
name: code-hygiene
description: "Three-pass quality sweep detecting over-engineering, stale comments, and generic UI patterns produced during AI-assisted coding sessions. Reports findings with severity and optional safe auto-fix."
---

# Code Hygiene Sweep

Three parallel analysis passes that detect and report common quality issues from AI-assisted coding -- over-engineering, stale or filler comments, and generic UI patterns that signal templated output.

## When to Use

- After completing a feature -- sweep before PR
- Before code review -- pre-clean changed files
- When code feels templated or over-abstracted
- Periodic codebase hygiene on a directory
- After a long AI-assisted session to audit quality

## Argument Parsing

Parse arguments for these tokens:

| Token | Example | Effect |
|-------|---------|--------|
| `fix` | Run with fix mode | Auto-apply safe fixes after reporting |
| `<path>` | `src/components/` | Scope to specific file or directory |
| (none) | Default | Analyze all files changed since the base branch |

## Execution Flow

### Stage 1: Determine Scope

**If a file or directory path is provided:**
Scope to that path. Use glob to list all code files under it.

**If no argument (default):**
Determine changed files since the base branch:

```bash
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/master 2>/dev/null || echo "HEAD~10")
git diff --name-only $BASE
```

**Classify files in scope:**

| File extensions | Passes to run |
|----------------|---------------|
| `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.rs`, `.java`, `.cs`, `.swift`, `.kt` | Code Quality + Comment Quality |
| `.css`, `.scss`, `.less`, `.tsx`, `.jsx`, `.html`, `.vue`, `.svelte` | + UI Quality |
| `.json`, `.yaml`, `.yml`, `.toml`, `.md` | Code Quality + Comment Quality only |

Skip UI Quality pass entirely if no UI/style files are in scope.

### Stage 2: Parallel Analysis

Launch three analysis sub-tasks IN PARALLEL. Each receives the file list and diff content, and returns structured findings as text.

#### Pass 1: Code Quality

Analyze for complexity and abstraction issues:

1. **Unnecessary complexity**
   - Deep nesting (>3 levels) that could use early returns
   - Nested ternary operators
   - Dense one-liners sacrificing readability

2. **Redundant abstractions**
   - Interfaces/types used only once -- inline them
   - Wrapper functions adding no logic
   - Abstract base classes with a single implementation
   - Premature generalization

3. **YAGNI violations**
   - Features not required by current use cases
   - Configuration options nobody uses
   - Generic solutions for specific problems

4. **Dead weight**
   - Commented-out code blocks (>3 lines)
   - Unused imports, variables, or functions
   - Duplicate error checks (caller already validates)
   - Defensive code that can never trigger

5. **Over-engineering**
   - Factory patterns for creating a single type
   - Strategy patterns with one strategy
   - Event systems for synchronous single-consumer flows
   - Dependency injection where direct instantiation is clearer

**Output format:** Structured findings with file, line, issue, severity, fix_safe flag, and suggested fix.

#### Pass 2: Comment Quality

Analyze for comment issues:

1. **Obvious restatements**
   - `// increment counter` above `counter++`
   - Comments repeating the function/variable name in prose

2. **AI-generated filler phrases** (hard bans)
   - "This function is responsible for handling..."
   - "The following code implements..."
   - "This is a comprehensive solution that..."
   - "This method provides a robust and scalable..."
   - "leverages" or "utilizes" (when "uses" works)
   - "seamlessly integrates"
   - "This class encapsulates the logic for..."

3. **Factual inaccuracy**
   - Documented parameters not matching the signature
   - Return type descriptions not matching the actual return
   - Edge case documentation for cases not handled

4. **Stale comments**
   - TODOs/FIXMEs for completed work
   - References to removed/renamed functions
   - Version-specific notes for unsupported versions
   - "Temporary" markers on permanent code

5. **Over-documentation**
   - JSDoc/docstrings on trivial getters/setters
   - Multi-line comments on self-explanatory one-liners
   - Repeating type information already in the signature

#### Pass 3: UI Quality (only when UI files in scope)

Analyze UI files for generic, templated patterns:

1. **Generic color patterns**
   - Purple-to-blue gradients (AI default palette)
   - Gratuitous gradients on everything
   - Unintentional color usage (decorative, not semantic)

2. **Template layouts**
   - Default card grids with uniform spacing and no hierarchy
   - Generic hero sections with no point of view
   - Uniform radius, spacing, and shadows across every component

3. **Missing interaction states**
   - No hover states on interactive elements
   - No focus states (accessibility gap)
   - No loading/empty/error states

4. **Lazy defaults**
   - Unmodified library defaults with no customization
   - Default font stacks with no intentional pairing
   - Excessive scroll-triggered animations

5. **No visual hierarchy**
   - Flat layouts with no layering or depth
   - Uniform emphasis on everything
   - No intentional rhythm in spacing

### Stage 3: Merge and Deduplicate

1. Collect findings from all passes that ran
2. Deduplicate: if two passes flag the same file+line (within 3 lines), keep the more specific finding
3. Sort by severity: High -> Medium -> Low
4. Group by pass for the report

### Stage 4: Present Report

Format the consolidated report:

```
Code Hygiene Report
===================
Scope: [N] files changed since [base]
Passes: Code Quality [Y/N] | Comment Quality [Y/N] | UI Quality [Y/skipped]

## Code Quality ([N] findings)

| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|

## Comment Quality ([N] findings)

| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|

## UI Quality ([N] findings)

| # | File | Line | Issue | Severity |
|---|------|------|-------|----------|

Summary: [N] findings ([H] High, [M] Medium, [L] Low)
```

Omit any pass section with zero findings. If all passes return zero findings:
```
Code Hygiene Report: Clean! No issues detected in [N] files.
```

### Stage 5: Auto-Fix (only if fix mode)

If fix mode was requested:

1. Collect all findings where fix is safe
2. Apply fixes in file order:
   - **Code Quality safe fixes:** Remove commented-out code blocks, remove unused imports
   - **Comment Quality safe fixes:** Delete obvious restatement comments, remove stale TODOs
3. Do NOT auto-fix:
   - UI issues (requires design judgment)
   - Factually inaccurate comments (requires understanding intent)
   - YAGNI violations (requires knowing the roadmap)
   - Abstractions (requires understanding broader architecture)
4. Report what was fixed and what remains for manual review

## Severity Guide

| Level | Meaning | Examples |
|-------|---------|---------|
| **High** | Actively misleading or creates maintenance burden | Inaccurate comment, missing hover states, large dead code block |
| **Medium** | Noticeable quality reduction | Unnecessary abstraction, AI filler phrase, generic gradient |
| **Low** | Minor quality improvement | Restatement comment, unused import, over-documentation |

Issues are never "Critical" -- they are quality concerns, not correctness or security problems.

## Quality Gates

Before presenting findings:

1. Every finding must be actionable -- say what to change and where
2. No false positives from skimming -- verify before flagging
3. Line numbers must be accurate
4. Respect project conventions -- if the project uses JSDoc everywhere, do not flag JSDoc
5. Do not flag generated code in dist/, build/, node_modules/, or similar directories

## Notes

- This skill is read-only by default. It reports but does not edit files unless fix mode is specified.
- UI Quality pass is automatically skipped for backend-only projects.
- Works on any language/framework -- the patterns are universal.
- Pairs well with the code-review skill (which checks correctness) -- code-hygiene checks aesthetics and quality.
