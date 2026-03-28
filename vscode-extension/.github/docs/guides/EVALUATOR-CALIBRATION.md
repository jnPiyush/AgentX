# Evaluator Calibration Examples

> Few-shot examples for the self-review evaluator sub-agent.
> These examples teach the evaluator what PASS and FAIL look like for each role
> so it calibrates its judgment against concrete evidence rather than vague heuristics.

---

## Purpose

The self-review evaluator in `Invoke-SelfReviewLoop` uses a skeptical-by-default prompt
with per-category verdicts. These calibration examples show the evaluator what constitutes
a PASS versus FAIL verdict with specific evidence patterns.

Without calibration, evaluators tend toward two failure modes:
- **Rubber-stamping**: approving work because the agent said it was done
- **Nitpicking**: rejecting work over style preferences that do not affect correctness

These examples define the boundary between the two.

---

## Engineer Role

### Example: FAIL -- Missing Edge Case Coverage

**Agent claim**: "Implemented the retry logic with full test coverage."

**Evaluator verification**:
```
file_read: src/retry.ts -> retry function has 4 branches (success, timeout, transient error, permanent error)
file_read: tests/retry.test.ts -> only 2 test cases (success, transient error)
```

**Correct verdict**:
- Testing: FAIL (2/4 branches covered = 50%, below 80% threshold)
- Finding: [HIGH] Testing: retry function has 4 branches but only 2 are tested (timeout and permanent error paths uncovered)

### Example: FAIL -- Security Gap

**Agent claim**: "Added search endpoint with input validation."

**Evaluator verification**:
```
file_read: src/api/search.ts -> query parameter concatenated into SQL string at line 42
grep_search: "parameterized|prepared" in src/api/search.ts -> 0 matches
```

**Correct verdict**:
- Security: FAIL (SQL string concatenation detected)
- Finding: [HIGH] Security: search.ts line 42 concatenates user input into SQL query instead of using parameterized query

### Example: FAIL -- Broken Existing Tests

**Agent claim**: "Refactored the utility module, all tests pass."

**Evaluator verification**:
```
grep_search: "import.*oldHelper" in tests/ -> 3 test files still import removed function
```

**Correct verdict**:
- Regressions: FAIL (existing imports reference removed export)
- Finding: [HIGH] Regressions: 3 test files still import `oldHelper` which was removed in refactor

### Example: PASS -- Complete Implementation

**Agent claim**: "Added health endpoint with tests and docs."

**Evaluator verification**:
```
file_read: src/api/health.ts -> GET /health returns { status, uptime, version }
file_read: tests/api/health.test.ts -> 4 test cases: success, missing env var, format check, error path
grep_search: "hardcoded.*secret|password.*=" in src/api/ -> 0 matches
file_read: README.md -> health endpoint documented in API section
```

**Correct verdict**:
- All categories: PASS
- APPROVED: true
- Finding: [LOW] Consistency: consider extracting version string to a shared constant

---

## Architect Role

### Example: FAIL -- Insufficient Options

**Agent claim**: "Created ADR with two well-researched options."

**Evaluator verification**:
```
file_read: docs/artifacts/adr/ADR-42.md -> Options section contains 2 options
```

**Correct verdict**:
- Completeness: FAIL (ADR requires 3+ options)
- Finding: [HIGH] Completeness: ADR-42 evaluates only 2 options; minimum is 3

### Example: FAIL -- Code in Spec

**Agent claim**: "Tech Spec complete with architecture diagrams."

**Evaluator verification**:
```
grep_search: "```typescript|```python|```javascript|```csharp" in docs/artifacts/specs/SPEC-42.md -> 2 matches
```

**Correct verdict**:
- Consistency: FAIL (zero-code policy violated)
- Finding: [HIGH] Consistency: SPEC-42 contains 2 code blocks; Architect specs must use only Mermaid diagrams and tables

### Example: PASS -- Complete Architecture

**Evaluator verification**:
```
file_read: ADR-42.md -> 3 options with evaluation matrix, research sources cited
file_read: SPEC-42.md -> Mermaid diagrams, API tables, no code blocks, tech stack section present
grep_search: "```typescript|```python" in SPEC-42.md -> 0 matches
```

**Correct verdict**: All categories PASS, APPROVED: true

---

## Reviewer Role

### Example: FAIL -- Premature Approval

**Agent claim**: "Code looks clean, approving."

**Evaluator verification**:
```
grep_search: "loop status" or ".agentx/agentx.ps1 loop" in docs/artifacts/reviews/REVIEW-42.md -> 0 matches
```

**Correct verdict**:
- Completeness: FAIL (quality loop verification not documented)
- Finding: [HIGH] Completeness: Review document does not show quality loop status check

### Example: PASS -- Thorough Review

**Evaluator verification**:
```
file_read: REVIEW-42.md -> all 8 categories checked, loop status = complete verified, coverage = 85%, all findings categorized
```

**Correct verdict**: All categories PASS, APPROVED: true

---

## How the Runner Uses These Examples

The `Invoke-SelfReviewLoop` function in `.agentx/agentic-runner.ps1` embeds abbreviated
calibration examples directly in the review prompt (3 inline examples). This guide provides
the full reference set that agents and operators can consult when the evaluator produces
unexpected results.

When adding new calibration examples:
1. Add the example in the relevant role section above
2. If the example represents a common failure pattern, consider adding an abbreviated
   version to the inline prompt in `Invoke-SelfReviewLoop`
3. Keep examples concrete -- cite specific file paths, line numbers, and tool outputs

---

**See Also**: [WORKFLOW.md](../WORKFLOW.md) | [engineer.agent.md](../../.github/agents/engineer.agent.md) | [reviewer.agent.md](../../.github/agents/reviewer.agent.md)