# Code Review: Epic #47 / Feature #49 Security Hardening (Stories #54, #55, #57)

**Story**: #47
**Feature**: #49
**Epic**: #47
**Engineer**: Engineer Agent
**Reviewer**: Code Reviewer Agent
**Commit SHA**: 16ad85b
**Review Date**: 2026-03-03
**Review Duration**: ~45 minutes

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Code Quality](#2-code-quality)
3. [Architecture & Design](#3-architecture--design)
4. [Testing](#4-testing)
5. [Security Review](#5-security-review)
6. [Performance Review](#6-performance-review)
7. [Documentation Review](#7-documentation-review)
8. [Acceptance Criteria Verification](#8-acceptance-criteria-verification)
9. [Technical Debt](#9-technical-debt)
10. [Compliance & Standards](#10-compliance--standards)
11. [Recommendations](#11-recommendations)
12. [Decision](#12-decision)
13. [Next Steps](#13-next-steps)
14. [Related Issues & PRs](#14-related-issues--prs)
15. [Reviewer Notes](#15-reviewer-notes)

---

## 1. Executive Summary

### Overview
The implementation successfully introduces a layered command-validation utility, a dedicated secret-redaction utility, and test coverage expansion. However, review found security-significant gaps that prevent approval for a P0 hardening milestone.

### Files Changed
- **Total Files**: 8
- **Lines Added**: ~1270
- **Lines Removed**: ~13
- **Test Files**: 3

### Verdict
**Status**: [WARN] CHANGES REQUESTED

**Confidence Level**: High
**Recommendation**: Request changes and re-review

---

## 2. Code Quality

### [PASS] Strengths
1. **Clear security module boundaries**: Validation and redaction logic are separated into dedicated utilities ([commandValidator.ts](../../vscode-extension/src/utils/commandValidator.ts), [secretRedactor.ts](../../vscode-extension/src/utils/secretRedactor.ts)).
2. **Good test breadth for new modules**: Extensive tests added for validation, redaction, and engine integration ([commandValidator.test.ts](../../vscode-extension/src/test/utils/commandValidator.test.ts), [secretRedactor.test.ts](../../vscode-extension/src/test/utils/secretRedactor.test.ts), [toolEngine.test.ts](../../vscode-extension/src/test/agentic/toolEngine.test.ts)).
3. **Most-restrictive-wins behavior present**: Compound commands escalate classification correctly across allowed/confirmation/blocked levels.

### [WARN] Issues Found

| Severity | Issue | File:Line | Recommendation |
|----------|-------|-----------|----------------|
| **High** | Allowlist bypass via bare program entries permits arbitrary argument execution (for example `python -c`, `node -e`) | [commandValidator.ts](../../vscode-extension/src/utils/commandValidator.ts#L289) | Remove broad bare-program auto-allow or restrict with safe-arg policies |
| **High** | Confirmation path emits raw command and meta command without redaction, allowing secret leakage | [toolEngine.ts](../../vscode-extension/src/agentic/toolEngine.ts#L317-L329) | Redact command text before returning confirmation content and meta |
| **Medium** | Thinking log redacts `detail` only; `label` remains unredacted and can leak secrets | [thinkingLog.ts](../../vscode-extension/src/utils/thinkingLog.ts#L120) | Apply redaction to both `label` and `detail` before storage/output/event emission |

---

## 3. Architecture & Design

### Design Patterns Used
- [x] Layered validation flow
- [x] Utility module extraction
- [x] Defensive default behavior for unknown commands (confirmation)

### ADR/SPEC Alignment
- ADR-47.1 allowlist-over-denylist pattern is broadly implemented.
- Compound command splitting on `;`, `&&`, `||`, `|` is implemented.
- Most-restrictive-wins aggregation is implemented for compound commands.
- Secret redaction utility exists and is integrated in execution and thinking log paths.

### Architecture Gaps
- Current allowlist matching strategy is too permissive for some bare program entries, which conflicts with the intent of "known-safe commands only auto-execute" from SPEC-47 P0 criteria.

---

## 4. Testing

### Coverage Summary
- Reported result from local run: `666 passing, 0 failing`.
- New tests cover blocked patterns, allowlist flows, confirmation flows, compound parsing, reversibility classes, redaction patterns, and idempotency.

### Test Quality Assessment

#### [PASS] Well-Tested
- Command validation positive and negative paths.
- Compound command policy and precedence.
- Secret redaction pattern coverage and idempotency checks.
- Tool engine integration for blocked/confirm/allowed paths.

#### [WARN] Needs More Tests
- Add explicit tests proving that secrets in commands are redacted on the confirmation path.
- Add tests preventing overly broad auto-allow for bare interpreter/runtime commands.
- Add tests ensuring thinking-log `label` is redacted.

---

## 5. Security Review

### Security Checklist
- [x] No hardcoded real secrets observed in reviewed changes
- [x] Layer-1 dangerous patterns preserved and expanded
- [x] Unknown commands require confirmation
- [x] Secret redactor implemented with precompiled regexes
- [x] Redactor idempotency tested
- [ ] Confirmation response redaction completeness
- [ ] Strict allowlist semantics for auto-execution

### Vulnerabilities Found

#### Vulnerability 1: Over-broad auto-execution from bare allowlist entries
**Severity**: High
**Category**: Command execution policy bypass

**Location**: [commandValidator.ts](../../vscode-extension/src/utils/commandValidator.ts#L289)

**Description**:
The validator allows any command whose first token matches a single-token allowlist entry. This makes entries like `python`, `node`, `docker`, `kubectl`, `dotnet`, `curl`, and `wget` effectively wildcard grants for arbitrary arguments.

**Impact**:
Potential execution of dangerous or unintended side effects without confirmation, weakening the P0 hardening model.

**Fix**:
Use stricter allowlist semantics: either exact/prefix allowlist only, or add argument-level safe subcommand constraints for runtime/interpreter binaries.

#### Vulnerability 2: Secret leakage in confirmation response path
**Severity**: High
**Category**: Sensitive data exposure

**Location**: [toolEngine.ts](../../vscode-extension/src/agentic/toolEngine.ts#L317-L329)

**Description**:
For `requires_confirmation`, the code returns raw `command` in display text and `meta.command`. If command contains credentials (`Bearer`, `token=`, `api_key=`), sensitive values may be exposed.

**Impact**:
Credential disclosure in logs/UI/telemetry paths consuming tool results.

**Fix**:
Apply `redactSecrets` before composing confirmation text and metadata. Consider storing only redacted command in `meta` by default.

#### Vulnerability 3: Partial redaction in thinking log
**Severity**: Medium
**Category**: Sensitive data exposure

**Location**: [thinkingLog.ts](../../vscode-extension/src/utils/thinkingLog.ts#L120)

**Description**:
Only `detail` is redacted. `label` is persisted and emitted without redaction.

**Impact**:
Secret-like data accidentally placed in labels can leak via output channel or event bus.

**Fix**:
Redact both `label` and `detail` at log ingestion.

---

## 6. Performance Review

### Performance Checklist
- [x] Regexes are precompiled and reused.
- [x] Quick pre-check avoids unnecessary redaction passes.
- [x] Compound splitting and ranking are lightweight.

### Notes
No major performance concerns observed in this scope. Precompiled pattern approach and quick-check gate are aligned with expected performance goals.

---

## 7. Documentation Review

- Inline file headers and type comments are clear and helpful.
- Security intent is documented in module prologues.
- No README updates required for this isolated feature increment.

---

## 8. Acceptance Criteria Verification

### Story #54 - Allowlist command security
- [PASS] 3-layer flow exists: blocked -> allowlist -> confirmation
- [PASS] Compound splitting implemented for `;`, `&&`, `||`, `|`
- [PASS] Most-restrictive-wins policy implemented
- [WARN] Auto-allow semantics are too broad for bare executables

### Story #55 - Secret redaction
- [PASS] Redactor utility present with pattern-specific placeholders
- [PASS] Precompiled regex rules and idempotency behavior present
- [WARN] Confirmation output path does not redact command text

### Story #57 - Action reversibility
- [PASS] Reversibility classification and undo hints integrated into confirmation result

---

## 9. Technical Debt

- Allowlist entries currently mix command families and executable roots; this should evolve into policy objects with explicit safe subcommands/arguments.
- Consider a central "safe display" formatter for all user-visible tool text to prevent future redaction omissions.

---

## 10. Compliance & Standards

- ASCII-only compliance appears maintained in reviewed files.
- No forbidden references found in repository scan excluding `.git` and `node_modules`.
- Loop state file indicates completed iteration state (`status: complete`).

---

## 11. Recommendations

1. Tighten allowlist matching to eliminate bare-program wildcard behavior.
2. Redact confirmation path command text and metadata in `terminal_exec`.
3. Redact `label` in `ThinkingLog.log()`.
4. Add regression tests for these three points before requesting re-review.

---

## 12. Decision

**[WARN] CHANGES REQUESTED**

Rationale: P0 hardening objectives are substantially implemented, but two high-severity security gaps and one medium leakage gap must be fixed before approval.

---

## 13. Next Steps

1. Engineer addresses the three issues above.
2. Re-run `npm test` in `vscode-extension`.
3. Request re-review with updated commit.

---

## 14. Related Issues & PRs

- Epic: #47
- Feature: #49
- Stories: #54, #55, #57
- Reviewed commit: `16ad85b`

---

## 15. Reviewer Notes

This review intentionally held a high bar because Feature #49 is P0 security hardening. The implementation quality is strong overall and close to approval; the remaining blockers are focused and practical to remediate.

---

## Appendix

### Files reviewed
- [vscode-extension/src/utils/commandValidator.ts](../../vscode-extension/src/utils/commandValidator.ts)
- [vscode-extension/src/utils/secretRedactor.ts](../../vscode-extension/src/utils/secretRedactor.ts)
- [vscode-extension/src/agentic/toolEngine.ts](../../vscode-extension/src/agentic/toolEngine.ts)
- [vscode-extension/src/utils/thinkingLog.ts](../../vscode-extension/src/utils/thinkingLog.ts)
- [vscode-extension/src/test/utils/commandValidator.test.ts](../../vscode-extension/src/test/utils/commandValidator.test.ts)
- [vscode-extension/src/test/utils/secretRedactor.test.ts](../../vscode-extension/src/test/utils/secretRedactor.test.ts)
- [vscode-extension/src/test/agentic/toolEngine.test.ts](../../vscode-extension/src/test/agentic/toolEngine.test.ts)
- [.github/hooks/pre-commit](../../.github/hooks/pre-commit)

### Validation evidence
- Test execution: `cd vscode-extension && npm test` -> `666 passing (15s)`
- Forbidden term scan: no matches found (excluding `.git` and `node_modules`)

---

## Re-Review (2026-03-03)

**Re-review scope**: Verify resolution of the 3 previously identified blockers from the prior review.
**Fix commit reviewed**: `903bcd7`
**Reviewer**: Code Reviewer Agent

### Re-Review Findings

1. **Blocker #1 (HIGH): Bare-program allowlist bypass** -> **RESOLVED**
	 - Verified in `vscode-extension/src/utils/commandValidator.ts`:
		 - Bare entries for interpreters/runtimes/tools were replaced with safe subcommand prefixes (for example `node --version`, `python --version`, `docker ps`, `kubectl get`, `curl --version`).
		 - The broad bare-program auto-allow behavior was removed and replaced with explicit policy comments stating bare programs are not auto-allowed.
	 - Regression coverage verified in `vscode-extension/src/test/utils/commandValidator.test.ts`:
		 - Added bare-program safety tests confirming commands like `node`, `python`, `docker`, `kubectl` route to `requires_confirmation` unless matching explicit safe prefixes.

2. **Blocker #2 (HIGH): Confirmation path leaked raw command secrets** -> **RESOLVED**
	 - Verified in `vscode-extension/src/agentic/toolEngine.ts`:
		 - Confirmation branch now computes `safeCommand = redactSecrets(command)`.
		 - Both confirmation display text and `meta.command` use `safeCommand`.
	 - Regression coverage verified in `vscode-extension/src/test/agentic/toolEngine.test.ts`:
		 - Added tests asserting bearer tokens/API keys do not appear in confirmation text or `meta.command`.

3. **Blocker #3 (MEDIUM): ThinkingLog label not redacted** -> **RESOLVED**
	 - Verified in `vscode-extension/src/utils/thinkingLog.ts`:
		 - `label` is now redacted via `safeLabel = redactSecrets(label)` before storage/output/event emission.
		 - `detail` redaction remains in place.
	 - Regression coverage verified in `vscode-extension/src/test/utils/thinkingLog.test.ts`:
		 - Added tests asserting secrets are redacted from `label` and from both `label` + `detail` together.

### Validation Run

- Executed: `cd vscode-extension && npm test`
- Result: **684 passing, 0 failing**

### Re-Review Decision

**[PASS] APPROVED**

All three previously blocking findings are fixed with corresponding regression tests, and the full test suite passes.

---

## P1 Implementation Review (2026-03-03)

**Review scope**: Epic #47 P1 implementation (Features #50, #51, #49 story #58)
**Stories reviewed**: #58, #59, #60, #61, #62
**Commit reviewed**: `e43ea0f`
**Reviewer**: Code Reviewer Agent

### Summary

- Reviewed all new source modules and corresponding tests for:
  - `pathSandbox`
  - `progressTracker`
  - `parallelToolExecutor`
  - `retryWithBackoff`
  - `structuredLogger`
- Reviewed integration points in:
  - `agenticLoop.ts`
  - `toolEngine.ts`
  - `vscodeLmAdapter.ts`
- Cross-referenced with:
  - `docs/specs/SPEC-47.md` sections 3.4-3.8
  - `docs/adr/ADR-47.md` decisions 47.2-47.5

### Validation Results

- Test run executed: `cd vscode-extension && npm test`
- Result: **828 passing, 0 failing**

### Requirement Checks

1. **PathSandbox**
	- [PASS] Blocked directories present: `.ssh`, `.aws`, `.gnupg`, `.azure`, `.kube`
	- [PASS] Blocked patterns present: `.env`, `*.pem`, `*.key`, `*password*`, `*secret*`, `*.pfx`, `*.p12`
	- [PASS] Traversal detection implemented (`../`, `..\\`, bare `..` forms)
	- [PASS] Workspace root containment enforced in `validatePath`
	- [PASS] Integrated in `file_read`, `file_write`, `file_edit`

2. **ProgressTracker (Dual Ledger)**
	- [PASS] `TaskLedger` and `ProgressLedger` types match SPEC model
	- [PASS] Defaults match SPEC: `stallThreshold=3`, `staleTimeoutMs=60000`, `maxReplans=2`
	- [PASS] Replan context includes objective, facts, last failure details
	- [WARN] `isStale()` exists and is tested, but no stale-warning emission is wired in `agenticLoop` yet

3. **ParallelToolExecutor**
	- [PASS] Uses `Promise.allSettled()` for independent calls
	- [PASS] Preserves original result ordering
	- [PASS] One tool failure does not cancel sibling executions
	- [PASS] Dependency heuristics implemented (path writers/readers, call-id references)
	- [PASS] Integrated in `agenticLoop` execution path

4. **RetryWithBackoff**
	- [PASS] Exponential delay formula with jitter implemented
	- [PASS] Retryable statuses include `429, 500, 502, 503`
	- [PASS] Non-retryable statuses (`400, 401, 403, 404`) are not retried
	- [PASS] Default `maxRetries=5` implemented
	- [PASS] Integrated in `vscodeLmAdapter`

5. **StructuredLogger**
	- [PASS] JSONL output format implemented
	- [PASS] Rotation defaults match SPEC target (10 MB, max 5 files)
	- [PASS] Secret redaction integrated for message + metadata
	- [PASS] Correlation ID included on all entries
	- [WARN] SPEC 3.5 calls for UUID-format `correlationId`; current generator is timestamp-random string, not UUID

### Integration Review Notes

- `agenticLoop` correctly initializes and updates `ProgressTracker`, and triggers replans on stall.
- `agenticLoop` uses `ParallelToolExecutor` for approved tool requests.
- `toolEngine` integrates path sandboxing for read/write/edit file tools.
- `vscodeLmAdapter` wraps LM calls with retry/backoff.

### Forbidden-Term Scan

- Forbidden term scan performed.
- No matches found in `vscode-extension/src/**`.

### P1 Decision

**[WARN] CHANGES REQUESTED**

Rationale:
- SPEC-47 section 3.5 requires UUID-format `correlationId`; implementation currently generates a non-UUID string.
- SPEC/sequence expectations include stale-warning signaling; `ProgressTracker.isStale()` is not currently consumed by `agenticLoop` for warning emission.

### Required Follow-ups

1. Update `StructuredLogger` correlation ID generation to UUID format (or validate injected IDs to UUID).
2. Wire stale detection in `agenticLoop` to emit warning progress events when `isStale()` is true.
3. Add/extend regression tests for both behaviors.

---

## P1 Blocker Re-Review (2026-03-03)

**Re-review scope**: Verify resolution of the 2 prior P1 blockers from the P1 implementation review.
**Commit reviewed**: `97c86b8`
**Reviewer**: Code Reviewer Agent

### Blocker Verification

1. **UUID correlationId requirement (SPEC 3.5)** -> **RESOLVED**
	- Verified in `vscode-extension/src/utils/structuredLogger.ts`: `generateCorrelationId()` now emits UUID v4 shape (`8-4-4-4-12`, version nibble `4`, variant nibble `[8|9|a|b]`).
	- Verified in `vscode-extension/src/test/utils/structuredLogger.test.ts`: correlation ID assertion now enforces UUID v4 regex.

2. **Stale-warning wiring from `ProgressTracker.isStale()`** -> **RESOLVED**
	- Verified in `vscode-extension/src/agentic/agenticLoop.ts`: stale check now runs after stall/replan block.
	- On stale detection, loop injects stale warning text into session and emits `onLoopWarning` with typed `LoopDetectionResult` payload (`severity: 'warning', detector: null, count: 0`).

### Validation Run

- Executed: `cd vscode-extension && npm test`
- Result: **828 passing, 0 failing**

### Re-Review Decision

**[PASS] APPROVED**

Both previously blocking P1 items are fixed and validated by full test-suite pass.
