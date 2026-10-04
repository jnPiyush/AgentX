---
name: "scrub"
description: "Inspect code hygiene without automatic cleanup. Use advisory mode in local loops/reviews, report cosmetic findings as LOW, and request explicit user approval before safe fixes. Preserve independent strict gates."
user-invocable: false
metadata:
  author: "Frontier"
  version: "1.0.0"
  created: "2026-05-02"
  updated: "2026-05-02"
compatibility:
  frameworks: ["frontier", "copilot", "claude-code"]
---

# Scrub

## Core Rules

Local loop/review scrubs are read-only advisory scans. Cosmetic lint/style
findings are LOW and are not Done Criteria. Report them and explicitly ask the
user before cleanup; no answer is not approval. Use `-Advisory`, never `-Fix`
during the unapproved scan. See `.github/AGENT-PROTOCOL.md` section 4.

Do not reclassify real build, correctness, security, reliability or accessibility
defects as cosmetic lint. Independent default/production, CI and commit gates
remain unchanged; report their failures rather than claiming they passed.

## When to Use / Not Use

Use after generation, refactor, or a large patch; before a PR or review handoff; after approval but before merge; periodically on machine-heavy directories. No prerequisites -- it runs standalone through the Frontier CLI.

## When NOT to Use

- During active debugging -- focus on correctness first
- On generated code that is intentionally machine-owned (build output, OpenAPI clients)
- On vendored third-party files
- As a substitute for code review -- scrub catches presentation, review catches behavior

---

## What Counts As Slop

| Category | Examples | Proposed cleanup after approval |
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
   +- Cosmetic findings -> LOW report; explicitly ask before cleanup
   +- No findings -> done
```

---

## Workflow

### 1. Scan

Run the scanner over the directory or files that changed. Invoke it through the Frontier CLI so it resolves the bundled scanner in zero-copy workspaces (a literal `scripts/scrub.ps1` path does not exist there):

```pwsh
pwsh .frontier/runtime/frontier.ps1 scrub -Path src/components -Advisory
```

Advisory mode preserves `originalSeverity`, `safeFix` capability and
`productionBlocker` metadata. It reports local candidates as LOW and exits
successfully after a complete scan, not because the code is lint-clean.
Missing/unreadable targets still fail. `-Advisory` rejects `-Fix` and
`-Production` combinations.

Separate production checks retain their stricter behavior:

```pwsh
pwsh .frontier/runtime/frontier.ps1 deslop -Path src/components -Production
pwsh .frontier/runtime/frontier.ps1 antislop -Path src/components -Production
```

`deslop` and `antislop` are aliases for the same scanner. Preserve the original
strict-gate result in reports. `-Production` retains these blocking categories:

| Category | Why It Blocks Production |
|----------|--------------------------|
| `duplicate-logic` | Repeated validation, mapping, parsing, or error handling can drift after release. |
| `empty-catch` | Swallowed failures hide production incidents and make support harder. |
| `generic-gradient` | AI-default UI styling is not release-ready without product/design intent. |
| `ai-filler` | Filler copy in release docs or product surfaces weakens operator trust. |

### 2. Report and Ask

Report LOW cosmetic findings with their locations and original tool severities.
Exclude intentional fixtures and false positives from cleanup recommendations.
Ask, "Would you like me to fix these lint/style findings?" and name the proposed
scope. Do not make cleanup a prerequisite for the completed implementation.
No response or a decline leaves the findings unchanged.

### 3. Apply Safe Fixes

Only after reporting findings and receiving explicit user approval for the
specific cleanup scope, run `-Fix` in a separate bounded task:

```pwsh
pwsh .frontier/runtime/frontier.ps1 scrub -Path src/components -Fix
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

- Use non-test verification during the cleanup loop; offer suites only after
  completion and separate approval under the test-consent policy.
- Re-run the scanner. The remaining findings are the manual-triage list.
- For release candidates, re-run with `-Production` and clear or justify every production blocker.
- Commit fixes as a single change with `chore: scrub <area>`.

---

## Done Criteria

- Local advisory scan is complete and findings are reported; cosmetic cleanup
  is not required for local completion
- Production-release runs report zero production blockers, or every blocker has a documented release-owner waiver
- No cleanup occurred without approval; unexecuted tests remain not run
- Diff from `--fix` is small, mechanical, and reviewable line-by-line
- No behavior change introduced

---

## Anti-Patterns

- Running `--fix` or a formatter without explicit cleanup approval
- Hiding findings or reporting an advisory exit code as clean lint
- Using scrub to refactor logic -- it is a presentation pass only
- Treating LOW findings as required fixes -- they are signals, not gates

---

## Related Skills

- [Code Hygiene](../code-hygiene/SKILL.md) -- broader cleanup discipline including dead code and over-engineering
- [Code Review](../code-review/SKILL.md) -- behavioral review that runs alongside scrub
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md) -- the underlying behavioral contract that prevents slop in the first place
