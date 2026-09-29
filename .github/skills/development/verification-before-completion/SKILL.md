---
name: verification-before-completion
description: Use before claiming "done", "fixed", "tests pass", "deployed", "loop complete", or closing an issue. Block false completion claims by requiring a specific claim, fresh verification, output inspection, comparison, and evidence-backed reporting.
user-invocable: false
---

# Verification Before Completion

> WHEN: Any time the active agent is about to claim work is finished -- "done", "complete", "fixed", "tests pass", "loop complete", "ready for review", "deployed", "issue closed". The single most common Frontier failure mode is reporting completion that fresh verification would have caught.

## When to Use This Skill

Load this skill when:

- An Engineer agent is about to close an issue or run `frontier loop complete`
- A Reviewer agent is about to set `APPROVED`
- A Tester agent is about to mark a test plan green
- A DevOps agent is about to claim a deployment succeeded
- Any agent is about to report results in chat without having re-run the check on the current commit

Skip when:

- The work is purely exploratory and no completion claim is being made
- The user has explicitly asked for a partial / in-progress report

## Prerequisites

- Access to the verification surface (test runner, CLI, build, app under test, deployed URL)
- Knowledge of the exact command that proves the claim
- Current commit SHA or build identifier to anchor the evidence

## Rationalization Table

Reject these six verification shortcuts.

| Rationalization | Reality |
|-----------------|---------|
| "The tests passed last time I ran them, the diff is small." | Old results are not a current pass. Label their revision and ask for post-loop test execution instead of inventing a rerun. |
| "The CI run on the previous commit was green." | Fresh commit, fresh run; a previous green run does not verify this commit. |
| "I can see by reading the code that it works." | Code inspection is necessary but insufficient to detect compiler, interpreter, or runtime failures. Run it. |
| "The change is too small to break anything." | Even a one-line change can break behavior. Run the verification. |
| "I need tests to say the loop is complete." | Loop/review verification uses acceptance mapping, independent findings and non-test checks. Do not run suites in those phases; ask the user after loop completion. Tests remain not run until approved and executed. |
| "The loop iteration count is satisfied, I can mark complete." | The count is a floor; the done criteria must pass on the current commit. |

## The Gate Function (5 Steps)

Execute these five steps before any completion claim. No exceptions.

### Step 1 -- IDENTIFY the claim

State the claim out loud, in writing, in one sentence. Examples:

- "All unit tests pass on commit `abc1234`."
- "The `/health` endpoint returns 200 with a JSON body."
- "Issue #42 acceptance criteria 1, 2, and 3 are satisfied."
- "The deployment to `dev` succeeded and the app responds."

A vague claim ("it works", "looks good") is not a claim. Make it specific or do not claim.

During loop/review work, claim only the non-test checks and review actually
completed. Test-pass examples apply to separate user-approved execution or
supplied CI results. Never convert `not run` into `passed` to close the loop.

### Step 2 -- RUN the verification command

Execute the permitted command that proves the claim, against the current
revision. Inside loops and reviews, this MUST be a non-test check. Suite
execution follows `.github/AGENT-PROTOCOL.md` section 1.4 only after successful
loop completion and an explicit user decision. Examples:

| Claim | Command |
|-------|---------|
| Tests pass, after separate approval | `dotnet test` / `pytest -x` / `npm test` |
| Build is clean | `dotnet build -warnaserror` / `tsc --noEmit` / `cargo build --release` |
| Endpoint works | `curl -sfS http://localhost:PORT/health` |
| Linter clean | `eslint . --max-warnings 0` / `ruff check .` |
| Loop complete | `.frontier/runtime/frontier.ps1 loop status` |

Do not skip to Step 5 from memory. Run it now.

### Step 3 -- READ the actual output

Read every line of the output. Do not skim. Look for:

- Non-zero exit codes
- The word `FAIL`, `error`, `panic`, `unhandled`, `warning` (when warnings are errors)
- Skipped tests that should not be skipped
- Test counts (did the runner actually find your tests?)
- The current commit SHA in the output, not a cached SHA

### Step 4 -- VERIFY the output matches the claim

Compare the output against the claim from Step 1.

- Claim: "All 247 unit tests pass." Output shows `246 passed, 1 skipped`. CLAIM IS FALSE. Investigate the skip.
- Claim: "Build is clean." Output shows `0 errors, 3 warnings`. CLAIM IS PARTIALLY FALSE. Either address the warnings or restate the claim as "Build has 3 warnings, listed below."
- Claim: "Endpoint returns 200." Output shows `HTTP/1.1 200 OK` with an empty body. CLAIM IS PARTIALLY FALSE. State the body separately.

### Step 5 -- ONLY THEN report

Report completion with:

1. The claim from Step 1
2. The command from Step 2
3. A 1-3 line excerpt from the output (the line that proves it, not the whole log)
4. The commit SHA or build ID
5. Any caveats discovered in Step 4

If Steps 1-4 did not produce a clean result, the report is "NOT COMPLETE" plus the failure. Do not soften.

## Frontier Wiring

This skill is referenced from:

- **Engineer agent** -- before `loop complete` and before status `In Review`
- **Reviewer agent** -- before setting `APPROVED` on Pass A or Pass B
- **Tester agent** -- before marking a certification report green
- **DevOps agent** -- before claiming deployment success
- **`.frontier/runtime/frontier.ps1 loop complete`** -- the CLI gate that blocks handoff when the loop is not actually complete

When this skill fires, the agent MUST cite the command and the output excerpt in the loop's `iterate` or `complete` summary.
After `loop complete` succeeds, the owning agent MUST ask whether to run the
test suite and wait. A delegated reviewer returns findings without launching
suites or issuing the parent's consent question.

## Error Handling

| Symptom | Action |
|---------|--------|
| Command fails on the current commit | Do not report completion. Fix the failure, then re-run the gate. |
| Command hangs | Treat as failure. Investigate before claiming completion. |
| Command output is suspiciously fast (no tests found, cached result) | Force a clean run. `dotnet test --no-build` is not a substitute for `dotnet test`. |
| Cannot run the command locally | Run it in CI on the current commit and link the run. Do not claim completion from a prior run. |
| The claim is unprovable in the current environment | Restate the claim as "claimed but not verified in this session" and surface the gap. |

## Checklist

Before reporting completion, confirm:

- [ ] Claim is stated in one specific sentence
- [ ] Verification command was run on the current commit
- [ ] Full output was read, not skimmed
- [ ] Output matches the claim, including counts and codes
- [ ] Report cites the command, the output excerpt, and the commit SHA
- [ ] If anything in the output contradicts the claim, the claim was retracted or narrowed

## See Also

- [Iterative Loop](../iterative-loop/SKILL.md) -- the surrounding loop that this skill gates
- [Testing](../testing/SKILL.md) -- what counts as a meaningful test run
- [Systematic Debugging](../systematic-debugging/SKILL.md) -- what to do when verification fails
- [Karpathy Guidelines](../karpathy-guidelines/SKILL.md) -- the broader LLM-pitfall context