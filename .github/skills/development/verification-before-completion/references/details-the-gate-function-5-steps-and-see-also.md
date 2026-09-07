# verification-before-completion: The Gate Function (5 Steps), AgentX Wiring, See Also

> MUST read before work involving **the gate function (5 steps), agentx wiring, see also**. This reference preserves complete source guidance relocated for context-budget compliance.

## The Gate Function (5 Steps)

Execute these five steps before any completion claim. No exceptions.

### Step 1 -- IDENTIFY the claim

State the claim out loud, in writing, in one sentence. Examples:

- "All unit tests pass on commit `abc1234`."
- "The `/health` endpoint returns 200 with a JSON body."
- "Issue #42 acceptance criteria 1, 2, and 3 are satisfied."
- "The deployment to `dev` succeeded and the app responds."

A vague claim ("it works", "looks good") is not a claim. Make it specific or do not claim.

### Step 2 -- RUN the verification command

Execute the exact command that proves the claim, against the current commit. Examples:

| Claim | Command |
|-------|---------|
| Tests pass | `dotnet test` / `pytest -x` / `npm test` |
| Build is clean | `dotnet build -warnaserror` / `tsc --noEmit` / `cargo build --release` |
| Endpoint works | `curl -sfS http://localhost:PORT/health` |
| Linter clean | `eslint . --max-warnings 0` / `ruff check .` |
| Loop complete | `.agentx/agentx.ps1 loop status` |

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

## AgentX Wiring

This skill is referenced from:

- **Engineer agent** -- before `loop complete` and before status `In Review`
- **Reviewer agent** -- before setting `APPROVED` on Pass A or Pass B
- **Tester agent** -- before marking a certification report green
- **DevOps agent** -- before claiming deployment success
- **`.agentx/agentx.ps1 loop complete`** -- the CLI gate that blocks handoff when the loop is not actually complete

When this skill fires, the agent MUST cite the command and the output excerpt in the loop's `iterate` or `complete` summary.

## See Also

- [Iterative Loop](../../iterative-loop/SKILL.md) -- the surrounding loop that this skill gates
- [Testing](../../testing/SKILL.md) -- what counts as a meaningful test run
- [Systematic Debugging](../../systematic-debugging/SKILL.md) -- what to do when verification fails
- [Karpathy Guidelines](../../karpathy-guidelines/SKILL.md) -- the broader LLM-pitfall context