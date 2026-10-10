# Loop Patterns

Detailed loop patterns for the [iterative-loop skill](../SKILL.md).

## 1. Test-Aware Authoring Loop

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

## 2. Quality Loop (Build-Check-Fix)

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

## 2b. Adversarial Review and Test Planning

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

## 3. Phased Loop (Multi-Phase Implementation)

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

## 4. Review Loop (Self-Improvement)

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
