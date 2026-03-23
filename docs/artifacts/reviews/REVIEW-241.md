# Code Review: feat: autoresearch-inspired loop improvements (outcome, budget, score)

**Story**: impl-autoresearch-loop  **Refs**: N/A (session implementation)
**Engineer**: jnPiyush  **Reviewer**: Code Reviewer Agent  **Base Commit**: ac4aba8  **Review Date**: 2026-03-23

---

## Summary

Three focused additions to the AgentX quality loop, inspired by the Karpathy autoresearch
loop pattern:

1. **`outcome` field** -- Per-iteration outcome (`pass`/`fail`/`partial`) on history entries and on all 5 CLI loop commands.
2. **`budgetMinutes` field** -- Optional time budget on `LoopState`; live remaining/exceeded display in both the TypeScript `getLoopStatusDisplay()` export and the PowerShell CLI; new `isBudgetExceeded()` export.
3. **`harnessScore` field** -- Auto-captured harness audit score per `loop iterate`; score trend (latest + delta) shown in `getLoopStatusDisplay()` and the CLI status command.

Changed files: `vscode-extension/src/utils/loopStateChecker.ts`, `vscode-extension/src/test/utils/loopStateChecker.test.ts`, `.agentx/agentx-cli.ps1`.

All changes are fully backward-compatible with existing loop state files.

---

## Checklist Results

| Category | Result | Notes |
|----------|--------|-------|
| Spec Conformance | PASS | No formal spec; implementation matches the stated plan (3 phases, no over-engineering) |
| Code Quality | PASS | Clean TS helpers, consistent naming, private helper functions well-scoped |
| Testing | PASS | 16 new tests; 563/563 total pass; boundary and backward-compat cases covered |
| Security | PASS | No secrets, no injection surface, no SSRF; CLI input defaults safely |
| Performance | PASS | No blocking I/O in hot path; all helpers are O(n) on small history arrays |
| Error Handling | PASS | All Parse/Date.parse failures guarded (NaN check, try/catch in PS); bad input silently defaults |
| Documentation | PASS | New exports have JSDoc comments; interface fields have inline JSDoc |
| Intent Preservation | PASS | Minimal additions; original loop API entirely preserved |

---

## Functional Review

### TypeScript -- `loopStateChecker.ts`

**`getBudgetRemainingMs(state, nowMs)`**
- Guards `typeof state.budgetMinutes !== 'number' || state.budgetMinutes <= 0` -- correct; rejects zero and negative budgets.
- Guards `Number.isNaN(startMs)` -- correct; handles corrupt `startedAt` values.
- Boundary: `remainingMs = 0` at exact expiry -- treated as exceeded (`<= 0`). Consistent with `isBudgetExceeded` test `returns true when budget is exactly at boundary`. [Confidence: HIGH]

**`getBudgetSuffix(state, nowMs)`**
- Returns `(budget exceeded)` or `(Nm remaining)` or `''`. Clear, functional. [Confidence: HIGH]

**`getScoreTrendSuffix(state)`**
- Correctly filters history for entries with a numeric `harnessScore`.
- Delta calculation and `+`/`-`/`=` arrow is functionally correct.
- Output for delta=0: `[score: 60 (=0)]` -- see Finding-1 (Minor). [Confidence: HIGH]

**`isBudgetExceeded(workspaceRoot)`**
- Returns false on missing state, false on missing budget, true when `remainingMs <= 0`. Clean export. [Confidence: HIGH]

**`getLoopStatusDisplay()` integration**
- `budgetSuffix` appended only on active-loop paths. Inactive/complete loops show `scoreSuffix` only. This is intentional and reasonable -- budget alerts are actionable only during active loops. [Confidence: MEDIUM]

### PowerShell -- `agentx-cli.ps1`

**Backward compat pattern**
- All new property reads use `$state.PSObject.Properties.Name -contains 'propName'` guard before access. Correct and consistent across all 5 loop commands. [Confidence: HIGH]

**`Invoke-LoopStart` `--budget` parsing**
- `$budget = if ($budgetRaw) { [int]$budgetRaw } else { $null }` -- see Finding-2 (Nit). [Confidence: HIGH]

**`Invoke-LoopIterate` harness score capture**
- `Get-HarnessAuditChecks $Script:ROOT` wrapped in try/catch; score only added to entry if non-null via `Add-Member`. Correct. [Confidence: HIGH]

**Outcome validation**
- `$outcome = if ($outcomeRaw -in @('pass', 'fail', 'partial')) { $outcomeRaw } else { 'partial' }` -- silently defaults invalid input to `partial`. Acceptable for an internal CLI. [Confidence: HIGH]

**Loop lifecycle outcomes**
- Start initial entry: `partial` -- correct (loop just begun).
- Iterate entry: caller-supplied `outcome` -- correct.
- Complete entry: `pass` -- correct.
- Cancel entry: `fail` -- correct.
- Auto-reset stale entry: `fail` -- correct.
- Max-iterations guard: `fail` -- correct.

### Tests -- `loopStateChecker.test.ts`

16 new tests across 3 new describe blocks:

| Block | Tests | Coverage |
|-------|-------|---------|
| `getLoopStatusDisplay` extensions | 6 | Budget remaining, budget exceeded, no budget, harness score with delta, single score, no score |
| `isBudgetExceeded` | 5 | No state, no budget, under budget, over budget, at exact boundary |
| `LoopState history fields` | 5 | Read outcome, read harnessScore, backward compat (no fields), budgetMinutes round-trip, missing budgetMinutes |

Missing: test for delta=0 score trend -- see Finding-3 (Minor).

---

## Findings

### Finding-1 -- Minor -- Zero delta display format

**Location**: `vscode-extension/src/utils/loopStateChecker.ts` L150, `.agentx/agentx-cli.ps1` Invoke-LoopStatus

**Description**: When harness score does not change between iterations, the delta line renders as `[score: 60 (=0)]` (TS) and `60 (=0 from prev)` (PS). The `=0` format is slightly awkward; a reader may expect `(no change)` or `(+/-0)` omitted.

**Recommendation**: Either omit the parenthetical entirely when `delta === 0` (return `[score: ${latest}]`), or use `(nc)`. Not blocking -- the current output is unambiguous. Confidence: HIGH

### Finding-2 -- Nit -- Non-numeric `--budget` input not validated in PS

**Location**: `.agentx/agentx-cli.ps1` `Invoke-LoopStart`

**Description**: `[int]$budgetRaw` will throw a PowerShell type-cast exception for inputs like `--budget foo`. The command exits with a red runtime error rather than a clean validation message.

**Recommendation**: Wrap with `[int]::TryParse($budgetRaw, [ref]$parsed)` or a `try { $budget = [int]$budgetRaw } catch { Write-Error "Budget must be a number"; return }` guard. Confidence: HIGH

### Finding-3 -- Minor -- No test for delta=0 score trend

**Location**: `vscode-extension/src/test/utils/loopStateChecker.test.ts`

**Description**: The `getScoreTrendSuffix` zero-delta path (`=0`) is exercised in theory but has no dedicated test. If the format is later changed (e.g., to omit zero delta), a regression would go undetected.

**Recommendation**: Add a test using two history entries with equal `harnessScore` values and assert the output format. Not blocking given current passing suite. Confidence: HIGH

---

## Decision

**APPROVED**

No Critical or Major findings. Three Minor/Nit findings are advisory and do not affect correctness, security, or backward compatibility. The implementation is clean, well-tested, and fully backward-compatible with pre-existing loop state files.

**Engineer recommended actions (non-blocking)**:
- Finding-1: Consider cleaner zero-delta display format in a follow-up commit.
- Finding-2: Add `[int]::TryParse` guard or try/catch around `--budget` parsing.
- Finding-3: Add a delta=0 test case to the score trend test block.

---

*Review loop: 3/10 iterations, gate SATISFIED, harness score: 60. Approved by Code Reviewer Agent.*
