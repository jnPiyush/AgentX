---
name: "iterative-loop"
description: 'Run evidence-backed refinement with independent review and non-test verification. Covers loop setup, completion criteria, progress, bounded recovery, and explicit user consent for separate post-loop test execution.'
user-invocable: false
metadata:
  author: "Frontier"
  version: "1.1.0"
  created: "2026-02-24"
  updated: "2026-09-28"
compatibility:
  frameworks: ["frontier", "copilot", "claude-code"]
---

# Iterative Loop (Ralph Loop)

> **Purpose**: Iterative self-referential refinement loops for AI agent tasks.
> **Scope**: Loop setup, completion criteria, progress tracking, self-correction patterns.

## Test Execution Boundary

Quality loops and reviews MUST NOT launch test suites, coverage, mutation,
property or fuzz runs, directly or through wrappers. Author and inspect tests;
verify with appropriate build, typecheck, lint, syntax and schema checks.
The canonical policy is `.github/AGENT-PROTOCOL.md` section 1.4.

After `loop complete` succeeds, the owning agent MUST ask, "Would you like to
run the test suite now?" Identify the proposed scope and wait for explicit
approval through the host's input tool/UI. No answer, dismissal or a decline
means not run. If approved, run the selected suite as a separate verification
task. A failure requires a new fix/review loop, not an automatic suite rerun.

CI/release gates and explicit standalone testing requests remain separate.
Review approval never implies tests passed or coverage was measured.

---

## When to Use This Skill

- Tasks requiring multiple passes to reach quality (implementation, refactoring)
- Incremental feature building with verifiable milestones
- Self-correcting code generation (write -> inspect/check -> fix -> review)
- Any work with clear, machine-verifiable completion criteria
- Greenfield implementations where autonomous iteration beats one-shot

## When NOT to Use

- One-shot operations (simple file edits, config changes)
- Tasks requiring human judgment or design decisions mid-loop
- Tasks with unclear or subjective success criteria
- Production debugging (use targeted debugging instead)

## Prerequisites

- Frontier CLI installed (`.frontier/runtime/frontier.ps1` or `.frontier/runtime/frontier.sh`)
- Clear completion criteria defined before starting
- Non-test verification commands identified; proposed suites reserved for the post-loop offer

## Rationalization Table

The loop is the gate, not a suggestion. Push back against these common ways of skipping it.

| Rationalization | Reality |
|-----------------|---------|
| "The change is small, the loop adds overhead." | The CLI loop is seconds of overhead and forces a fresh verification step that LLMs habitually skip. Run it anyway. |
| "The first attempt looks correct, I'll mark complete." | LLMs systematically overrate their first attempts. Run the verification step at least once before claiming completion. |
| "I hit the minimum iteration count, I'm done." | The minimum is a floor, not a ceiling. The loop is complete when the done criteria pass, not when the counter ticks over. |
| "Self-review found nothing, no need for another pass." | Self-review with no findings on a non-trivial change usually means you reviewed too generously. Re-read against the spec, not against the code. |
| "Tests pass, so the loop is complete." | Tests passing is neither necessary nor sufficient. The loop requires that the done criteria pass, the acceptance criteria are mapped, the sub-agent review is approved, evidence is fresh, and `loop complete` is recorded. |
| "I need to run the suite to have something to attach as evidence." | No. Use acceptance mapping, independent findings and non-test evidence. Ask about suites after completion; never run them to fill iterations. |
| "I'll run `loop complete` now and add the verification later." | `loop complete` is the artifact that gates handoff. Backfilling evidence after the gate defeats the gate. Verify first, then close. |

## Decision Tree

```
Need iterative refinement?
+- Has verifiable completion criteria?
|  +- Tests exist or can be written?
|  |  -> Test-aware authoring loop (cases + implementation + non-test checks)
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
| **Test-aware authoring** | 5-20 maximum budget | Code + authored test cases | Implementation reviewed; test execution offered afterward |
| **Quality Loop** | 3-10 | Linting, formatting | Zero errors/warnings |
| **Build Loop** | 5-15 | Compilation fixes | Clean build |
| **Phased Loop** | 10-50 | Large features | All phases complete |
| **Review Loop** | 2-5 | Self-review | No issues found |
| **Adversarial review** | 1 scoped pass | Inspect failure paths and design cases | Risks reviewed; suites deferred for user decision |
| **Subagent Review Loop** | 1 (mandatory pass) | Blind-spot detection | Zero HIGH/MEDIUM findings from a clean reviewer, recorded as `loop iterate ... --verdict approved --reviewer <id> --high 0 --medium 0` on the final work iteration |

---

## Deterministic Gates (Engineer default)

The Engineer's quality loop is gated by the CLI, not by judgment:

1. `loop start` resets `.frontier/state/tests-baseline.json` and cleans the prior loop's evidence archive; `loop affected` lists tests naming code changed since then.
2. `loop iterate -e <path>` REQUIRES existing evidence: acceptance mapping, independent findings or relevant non-test check output. Supplied earlier test results retain their original revision and timestamp; do not rerun suites or manufacture fresh results. The CLI archives evidence under `.frontier/state/loop-evidence/`.
3. `--passing <suite>=<count>[,<suite>=<count>]` is OPTIONAL metadata for actual supplied results. Omission is allowed even with a legacy integer baseline and does not record zero or passed. Explicit malformed or regressed counts are still rejected; `loop baseline -c <suite>=<count>` records an intentional baseline change.
4. `loop complete -e <path>` REQUIRES a fresh final evidence artifact, and every iteration after #1 must still have its archived evidence file. The final artifact is copied to `.frontier/state/loop-evidence/complete/`.
5. The commit-msg hook rejects `fix:` commits that change production code under `.frontier/runtime/`, `scripts/`, `vscode-extension/src/`, or the standard app roots without adding a regression test in the same diff.
6. After successful completion, CLI output and `postLoopTestPrompt` carry the
   test-suite question. VS Code offers Run Test Task / Not Now. This offer is
   not itself consent and does not certify the test task succeeded.

Practical consequence: **generate a fresh file per iteration**. The source remains available, but freshness and SHA-256 reuse guards reject an old or identical artifact on the next iteration.

Manual-flow controls: `FRONTIER_SKIP_EVIDENCE_GATE=1` skips evidence-file requirements only; it does not disable baseline pass-count enforcement. `FRONTIER_SKIP_FIX_TEST_GATE=1` bypasses the fix-commit regression-test hook. These controls require the applicable owner's authorization; AgentX/HVE variable names are not supported.

---

## Core Concepts

### The Loop Pattern

The iterative loop follows a simple cycle:

```
1. Agent receives task with completion criteria
2. Agent works on the task
3. Agent evaluates progress against criteria
4. If review/non-test criteria met -> complete loop, then ask about tests
5. If not met -> Record what failed, iterate (go to step 2)
6. Safety: Stop after max_iterations regardless
```

### Completion Promise

A **completion promise** is a specific phrase that signals the loop is done.
The agent MUST only output this promise when the criteria are genuinely met.

```
Completion promise: "IMPLEMENTATION_REVIEWED"

Rules:
- MUST only output when the declared review/non-test criteria hold
- MUST report suites as not run unless actual execution evidence exists
- MUST NOT output to escape the loop prematurely
- MUST NOT lie about completion status
```

### State Tracking

Loop state is tracked in `.frontier/state/loop-state.json`:

```json
{
  "active": true,
  "prompt": "Implement REST API with CRUD operations",
  "iteration": 3,
  "maxIterations": 20,
  "completionCriteria": "IMPLEMENTATION_REVIEWED",
  "startedAt": "2026-02-24T10:00:00Z",
  "lastIterationAt": "2026-02-24T10:05:00Z",
  "history": [
    { "iteration": 1, "summary": "Created endpoint stubs", "status": "incomplete" },
    { "iteration": 2, "summary": "Added validation and inspected boundary cases", "status": "in-progress" },
    { "iteration": 3, "summary": "Independent review approved; suites not run", "status": "in-progress" }
  ]
}
```

---

## Loop Patterns

### 1. Test-Aware Authoring Loop

Best for implementation with regression cases prepared for later execution.
Traditional red/green testing belongs to a separate approved testing task,
not to these loop iterations.

**Setup:**
```powershell
.\.frontier\runtime\frontier.ps1 loop start `
  -p "Implement the feature and author regression cases; defer suites." `
  -m 20 `
  -c "IMPLEMENTATION_REVIEWED" `
  -i 42
```

**Agent behavior per iteration:**
```
Iteration 1: Map requirements, write regression cases, implement
Iteration 2: Inspect boundary cases and run non-test checks
Iteration 3: Independent review and current evidence
...
After approval and minimum iterations: complete loop, ask about tests
```

**Prompt template:**
```
Implement {{feature}}:
1. Map acceptance criteria and write regression cases.
2. Implement the bounded change.
3. Run non-test verification; do not invoke suites or coverage.
4. Inspect failure paths and address review findings.
5. Record fresh evidence and independent approval.
6. Complete the loop, then explicitly ask whether to run the suite.

Acceptance criteria:
{{criteria}}

Report tests as not run until the user-approved separate execution occurs.
```

### 2. Quality Loop (Build-Check-Fix)

Best for achieving zero lint errors, clean builds, or code quality targets.

**Setup:**
```powershell
.\.frontier\runtime\frontier.ps1 loop start `
  -p "Fix TypeScript strict mode errors in src/" `
  -m 15 `
  -c "ZERO_TYPE_ERRORS"
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

### 2b. Adversarial Review and Test Planning

For `high-risk` work, inspect security-, data-, and release-critical failure
paths before independent review. Prepare discriminating tests, but defer their
execution to the post-loop user decision or independently required CI gate.

Select cases from the changed surface; do not propose an inapplicable technique merely
to satisfy a checklist:

| Changed surface | Proposed tests after approval |
|-----------------|----------------------------|
| Pure security/correctness-critical logic | Property tests for stated invariants |
| Security/correctness-critical branches | Mutation testing on changed lines |
| Parser, deserializer, schema, or LLM-output handler | Fuzzing with structured and random inputs |
| Public endpoint or exported boundary | Malformed, boundary, and authorization/error-path tests |
| Stateful external dependency flow | Timeout and partial-failure injection |

Record `not applicable` with the changed-surface reason for rows that do not apply.

**Prompt template:**
```
HIGH-RISK ADVERSARIAL REVIEW for {{issue}}.
Inspect invariants, malformed input, concurrency, timeouts and partial failures.
Write relevant property, mutation, fuzz or negative cases without executing them.
Report concrete code findings separately from unexecuted test hypotheses.
After the loop completes, offer the applicable suite and its scope to the user.
Do not report mutation scores or test outcomes before actual approved execution.
```

**Evidence to attach to `loop iterate -e`**: inspected paths, findings, proposed
cases and relevant non-test checks. Label deferred execution explicitly.

### 3. Phased Loop (Multi-Phase Implementation)

Best for large features that can be broken into sequential phases.

**Setup:**
```powershell
.\.frontier\runtime\frontier.ps1 loop start `
  -p "Build cart: data model, API, regression cases and review; defer suites." `
  -m 50 `
  -c "IMPLEMENTATION_PHASES_REVIEWED"
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
.\.frontier\runtime\frontier.ps1 loop start `
  -p "Review and improve error handling in src/services/" `
  -m 5 `
  -c "NO_REVIEW_FINDINGS"
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
.\.frontier\runtime\frontier.ps1 loop start `
  -p "Your task description" `
  -m 20 `
  -c "IMPLEMENTATION_REVIEWED" `
  -i 42

# Bash
./.frontier/runtime/frontier.sh loop start \
  --prompt "Your task description" \
  --max 20 \
  --criteria "IMPLEMENTATION_REVIEWED" \
  --issue 42
```

### Check Loop Status

```powershell
.\.frontier\runtime\frontier.ps1 loop status
# Output: Iteration 3/20 | Started: 10:00 | Last: 10:05 | Promise: DONE
```

### Prepare Checks and Review

```powershell
.\.frontier\runtime\frontier.ps1 loop preflight --json
.\.frontier\runtime\frontier.ps1 loop review-packet --stage boundary --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop review-packet --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop reviewer-check --packet <generated-path> --reviewer <id>
.\.frontier\runtime\frontier.ps1 loop timing --phase implementation
.\.frontier\runtime\frontier.ps1 loop timing --phase waiting
.\.frontier\runtime\frontier.ps1 loop timing --stop
```

Preflight uses built-in non-test checks and one batched advisory scrub. Reuse
preserves the original check time and receipt; changed inputs invalidate it.
Semantic checks with unknown dependency closure run fresh. Check errors remain
blockers. The packet prioritizes changed inputs and affected consumers, but never
inherits approval or narrows the required full final verdict.

Run reviewer diagnostics in the actual reviewer host. A parent-side result
does not prove the child has tools, and the diagnostic grants no permissions.
Use boundary packets during existing high-risk planning, not as another
mandatory checkpoint for small tasks. See protocol section 1.5 for the complete
contract. None of these commands executes a test suite.

### Record Iteration Progress

```powershell
.\.frontier\runtime\frontier.ps1 loop iterate -s "Reviewed changed paths; typecheck passed" -e .frontier/state/iteration-evidence.json
# Increments iteration counter and logs summary
```

### Complete a Loop

```powershell
.\.frontier\runtime\frontier.ps1 loop complete -s "Reviewed; suites not run" -e .frontier/state/final-evidence.json
# Requires the final independent approval and evidence; then ask about tests.
```

### Cancel a Loop

```powershell
.\.frontier\runtime\frontier.ps1 loop cancel
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
| `IMPLEMENTATION_REVIEWED` | Current independent approval and acceptance mapping |
| `ZERO_LINT_ERRORS` | `eslint . --max-warnings 0` exits 0 |
| `BUILD_SUCCEEDS` | `dotnet build` exits 0 |
| `SCHEMA_VALID` | Repository schema validator exits 0 |

Test-pass and coverage targets belong to separate consented verification,
not to an implementation loop that deliberately does not execute suites.

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
- Status: regression cases authored; suites not run

## Iteration 2 (2026-02-24T10:02:00Z)
- Implemented GET /users and POST /users
- Status: typecheck passed; suites not run

## Iteration 3 (2026-02-24T10:04:00Z)
- Implemented PUT, DELETE, PATCH endpoints
- Fixed validation on POST body
- Status: review approved; complete loop and ask whether to run suites
```

---

## Safety and Escape Hatches

### Max Iterations

ALWAYS set `--max` as a safety net:

```powershell
# Recommended: Set reasonable limits based on task complexity
.\.frontier\runtime\frontier.ps1 loop start -p "..." -m 20
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
.\.frontier\runtime\frontier.ps1 loop cancel
```

---

## Integration with Frontier Workflows

### In Workflow TOML Files

Steps can enable iterative looping:

```toml
[[steps]]
id = "implement"
title = "Implement code and tests"
agent = "engineer"
iterate = true
max_iterations = 20
completion_criteria = "IMPLEMENTATION_REVIEWED"
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
- **Skipping Verification**: Confusing deferred tests with no verification -> Record actual non-test checks and review evidence; ask about suites after completion
- **Vague Criteria**: Using subjective completion criteria like "code looks good" -> Define binary, machine-verifiable criteria (test exit code, lint error count, build success)
- **Memory Loss**: Repeating the same failed fix across iterations without tracking what was tried -> Log each iteration's approach and outcome in the progress file; read before each new attempt
- **Loop Avoidance**: Avoiding the loop for complex tasks to save time -> Use the loop for any task with verifiable criteria; iteration beats one-shot for quality

---

## References

- [Ralph Loop Plugin (Anthropic)](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop)
- [Original Technique (Geoffrey Huntley)](https://ghuntley.com/ralph/)
- [Prompt Engineering Skill](../../ai-systems/prompt-engineering/SKILL.md)
```
