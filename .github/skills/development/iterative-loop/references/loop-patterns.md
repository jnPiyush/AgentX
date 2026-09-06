# Loop Pattern Reference

Supporting detail for [iterative-loop](../SKILL.md): setup commands, prompt
templates, and criteria examples for each pattern. All commands use the real
`agentx-cli.ps1` flags (`-p/-m/-c/-i/-r/-b` for start; `-s/-e/-o` for iterate;
no flags for `status`/`cancel`/`gate`).

## Quick Reference

| Pattern | Iterations | Best For | Completion Signal |
|---------|-----------|----------|--------------------|
| TDD Loop | 5-20 | Code + tests | All tests passing |
| Quality Loop | 3-10 | Lint/format/build | Zero errors |
| Phased Loop | 10-50 | Large, multi-milestone features | All phases complete |
| Review Loop | 2-5 | Self-review | No issues found |
| Adversarial Loop | 1 mandatory pass | High-risk surfaces before ship | Mutation score met, zero surviving mutants/HIGH findings |
| Subagent Review Loop | 1 mandatory pass | Blind-spot detection | `--verdict approved --high 0 --medium 0` on final iteration |

## Pattern Setup and Prompts

### TDD Loop

```powershell
.agentx/agentx.ps1 loop start -p "Implement JWT auth. Write tests first (TDD)." -m 20 -c "ALL_TESTS_PASSING" -i 42
```

Prompt: write failing tests for every acceptance criterion, implement the
minimal code to pass one test, run the suite, fix, refactor with tests green,
repeat until all pass, then record the iteration.

### Quality Loop

```powershell
.agentx/agentx.ps1 loop start -p "Fix all TypeScript strict-mode errors in src/" -m 15 -c "ZERO_ERRORS"
```

Prompt: run the check command, fix errors file by file, re-run after each
fix, repeat until it exits zero.

### Adversarial Loop (mandatory, high-risk only)

Select checks by changed surface; record `not applicable` with a reason for
rows that do not apply:

| Changed surface | Required check |
|------------------|-----------------|
| Security/correctness-critical logic | Property tests for stated invariants |
| Security/correctness-critical branches | Mutation testing on changed lines |
| Parser/deserializer/LLM-output handler | Fuzzing with structured + random input |
| Public endpoint/exported boundary | Malformed, boundary, authz/error-path tests |
| Stateful external-dependency flow | Timeout/partial-failure injection |

Report surviving mutants killed, property failures found and fixed, fuzz
crashes with file/input/fix, and 3+ negative tests per endpoint. Attach one
evidence file linking the applicable reports to `loop iterate -e`.

### Phased Loop

```powershell
.agentx/agentx.ps1 loop start -p "Build cart: Phase 1 data model, Phase 2 API, Phase 3 tests" -m 50 -c "ALL_PHASES_COMPLETE"
```

Track each phase's done-when criteria in
`docs/execution/progress/ISSUE-<id>-log.md` (see template below).

### Review Loop

```powershell
.agentx/agentx.ps1 loop start -p "Review and improve error handling in src/services/" -m 5 -c "NO_ISSUES_FOUND"
```

Prompt: read the scope, list issues as `file:line`, fix each, re-review to
confirm fixes and surface new issues, repeat until none remain.

## Full CLI Reference

```powershell
.agentx/agentx.ps1 loop start -p "<task>" -m <max> -c "<criteria>" -i <issue> -r <role> -b <budget-minutes>
.agentx/agentx.ps1 loop baseline -c <passing-test-count>
.agentx/agentx.ps1 loop status
.agentx/agentx.ps1 loop iterate -s "<summary>" -e <evidence-file> -o <pass|fail|partial> --passing <count>
.agentx/agentx.ps1 loop iterate -s "Subagent Review: <outcome>" -e <evidence-file> --verdict <approved|changes-requested> --reviewer <id> --high <n> --medium <n> --low <n>
.agentx/agentx.ps1 loop rollback -n <target-iteration> -r "<reason>"
.agentx/agentx.ps1 loop complete -s "<summary>" -e <final-evidence-file> --passing <count>
.agentx/agentx.ps1 loop cancel
.agentx/agentx.ps1 loop gate
```

`-r <role>` sets the task-class floor explicitly instead of relying on
keyword inference from the prompt.

## Writing Completion Criteria

Rules: verifiable by a command, binary (met or not), and never claimed
falsely.

Good: `ALL_TESTS_PASSING` (`npm test`/`dotnet test` exits 0),
`ZERO_LINT_ERRORS` (`eslint . --max-warnings 0` exits 0), `BUILD_SUCCEEDS`
(build exits 0), `COVERAGE_80_PERCENT` (report shows >= 80%).

Bad: `CODE_IS_GOOD` (subjective), `DONE` (too vague), `LOOKS_RIGHT` (needs
human judgment), `MOSTLY_WORKING` (not binary).

## Progress Log Template

```markdown
<!-- docs/execution/progress/ISSUE-42-log.md -->
# Progress Log: Issue #42

## Iteration 1 (2026-02-24T10:00:00Z)
- Created test stubs for 5 endpoints; 0/5 passing

## Iteration 2 (2026-02-24T10:02:00Z)
- Implemented GET/POST /users; 2/5 passing

## Iteration 3 (2026-02-24T10:04:00Z)
- Implemented remaining endpoints and validation; 5/5 passing -> complete
```

## State, Baseline, and Evidence

The CLI manages `.agentx/state/loop-state.json`; inspect it, do not hand-edit it.
Core fields are `active`, `status`, `prompt`, `role`, `taskClass`, `iteration`,
`minIterations`, `maxIterations`, `completionCriteria`, `issueNumber`,
`budgetMinutes`, `codeQualityBaselineSha256` and `history`. History records the
iteration, timestamp, summary, status and outcome. Task classes are `standard`,
`auto-fix-review`, `complex-delivery`, `agent-x` and `high-risk`.

`tests-baseline.json` records `capturedAt`, `issue`, `passing` and `note`.
`loop baseline -c <count>` records measured passing tests; an unset/null count
does not prove regression coverage. Accepted evidence is archived under
`.agentx/state/loop-evidence/iter-<N>/` and `complete/`; sources remain in place.
The legacy `AGENTX_SKIP_EVIDENCE_GATE` override does not establish verification
or disable pass-count enforcement. Do not use it to bypass normal delivery gates.

### Bounded iteration ceilings

Illustrative `-m` ceilings: simple fixes 5-10; single features 10-20;
multi-phase work or large refactors 20-50. Choose a bounded budget for the actual
risk, stop when all gates pass, and reassess stalled work rather than using every
allowed iteration. Ceilings do not change minimums or authorize extra model spend.

## Extended Anti-Patterns

- Premature promise: claiming completion before the verification command
  actually exits 0 -- always confirm the exit code first.
- Skipping verification: assuming a fix works from the diff alone -- execute
  the applicable check after each fix.
- Infinite drift: changing approach every cycle with no progress -- after 3
  iterations with no progress, stop, document blockers, request input.
- Gold plating: iterating past met criteria to add unrequested work -- stop
  at criteria-met; file separate issues for extras.
- Vague criteria: subjective phrases like "looks good" -- redefine as a
  binary, command-verifiable criterion before continuing.
- Memory loss: repeating a failed fix without tracking prior attempts --
  log each iteration's approach and outcome; read the log before retrying.
- Loop avoidance: skipping the loop on complex tasks to save time --
  iteration outperforms one-shot on anything with verifiable criteria.

## Credits

Pattern adapted from the Ralph Loop technique: [plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop),
[original writeup](https://ghuntley.com/ralph/).