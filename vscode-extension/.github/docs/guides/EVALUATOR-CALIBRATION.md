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

## UX Designer / Prototype Auditor Role

> These exemplars target the subjective-quality failure mode called out in the Anthropic harness-design article: agents tend to rate their own design output generously. The originality criterion explicitly penalises generic AI-slop patterns.

### Example: FAIL -- AI-Slop Visual Defaults

**Agent claim**: "Prototype built with polished, modern styling."

**Evaluator verification**:
```
browser_navigate: file:///.../prototype.html
browser_screenshot -> hero section uses purple-to-pink gradient over white card, stock Heroicons, default shadcn button styles, generic 'AI assistant' icon
grep_search: "from-purple|to-pink|bg-white.*shadow|backdrop-blur" in prototype.html -> 7 matches
```

**Correct verdict**:
- Originality: FAIL (floor 50, observed ~25 -- composed entirely of recognisable AI/library defaults)
- Finding: [HIGH] Originality: hero uses canonical AI-slop pattern (purple gradient on white card with backdrop-blur). Replace with a deliberate, brand-aligned visual choice that a human designer would recognise as intentional.

### Example: FAIL -- Subjective Self-Approval Without Live Interaction

**Agent claim**: "Prototype looks great, approving."

**Evaluator verification**:
```
grep_search: "browser_navigate|playwright|screenshot" in review/audit log -> 0 matches
```

**Correct verdict**:
- Completeness: FAIL (UI-bearing change reviewed without running it; static-diff-only approval is not allowed for UI surfaces)
- Finding: [HIGH] Completeness: prototype audit did not exercise the running page. Re-run with the `browser-automation` skill and record at least one screenshot per primary route plus an axe-core scan.

### Example: PASS -- Deliberate Design Choices

**Evaluator verification**:
```
browser_navigate -> distinct typographic hierarchy, custom color palette with three weighted hues, deliberate negative space, custom illustration in hero
axe-core scan -> 0 serious / critical violations
browser_screenshot per route -> visual identity is consistent across pages, no library-default tells
```

**Correct verdict**: All categories PASS, APPROVED: true; note [LOW] Craft: consider tightening line-height on body copy from 1.7 to 1.55.

---

## Contract-Criterion / FAIL Pattern (Generator vs Evaluator)

> Borrowed from the Anthropic article: when an Engineer is operating against a `CONTRACT-<issue>-<topic>.md`, the Reviewer writes findings in the same shape as the contract's acceptance criteria so the Engineer can act without further investigation.

Use this table format inside the review document for contract-driven slices:

| Contract criterion | Evaluator finding |
|-------------------|-------------------|
| Rectangle fill tool fills a rectangular region on click-drag | FAIL -- only places tiles at drag start/end. `fillRectangle` exists at `LevelEditor.tsx:412` but is not invoked from the mouseUp handler. |
| `PUT /frames/reorder` endpoint reorders animation frames | FAIL -- route declared after `/{frame_id}` in `routes.py:88`; FastAPI matches `reorder` as an int frame_id and returns 422. Move the literal route above the parameterised one. |
| Delete key removes the selected entity spawn point | FAIL -- handler at `LevelEditor.tsx:892` requires both `selection` and `selectedEntityId`. Click-select sets only `selectedEntityId`. Change to `selection \|\| (selectedEntityId && activeLayer === 'entity')`. |

Findings written this way satisfy three properties at once:

1. They cite the exact contract criterion that was promised.
2. They cite the exact code location where the promise broke.
3. They include a concrete suggested fix the generator can act on without re-reading the contract.

---

## Per-Iteration Reflection (Lightweight Pivot-vs-Refine)

> The runtime stall detector triggers a strong PIVOT-vs-REFINE prompt only after the configured stall threshold (default 3 consecutive failures). The Anthropic article asks for a *lighter* reflection on **every** iteration after the first rejection. This is a prompting-level habit -- it does not change runtime behavior.

When the evaluator returns `APPROVED: false`, the generator's next response SHOULD open with a one-line reflection:

- `Reflection: REFINE -- findings are narrowing (3 -> 1) and all in the same area; tightening the same approach.`
- `Reflection: PIVOT -- third consecutive fail in the same category; abandoning the helper-class approach and inlining the logic.`
- `Reflection: REFINE -- new finding is an edge case the prior fix exposed, not a structural issue.`

The reflection is informational. It does not unlock or block the loop. Its purpose is to make the generator's strategic choice visible to the evaluator (and to anyone reading the trace), so a wrong direction can be caught earlier than the stall threshold.

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

**See Also**: [WORKFLOW.md](../WORKFLOW.md) | [engineer.agent.md](../../agentx/agents/engineer.agent.md) | [reviewer.agent.md](../../agentx/agents/reviewer.agent.md)