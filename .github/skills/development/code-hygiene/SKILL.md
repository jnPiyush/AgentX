---
name: code-hygiene
description: "Read-only hygiene review that reports cosmetic lint/style findings as LOW advisories and requests explicit approval before cleanup. Genuine defects are assessed separately by impact."
---

# Code Hygiene Sweep

Three parallel analysis passes that detect and report common quality issues from AI-assisted coding -- over-engineering, stale or filler comments, and generic UI patterns that signal templated output.

## Cleanup Boundary

Cosmetic lint/style findings are LOW and do not block local loop/review Done
Criteria. Report file/line, original tool severity, suggestion and scope; do not
clean up automatically. The owning agent explicitly asks whether the user wants
the findings fixed and waits. No response or a decline means leave them unchanged.

Build/type failures and verified correctness, security, reliability or
accessibility defects are not cosmetic lint; classify them separately by impact.
Do not waive independent CI/commit/release gates. Full policy:
`.github/AGENT-PROTOCOL.md` section 4.

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
| `fix` | Explicit request to fix the listed cleanup scope | Apply only after affirmative approval; a role name, quoted/negated word or general bug-fix task is not consent |
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

Run the analysis categories in parallel as described in [Parallel analysis checks](references/analysis-checks.md).

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

Only after the user explicitly approves a specific cleanup scope:

1. Collect only approved findings where the fix is safe
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
| **Low** | Cosmetic hygiene advisory; cleanup is optional | Formatting, naming/style, redundant comments, unused imports that do not block the build |
| **Separate defect** | Classify by verified impact, not by the tool that found it | Build failure, unsafe exception handling, incorrect behavior, security/accessibility violation |

Unverified hygiene candidates stay advisory. Do not disguise a proven defect as
LOW lint or invent a defect merely from a scanner rule name.

## Quality Gates

Before presenting findings:

1. Every finding must be actionable -- say what to change and where
2. No false positives from skimming -- verify before flagging
3. Line numbers must be accurate
4. Respect project conventions -- if the project uses JSDoc everywhere, do not flag JSDoc
5. Do not flag generated code in dist/, build/, node_modules/, or similar directories

## Notes

- This skill is read-only unless the user has explicitly approved the cleanup scope.
- UI Quality pass is automatically skipped for backend-only projects.
- Works on any language/framework -- the patterns are universal.
- Pairs well with the code-review skill (which checks correctness) -- code-hygiene checks aesthetics and quality.
