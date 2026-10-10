---
title: HydraFusion execution engine
description: Opt-in, experimental candidate generation with Frontier-owned isolation, budgets, validation and acceptance.
---

HydraFusion is an opt-in, experimental candidate generator. GitHub chooses its
Single, Cascade or Critique workflow; Frontier owns isolation, budgets,
validation and acceptance. Native execution remains the default. Use this
initial pilot for bounded read/edit tasks, not unattended deployment, shell
automation or a replacement for independent review.

Native entry requires `--interaction autonomous` for the explicitly authorized
candidate task. MCP obtains that authorization through client form elicitation.
Selecting `executionEngine=hydrafusion` alone does not grant it.

Requirements are Copilot CLI 1.0.89 or later with the required isolation flags,
a supported Copilot account, Git, PowerShell, an initialized Frontier workspace
and an active owner quality loop. The adapter runs the CLI in a private home;
authentication is supplied only through its process environment using
`COPILOT_GITHUB_TOKEN` or Frontier's existing GitHub-token helper.

Set an explicit aggregate credit budget in `.frontier/config.json`; the following
is an example budget, not an estimated charge:

```json
{
  "executionEngine": "native",
  "hydrafusion": {
    "maxAiCredits": 60,
    "timeoutMinutes": 15,
    "maxAttempts": 2
  }
}
```

```powershell
.\.frontier\runtime\frontier.ps1 engine
.\.frontier\runtime\frontier.ps1 loop start -p "Implement the login form"
.\.frontier\runtime\frontier.ps1 run engineer "Implement the login form" --engine hydrafusion --max 12
```

`engine` inspects CLI version/capabilities without a model call; it does not
verify account entitlement or certify production readiness.

## Candidate lifecycle

1. Capture eligible current working-tree bytes, including dirty and untracked
   inputs, in an independent snapshot repository outside the source checkout.
   No Git metadata, remote, hardlink or branch is shared with the original.
2. Generate a temporary unpinned agent and a native `preToolUse` policy. Only
   contained read/search/edit tools are available. Shell, web, MCP and nested
   agent tools are unavailable; extra `allowTools` grants are rejected.
3. Run one bounded CLI attempt. Require a resolved HydraFusion route, matching
   phase completions, a successful terminal result and well-shaped usage data.
   Exceptions and cancellation stop the owned process before artifacts freeze.
4. Audit the full candidate filesystem, independently of the CLI's change list.
   Check additions, deletions, rename sources, ignored additions, links and
   protected paths. Save a binary-capable patch and content/policy hashes.
5. Return `candidate_ready` with exit code `3`. The source checkout is unchanged.
   `watch`, `sprint` and MCP treat this as pending rather than delivered work.
   The `ship` delivery wrapper refuses to advance while a candidate is pending.
6. A separate reviewer inspects the frozen candidate. The owner records that
   review, then explicitly accepts it. Promotion verifies the source baseline,
   exact candidate bytes, policy and approval before applying any patch.
7. The applied revision remains `applied_pending_verification`. Verify the actual
   source revision and obtain a fresh independent review before completing the
   owner loop. Candidate approval alone cannot satisfy `loop complete`.

Records and the owner-loop budget ledger live in
`.frontier/state/hydrafusion/`. The record identifies the retained temporary
workspace, patch, response and hashes; the task itself is stored only as a hash
in Frontier's record. The private CLI profile is removed after confirmed
termination. Inspect or discard owned artifacts with:

```powershell
.\.frontier\runtime\frontier.ps1 engine inspect <candidate-id> --json
.\.frontier\runtime\frontier.ps1 engine discard <candidate-id>
```

The host-side record, process receipts and budget ledger are durable under
`.frontier/state/hydrafusion/`; they do not depend on the temporary snapshot
surviving OS cleanup. Losing that snapshot prevents new acceptance or refinement,
but a stopped, unpromoted record can still be discarded. Already applied work
still needs final source review, and losing temporary files does not erase that
review obligation or block a review that was properly completed.

Discard is only for candidates that have never started promotion. Applied,
mid-apply and recovery-required records cannot be erased with this command.
The delivery gate checks every attempt, not just the latest; only the latest
settled candidate can be accepted. A discarded task still needs a fresh
independent source review before the owner loop can complete.

## Independent review and promotion

Use the canonical code-quality rubric against the retained candidate workspace.
The report also needs `verdict` and a `candidate` object containing the exact
`runId`, `baselineSha256`, `patchSha256`, `responseSha256`, `manifestSha256` and
`policySha256` values shown by `engine inspect`. Do not synthesize reviewer
scores or treat the worker's own response as an approval.

The review file MUST be under the source workspace's `.frontier/state/`, outside
the candidate. The owner records the actual independent review through the
existing loop mechanism:

```powershell
.\.frontier\runtime\frontier.ps1 loop iterate -s "Independent candidate review" -e .frontier\state\candidate-review.json --verdict approved --reviewer <reviewer-id> --high 0 --medium 0 --low 0
.\.frontier\runtime\frontier.ps1 engine accept <candidate-id> --review .frontier\state\candidate-review.json
```

An approval label is insufficient: the report digest must match the archived
owner-loop evidence, all candidate bindings must match, and the canonical
validator must accept the report. The host/controller is trusted to attest
actual reviewer independence; hashes prove content binding, not human identity.

Promotion needs a quiescent checkout. Frontier's lock serializes Frontier
operations, not unrelated editors. Drift or conflicts reject promotion; an
interrupted or partially failed application is `recovery_required`. Inspect
the source and retained candidate rather than rerunning or rolling back the
whole working tree automatically. Application does not stage or commit files.

## Interrupted execution recovery

Each launch writes a host-owned process receipt containing PID, executable and
process-start identity; PID reuse does not authorize terminating another
process. A durable zero-usage `preparing` record precedes budget reservation, so
setup failures before scratch creation remain recoverable. Cancellation records
a stopped terminal state even when PowerShell
skips its `catch` block. If an outer host terminates the owner before `finally`
finishes, use:

```powershell
.\.frontier\runtime\frontier.ps1 engine recover <candidate-id>
.\.frontier\runtime\frontier.ps1 engine discard <candidate-id>
```

Recovery acquires the workspace lock, stops the recorded child if necessary,
reconciles the active ledger marker once, and marks billing unknown rather than
refunding the attempt. It never promotes output or authorizes another model
call. Repeating recovery after a partial ledger write is safe; a completed
failure retains its original status, reason and known billing. A missing receipt
or interruption before child identity capture cannot
be repaired by guessing a PID: confirm process-tree shutdown externally and
cancel that owner loop explicitly. Recovery does not resolve a partial source
promotion; retain those artifacts for manual postimage inspection.

For `applying` or `recovery_required` after promotion, stop editing and inspect
the candidate manifest and the actual source files. Manually finish the named
changes or restore their recorded preimages without touching unrelated user
work. Then cancel the old owner loop and start a new one with
`--include-existing-changes`, referencing the retained run ID and recovery
evidence. Verify the repaired source and obtain a fresh independent review in
that loop before completion. Do not repeatedly call accept, or delete records
to bypass this recovery boundary.

## Bounded refinement and budgets

- There are no automatic retries, fallbacks or unbounded self-review loops.
  Default maximum is two attempts; the configurable range is one to three.
- Attempt two needs independently recorded `changes-requested` feedback bound
  to attempt one's candidate, with a nonempty `feedback` string in the report.
  Repeat the same task/role with `--feedback <report.json>`. A patch or no-change
  response repeated from any earlier attempt stops as `no_progress`, including
  an A-to-B-to-A cycle.
- One locked owner-loop ledger reserves attempts and accumulates observed model
  calls, credits and active elapsed time. A fresh run ID cannot reset it.
  Unknown usage blocks another attempt; failures and rejected work are retained.
- `--max` limits observed model-call starts across the task, including compound
  legs. A call-start event can arrive after dispatch, so termination is not a
  guarantee of zero overshoot. Copilot's AI-credit cap is also soft.
- Credit budgets must be explicit integers from 30 to 100000. Time budgets are
  one to 120 minutes across attempts; insufficient remaining budget stops work.
  MCP adds its existing ten-minute transport deadline and passes a shorter
  inner deadline to leave cleanup time. Forced transport termination can still
  require `engine recover`.
- Native `harness.tokenBudget`, `--model`, native-session resume and extra tool
  grants are unsupported by this adapter and rejected rather than silently
  ignored. Choose `--engine native` when those contracts are required.

## Isolation limits and pilot qualification

Snapshot limits are 20000 files, 32 MiB per file, 512 MiB total and 100000
filesystem entries. Excluded inputs include secrets, links, generated/vendor
output, mutable Frontier state and executable discovery configuration.
Omissions are recorded; if required context is excluded, use the native engine.

Private configuration and explicit native hooks prevent inherited permission
approvals from authorizing model edits. Hook errors deny operations; GitHub
documents hook timeouts as fail-open, so there is no blanket write grant and
candidate validation remains independent. This is application-level isolation,
not an OS sandbox against a malicious CLI binary or administrator.

Earlier one-file smoke runs established that CLI delegation can work, not that
HydraFusion beats the current native model configuration. Before expanding this
pilot, compare matched, representative coding tasks with the same acceptance
checks and budgets. Record accepted-task success, all-attempt cost, latency,
review effort and failure/cancellation behavior. Missing measurements remain
unknown. Live comparisons require an explicit budget; offline fixtures do not
establish model quality or cost savings.

References: [HydraFusion announcement](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/),
[Copilot CLI command reference](https://docs.github.com/en/copilot/reference/cli-command-reference),
and [custom agent tool aliases](https://docs.github.com/en/copilot/reference/custom-agents-configuration#tool-aliases).

---
