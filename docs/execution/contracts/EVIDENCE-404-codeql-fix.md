# Evidence Summary: PR 404 CodeQL Fix

## Scope

Replace unanchored installer-URL regular expressions in the version stamper with exact,
version-bound literal rewrites while preserving current-version and future-version stamping.

## Implementation

- `scripts/stamp-version.js` validates the current version, constructs exact URL edits, and
  preflights every required literal before the first repository write.
- Guide, PowerShell installer, and Bash installer URLs use all-occurrence literal replacement.
- Non-URL version fields retain their existing bounded regular expressions.
- `tests/test-framework.ps1` asserts all preflight calls, all literal update calls, and the
  absence of the vulnerable URL-regex shape.

## Verification

- `node --check scripts/stamp-version.js`: passed.
- Idempotent `--set 8.7.0`: passed without additional source changes.
- Disposable `8.7.0 -> 8.8.0` test: all 2 guide PowerShell, 3 guide Bash, 3
  PowerShell installer, and 1 Bash installer URL occurrences were replaced.
- Four missing-literal cases failed before any file was modified.
- Installer URL regex audit: zero matching regexes remain.
- Framework regression suite: 163/163 passed.
- `git diff --check`: passed.
- The final reviewed working tree contains only the stamper, framework assertions, and this
  evidence artifact; version stamping at 8.7.0 remains idempotent.
- Final AgentX Reviewer decision: APPROVED with 0 HIGH, 0 MEDIUM, and 0 LOW findings.

## Outcome

The two GitHub Advanced Security URL-regex alerts are removed at source. The replacement is
exact, fail-before-write, all-occurrence, future-version verified, and independently approved.
- Targeted scrub reported 17 `duplicate-logic` heuristics in the stamper's declarative edit
  descriptor tables, including pre-existing version fields outside this fix. Release-owner
  waiver: these are intentionally repeated data records, not duplicated executable security
  logic; refactoring the release stamper to silence the heuristic would exceed the two-alert
  remediation scope. Independent review confirmed 0 HIGH, 0 MEDIUM, and 0 LOW findings.
- Karpathy self-check confirmed the change is limited to the alerted URL rewrite mechanisms,
  fail-before-write preflight, and focused regression assertions.
