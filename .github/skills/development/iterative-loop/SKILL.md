---
name: "iterative-loop"
description: 'Implement Ralph Loop iterative refinement for AI agent tasks. Use when a task needs multiple passes to reach quality: TDD red-green-refactor cycles, incremental feature building, self-correcting code generation, or any work with verifiable completion criteria. Covers loop setup, completion promises, progress tracking, and escape hatches.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-02-24"
  updated: "2026-02-24"
compatibility:
  frameworks: ["agentx", "copilot", "claude-code"]
---

# Iterative Loop (Ralph Loop)

> **Purpose**: Iterative self-referential refinement loops for AI agent tasks.
> **Scope**: Loop setup, completion criteria, progress tracking, self-correction patterns.

---

## When to Use This Skill

- Tasks requiring multiple passes to reach quality (TDD cycles, refactoring)
- Incremental feature building with verifiable milestones
- Self-correcting code generation (write -> test -> fix -> repeat)
- Any work with clear, machine-verifiable completion criteria
- Greenfield implementations where autonomous iteration beats one-shot

## When NOT to Use

- One-shot operations (simple file edits, config changes)
- Tasks requiring human judgment or design decisions mid-loop
- Tasks with unclear or subjective success criteria
- Production debugging (use targeted debugging instead)

## Prerequisites

- AgentX CLI installed (`.agentx/agentx.ps1` or `.agentx/agentx.sh`)
- Clear completion criteria defined before starting
- Test framework configured (for TDD loops)

## Decision Tree

```
Need iterative refinement?
+- Has verifiable completion criteria?
|  +- Tests exist or can be written?
|  |  -> TDD Loop (red-green-refactor)
|  +- Linter/build checks available?
|  |  -> Quality Loop (build -> check -> fix)
|  - Clear done-state in output?
|     -> Promise Loop (work until output matches)
+- Need multiple phases?
|  -> Phased Loop (phase 1 -> phase 2 -> ... -> done)
- No clear criteria?
   -> Do NOT use iterative loop (use standard workflow)
```

---

## Quick Reference

| Pattern | Iterations | Best For | Completion Signal |
|---------|-----------|----------|-------------------|
| **TDD Loop** | 5-20 | Code + tests | All tests passing |
| **Quality Loop** | 3-10 | Linting, formatting | Zero errors/warnings |
| **Build Loop** | 5-15 | Compilation fixes | Clean build |
| **Phased Loop** | 10-50 | Large features | All phases complete |
| **Review Loop** | 2-5 | Self-review | No issues found |
| **Adversarial Loop** | 1 (mandatory pass) | Bug-finding before ship | Mutation score met + zero HIGH findings |
| **Subagent Review Loop** | 1 (mandatory pass) | Blind-spot detection | Zero HIGH/MEDIUM findings from clean reviewer |

---

## Deterministic Gates (Engineer default)

The Engineer's quality loop is gated by the CLI, not by judgment:

1. `loop start` initializes `.agentx/state/tests-baseline.json` as a placeholder and cleans the prior loop's archived evidence workspace. Record the actual baseline with `loop baseline -c <passing-test-count>` before iterating.
2. `loop iterate -e <path>` REQUIRES an existing evidence file (test report, coverage xml, scan json, mutation report). On accept, the CLI:
   - **moves the original file** into a sealed archive at `.agentx/state/loop-evidence/iter-<N>/<timestamp>-<filename>` (the source path no longer exists, so the next iterate cannot point at the same path),
  - records `{ evidence, evidenceOriginal }` in loop history.
3. If a tests baseline has been recorded, both `loop iterate` and `loop complete` REQUIRE `--passing <count>` and reject any count below baseline.
4. `loop complete -e <path>` REQUIRES a fresh final evidence artifact (for example, `final-gate.json` or a full-suite report) AND every iteration after #1 must already carry a still-existing archived evidence file. The final artifact is moved to `.agentx/state/loop-evidence/complete/`.
5. The commit-msg hook rejects `fix:` commits that change production code under `.agentx/`, `scripts/`, `vscode-extension/src/`, or the standard app roots without adding a regression test in the same diff.

Practical consequence: **generate a fresh file per iteration**. Re-running the same `npm test` into a newly written report is fine. The accepted source file is moved away, so the next iteration must produce a new file rather than reuse the old accepted path.

Bypass envs (use only for legacy/manual flows): `AGENTX_SKIP_EVIDENCE_GATE=1` skips evidence-file requirements only; it does not disable baseline pass-count enforcement. `AGENTX_SKIP_FIX_TEST_GATE=1` bypasses the fix-commit regression-test hook.

---

## Core Concepts

### The Loop Pattern

The iterative loop follows a simple cycle:

```
1. Agent receives task with completion criteria
2. Agent works on the task
3. Agent evaluates progress against criteria
4. If criteria met -> DONE (output completion promise)
5. If not met -> Record what failed, iterate (go to step 2)
6. Safety: Stop after max_iterations regardless
```

### Completion Promise

A **completion promise** is a specific phrase that signals the loop is done.
The agent MUST only output this promise when the criteria are genuinely met.

```
Completion promise: "ALL_TESTS_PASSING"

Rules:
- MUST only output when ALL tests actually pass
- MUST NOT output to escape the loop prematurely
- MUST NOT lie about completion status
```

### State Tracking

Loop state is tracked in `.agentx/state/loop-state.json`:

```json
{
  "active": true,
  "prompt": "Implement REST API with CRUD operations",
  "iteration": 3,
  "maxIterations": 20,
  "completionPromise": "ALL_TESTS_PASSING",
  "startedAt": "2026-02-24T10:00:00Z",
  "lastIterationAt": "2026-02-24T10:05:00Z",
  "history": [
    { "iteration": 1, "summary": "Created endpoint stubs", "status": "incomplete" },
    { "iteration": 2, "summary": "Added validation, 3/5 tests pass", "status": "incomplete" },
    { "iteration": 3, "summary": "Fixed edge cases, 5/5 tests pass", "status": "complete" }
  ]
}
```

---

## Loop Patterns

### 1. TDD Loop (Red-Green-Refactor)

Best for implementing features with test coverage.

**Setup:**
```powershell
.\.agentx\agentx.ps1 loop start `
  -Prompt "Implement user authentication with JWT. Write tests first (TDD)." `
  -MaxIterations 20 `
  -CompletionCriteria "ALL_TESTS_PASSING" `
  -IssueNumber 42
```

**Agent behavior per iteration:**
```
Iteration 1: Write failing tests for all requirements
Iteration 2: Implement code to make first test pass
Iteration 3: Implement code to make second test pass
...
Iteration N: All tests pass -> output completion promise
```

**Prompt template:**
```
Implement {{feature}} following TDD:
1. Write failing tests for all acceptance criteria
2. Implement minimal code to pass one test
3. Run tests: `npm test` or `dotnet test`
4. If any fail, debug and fix
5. Refactor if needed (keep tests green)
6. Repeat until ALL tests pass

Acceptance criteria:
{{criteria}}

When ALL tests pass, output: <promise>ALL_TESTS_PASSING</promise>
```

### 2. Quality Loop (Build-Check-Fix)

Best for achieving zero lint errors, clean builds, or code quality targets.

**Setup:**
```powershell
.\.agentx\agentx.ps1 loop start `
  -Prompt "Fix all TypeScript strict mode errors in src/" `
  -MaxIterations 15 `
  -CompletionCriteria "ZERO_ERRORS"
```

**Prompt template:**
```
Fix all {{tool}} errors in {{scope}}:
1. Run: {{check_command}}
2. Read error output carefully
3. Fix errors one file at a time
4. Re-run check after each fix
5. Repeat until zero errors

When zero errors reported, output: <promise>ZERO_ERRORS</promise>
```

### 2b. Adversarial Loop (Break-it-Before-Ship)

Mandatory bug-finding pass before declaring code production-ready. The goal is NOT to demonstrate correctness -- it is to actively try to break the change. Use after iteration 3 (security) and before iteration 5 (subagent review).

**Required artifacts (any iteration calling itself "Adversarial" MUST produce all of these as evidence):**

1. **Property-based tests** for every pure function added or changed -- Hypothesis (Python), fast-check (TS), FsCheck (.NET), QuickCheck (Rust/Haskell). Run for at least 100 examples.
2. **Mutation testing** on changed lines only -- Stryker (TS/.NET), mutmut (Python), pitest (Java). Surviving mutants on changed lines MUST be killed by new tests. Target >= 60% mutation score on the diff.
3. **Fuzzing** of every parser, deserializer, schema validator, or LLM-output handler in the diff -- minimum 60s per target with random + structured inputs.
4. **Negative tests** -- at least 3 per public endpoint or exported function: malformed input, boundary value, concurrent access / race condition.
5. **Chaos pass** for stateful flows -- random latency, dependency timeout, partial failure injection. The system must degrade gracefully or fail fast with clear errors.

**Prompt template:**
```
Iteration 4: ADVERSARIAL.
Your only goal is to find bugs in the diff for {{issue}}.

For each public function in the diff:
  1. Write a property-based test that asserts an invariant (idempotence,
     monotonicity, round-trip equality, no panic on bounded input).
  2. Run mutation testing on changed lines. List every surviving mutant.
  3. Write at least 3 negative tests (malformed/boundary/concurrent).

For each parser/deserializer/LLM-output handler:
  4. Run a 60s fuzzing pass with seed corpus + random bytes.

For stateful flows:
  5. Inject latency, timeouts, partial failures. Confirm graceful degradation.

Report:
  - Surviving mutants killed: list with new test name.
  - Property failures found: list and fix.
  - Crashes/hangs from fuzzing: file + input + fix.
  - Negative test list: 3+ per endpoint.

When mutation score >= 60% on diff AND zero surviving mutants AND zero
unhandled fuzz crashes, output: <promise>ADVERSARIAL_PASSED</promise>
```

**Evidence to attach to `loop iterate -e`**: mutation report, property test report, fuzz log -- combined into a single summary file at `.agentx/state/loop-evidence/iter-4/adversarial.md` linking to each artifact.

### 3. Phased Loop (Multi-Phase Implementation)

Best for large features that can be broken into sequential phases.

**Setup:**
```powershell
.\.agentx\agentx.ps1 loop start `
  -Prompt "Build e-commerce cart: Phase 1: Data model, Phase 2: API, Phase 3: Tests" `
  -MaxIterations 50 `
  -CompletionCriteria "ALL_PHASES_COMPLETE"
```

**Prompt template:**
```
Implement in phases:

Phase 1: {{phase1_description}}
  Done when: {{phase1_criteria}}

Phase 2: {{phase2_description}}
  Done when: {{phase2_criteria}}

Phase 3: {{phase3_description}}
  Done when: {{phase3_criteria}}

Track progress in docs/execution/progress/ISSUE-{{id}}-log.md.
When ALL phases complete, output: <promise>ALL_PHASES_COMPLETE</promise>
```

### 4. Review Loop (Self-Improvement)

Best for iterative self-review and quality improvement.

**Setup:**
```powershell
.\.agentx\agentx.ps1 loop start `
  -Prompt "Review and improve error handling in src/services/" `
  -MaxIterations 5 `
  -CompletionCriteria "NO_ISSUES_FOUND"
```

**Prompt template:**
```
Review {{scope}} for {{quality_dimension}}:
1. Read all files in scope
2. Identify issues (list each with file:line)
3. Fix each issue
4. Re-review to verify fixes and find new issues
5. Repeat until no issues remain

When review finds zero issues, output: <promise>NO_ISSUES_FOUND</promise>
```

---

## CLI Commands

### Start a Loop

```powershell
# PowerShell
.\.agentx\agentx.ps1 loop start `
  -Prompt "Your task description" `
  -MaxIterations 20 `
  -CompletionCriteria "DONE" `
  -IssueNumber 42

# Bash
./.agentx/agentx.sh loop start \
  "Your task description" \
  --max-iterations 20 \
  --completion-criteria "DONE" \
  --issue 42
```

### Check Loop Status

```powershell
.\.agentx\agentx.ps1 loop status
# Output: Iteration 3/20 | Started: 10:00 | Last: 10:05 | Promise: DONE
```

### Record Iteration Progress

```powershell
.\.agentx\agentx.ps1 loop iterate -Summary "Fixed 3 tests, 2 remaining"
# Increments iteration counter and logs summary
```

### Complete a Loop

```powershell
.\.agentx\agentx.ps1 loop complete -Summary "All tests passing, coverage at 85%"
# Marks loop as complete, records final summary
```

### Cancel a Loop

```powershell
.\.agentx\agentx.ps1 loop cancel
# Removes active loop state, logs cancellation reason
```

---

## Writing Good Completion Criteria

### Rules

1. **Verifiable**: Must be checkable by running a command
2. **Binary**: Either met or not (no "mostly done")
3. **Honest**: Agent MUST NOT claim completion falsely

### Good Examples

| Criteria | Verification Command |
|----------|---------------------|
| `ALL_TESTS_PASSING` | `npm test` exits 0 |
| `ZERO_LINT_ERRORS` | `eslint . --max-warnings 0` exits 0 |
| `BUILD_SUCCEEDS` | `dotnet build` exits 0 |
| `COVERAGE_80_PERCENT` | Coverage report shows >= 80% |
| `ALL_ENDPOINTS_WORKING` | Integration test suite passes |

### Bad Examples

| Criteria | Problem |
|----------|---------|
| `CODE_IS_GOOD` | Subjective, not verifiable |
| `DONE` | Too vague, no verification |
| `LOOKS_RIGHT` | Requires human judgment |
| `MOSTLY_WORKING` | Not binary |

---

## Progress Tracking

Each iteration SHOULD update the progress log:

```markdown
<!-- docs/execution/progress/ISSUE-42-log.md -->
# Progress Log: Issue #42

## Iteration 1 (2026-02-24T10:00:00Z)
- Created test stubs for 5 endpoints
- Status: 0/5 tests passing

## Iteration 2 (2026-02-24T10:02:00Z)
- Implemented GET /users and POST /users
- Status: 2/5 tests passing

## Iteration 3 (2026-02-24T10:04:00Z)
- Implemented PUT, DELETE, PATCH endpoints
- Fixed validation on POST body
- Status: 5/5 tests passing -> COMPLETE
```

---

## Safety and Escape Hatches

### Max Iterations

ALWAYS set `--max-iterations` as a safety net:

```powershell
# Recommended: Set reasonable limits based on task complexity
.\.agentx\agentx.ps1 loop start -Prompt "..." -MaxIterations 20
```

| Task Complexity | Recommended Max |
|----------------|----------------|
| Simple bug fix | 5-10 |
| Single feature | 10-20 |
| Multi-phase | 20-50 |
| Large refactor | 30-50 |

### Stuck Detection

If an agent makes no progress for 3+ iterations, it SHOULD:
1. Document what is blocking progress
2. List approaches already attempted
3. Suggest alternative approaches
4. Request human intervention if needed

### Emergency Cancel

```powershell
.\.agentx\agentx.ps1 loop cancel
```

---

## Integration with AgentX Workflows

### In Workflow TOML Files

Steps can enable iterative looping:

```toml
[[steps]]
id = "implement"
title = "Implement code and tests"
agent = "engineer"
iterate = true
max_iterations = 20
completion_criteria = "ALL_TESTS_PASSING"
```

### In Agent Definitions

Agents that support loops declare it in their frontmatter:

```yaml
supports_loop: true
loop_defaults:
  max_iterations: 20
  progress_log: true
  stuck_threshold: 3
```

---

## Core Rules

### 1. Iteration > Perfection

Do not aim for perfect on the first try. Let the loop refine the work
incrementally. Each pass improves on the last.

### 2. Failures Are Data

Failed tests, lint errors, and build failures are not setbacks -- they are
information that guides the next iteration. Use them to steer.

### 3. Persistence Wins

The loop handles retry logic. The agent keeps working until success criteria
are genuinely met. Persistence beats brilliance.

### 4. Honesty Is Non-Negotiable

The agent MUST NOT claim completion prematurely. The completion promise is a
contract: output it only when the statement is TRUE.

---

## Anti-Patterns

- **Premature Promise**: Claiming completion before verification commands actually pass -> Always run the verification command and confirm exit code 0 before outputting the completion promise
- **Infinite Drift**: Iterating without progress, changing approach every cycle -> If no progress after 3 iterations, stop, document blockers, and request human input
- **Gold Plating Loop**: Continuing to iterate after criteria are met to add unrequested improvements -> Stop as soon as completion criteria are satisfied; file separate issues for enhancements
- **Skipping Verification**: Assuming code works without running tests or build commands -> Run the actual verification command every iteration, not just visual inspection
- **Vague Criteria**: Using subjective completion criteria like "code looks good" -> Define binary, machine-verifiable criteria (test exit code, lint error count, build success)
- **Memory Loss**: Repeating the same failed fix across iterations without tracking what was tried -> Log each iteration's approach and outcome in the progress file; read before each new attempt
- **Loop Avoidance**: Avoiding the loop for complex tasks to save time -> Use the loop for any task with verifiable criteria; iteration beats one-shot for quality

---

## References

- [Ralph Loop Plugin (Anthropic)](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop)
- [Original Technique (Geoffrey Huntley)](https://ghuntley.com/ralph/)
- [Prompt Engineering Skill](../../ai-systems/prompt-engineering/SKILL.md)
```
