# Code Review: Agents Window + loop-runtime extraction

**Story**: #400
**Refs**: SPEC-400 (Agents Window), SPEC-401 (loop-runtime extraction)
**Engineer**: jnPiyush
**Reviewer**: AgentX Auto-Fix Reviewer
**Commit SHA**: d4be343
**Review Date**: 2026-06-05
**Mode**: agentx

---

## 1. Scope

Deep re-review of the SPEC-400 Agents Window slice plus the SPEC-401 framework-free
loop-runtime extraction in `vscode-extension/src/runtime/`. The runtime mirrors the
PowerShell source of truth in `.agentx/agentx-cli.ps1` and MUST stay in parity with it.

Files in scope:

- `vscode-extension/src/runtime/loopState.ts` (new framework-free loop health logic)
- `vscode-extension/src/runtime/index.ts` (barrel exports)
- `.agentx/agentx-cli.ps1` (PowerShell source of truth)
- `scripts/validate-frontmatter.ps1` (YAML list parser)
- `vscode-extension/src/test/utils/loopStateChecker.test.ts` (regression tests)

---

## 2. Decision

**Status**: [PASS] APPROVED
**Confidence Level**: High
**Recommendation**: Merge (human approval still required before merge)

All HIGH and MEDIUM findings are resolved. Remaining items are accepted tradeoffs
(LOW-2) or process notes (MEDIUM-2) or non-issues (LOW-3).

---

## 3. Findings

### HIGH-1 (RESOLVED) -- TS/PS iteration-0 health parity gap

`getLoopHealth` in `loopState.ts` flagged a freshly started loop (iteration 0) as
`stuck`, while the PowerShell `Get-LoopStateHealth` treats it as healthy. The counter
branch read `state.iteration <= 0` instead of `state.iteration < 0`, diverging from the
PS source of truth (`$iteration -lt 0`).

- Before: `if (state.maxIterations <= 0 || state.iteration <= 0)`
- After:  `if (state.maxIterations <= 0 || state.iteration < 0)`
- Parity: comment added referencing `Get-LoopStateHealth` (`$iteration -lt 0`).
- Regression: `getLoopHealth` describe block with a NON-EMPTY history state so the
  empty-history branch does not mask the counter branch.

### MEDIUM-1 (RESOLVED) -- review-gate regex stricter than documented

The subagent-review gate matched a broad substring rather than the documented
"contains the word review". Tightened to a word-boundary match in BOTH surfaces:

- TS `hasSubagentReviewIteration`: `/\breview\b/i.test(summary)`
- PS `Test-LoopHasSubagentReviewIteration`: `'\breview\b'`
- Parity comments reference copilot-instructions / AGENT-PROTOCOL.
- Regression: `hasSubagentReviewIteration` describe block (true for "Final review pass"
  and "Subagent Review:", false when absent).

### MEDIUM-2 (ACCEPTED -- process) -- mixed SPEC-400 + SPEC-401 slices

The changeset mixes the Agents Window feature with the loop-runtime extraction.
Recommend splitting into separate commits for cleaner history. Process-only; no code
change required.

### LOW-1 (RESOLVED) -- column-0 YAML list parser bug

`Get-YamlListItems` in `validate-frontmatter.ps1` had a typo (`new =` instead of
`$next =`) and a break condition that terminated valid column-0 `- item` sequences.

- Fixed: `$next = ...`; break condition now
  `if ($next -match '^\S' -and $next -notmatch '^-\s') { break }`.
- Verified: validator reports 475 passed, 0 warnings, 0 errors.

### LOW-2 (ACCEPTED -- tradeoff) -- added-lines-only scan in score-output.ps1

`score-output.ps1` scans only added lines. Accepted tradeoff for performance.

### LOW-3 (NON-ISSUE) -- extension id casing

`jnPiyush.agentx` casing is correct; no change required.

---

## 4. What Was Verified as Correct

- `getLoopHealth` branch order matches PS: issue mismatch -> stale; missing/invalid
  timestamp -> stale; counter -> stuck; active wrong-status -> stuck; empty-history ->
  stuck; forward-history -> further checks; stale-age branch.
- Framework-free runtime keeps no `fs`/`path`/`vscode` dependencies.
- Barrel exports expose `getLoopHealth`, `hasSubagentReviewIteration`, `LoopState`,
  `LoopHealth`, `LoopHealthKind`.

---

## 5. Auto-Applied Fixes

| Finding | Surface | Before | After |
|---------|---------|--------|-------|
| HIGH-1 | loopState.ts | `iteration <= 0` | `iteration < 0` (+ parity comment) |
| MEDIUM-1 | loopState.ts | broad substring | `/\breview\b/i` |
| MEDIUM-1 | agentx-cli.ps1 | broad substring | `'\breview\b'` |
| LOW-1 | validate-frontmatter.ps1 | `new =` + bad break | `$next =` + corrected break |

Regression tests added: `getLoopHealth` (3) and `hasSubagentReviewIteration` (3) in
`loopStateChecker.test.ts`.

---

## 6. Verification Evidence

| Check | Result |
|-------|--------|
| `tsc --noEmit` | CLEAN |
| Full mocha suite | 904 passing, 0 failing |
| `tests/loop-parity-behavior.ps1` | 27/27 PASS |
| `tests/test-framework.ps1` | 134/134 PASS |
| `scripts/validate-frontmatter.ps1` | 475 passed, 0 warn, 0 err |
| `scripts/check-harness-compliance.ps1` | PASS |
| `scripts/scrub.ps1` (changed files) | 0 findings |

---

## 7. Delivery Report

| Check | Result |
|-------|--------|
| Decision | APPROVED |
| HIGH findings | 0 remaining |
| MEDIUM findings | 0 remaining (1 auto-fixed, 1 process-accepted) |
| LOW findings | 3 (1 auto-fixed, 1 accepted, 1 non-issue) |
| Safe auto-fixes applied | 4 |
| Tests after auto-fixes | PASS |
| AgentX quality loop | Complete |
