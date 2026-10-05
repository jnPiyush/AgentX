---
title: Quality loop operations
description: Prepare loops faster without weaker gates, handle advisory lint, and recover evidence verification.
---

## Faster loop preparation without weaker gates

The **Frontier: Iterative Loop** menu includes `preflight`, `review-packet`,
`boundary-review` and `timing`. MCP hosts use `frontier_loop_prepare` with the
corresponding action. The same native commands are available in a terminal:

```powershell
.\.frontier\runtime\frontier.ps1 loop preflight --json
.\.frontier\runtime\frontier.ps1 loop review-packet --stage boundary --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop review-packet --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop reviewer-check --packet <generated-packet-path> --reviewer <id>
.\.frontier\runtime\frontier.ps1 loop timing --phase implementation
.\.frontier\runtime\frontier.ps1 loop timing --phase waiting
.\.frontier\runtime\frontier.ps1 loop timing --stop
.\.frontier\runtime\frontier.ps1 loop timing --json
```

Substitute an existing workspace-relative requirements file for
`docs\contract.md`. Preparation writes only beneath the selected Frontier state
root, including private profiles. `loop start` captures a source baseline;
upgrading during an active older loop uses the whole pending worktree
conservatively instead of inventing an earlier baseline.

Preflight runs built-in non-test checks, not package scripts. It parses changed
PowerShell/JSON, checks JavaScript/TypeScript syntax and common Mocha declaration
placement without executing tests, typechecks affected TypeScript projects, and
runs one batched advisory scrub. Install-manifest and tracked-document mirror
checks apply to a Frontier source checkout before final review and completion.
Ordinary iterations defer delivery checks while the implementation is changing.
Missing required tools, parsing failures and timeouts do not count as passing.
Unsupported languages and actual UI/runtime behavior still require separate
verification evidence.

Successful receipts can be reused only for matching file bytes and membership,
checker/tool identity and workspace/loop identity. Reuse retains the original
execution timestamp and immutable receipt digest; `--force` reruns eligible
checks. JavaScript checks include package parsing-mode inputs; manifest changes
also select unchanged scripts within the affected package. New receipts become
cache-eligible only after the complete input snapshot passes the drift check.
Ancestor package context is compared to the immutable loop-start baseline, so
failed retries cannot drop affected scripts. An older or missing package baseline
selects scripts conservatively rather than assuming that the context was stable.
Typechecks run fresh when the full installed dependency closure is not
fingerprinted, with any incremental/composite metadata redirected to a unique
file in selected state. Cosmetic whitespace does not fail the correctness diff
check; conflict markers and Git errors still do. Receipt corruption fails explicitly. Preflight never installs
dependencies, edits source, executes suites or caches mutation authorization.

Review packets carry full final scope, factual check receipts, requirements
references and prior findings. Follow-ups prioritize changed files and affected
project consumers. Shared-runtime, dependency and contract changes request full
review. This prioritization is not a complete dependency graph and never inherits
approval. The final reviewer still scores the complete final scope.

Run the capability diagnostic in the actual reviewer host. A successful call
proves file/diff access for that caller only; it does not attest model identity
or grant a read-only sandbox. A reviewer without usable tools must report that
before attempting substantive review. Boundary packets guide the existing early
design checkpoint for high-risk work, not another universal approval round.

Timing separates explicitly attributed implementation, verification, review,
rework and waiting wall time. Preflight records its own phase, and final packet
creation starts review attribution. Unreported intervals remain unattributed;
these numbers are not CPU/model time and must not be added to per-check durations.
Review completion and user-approved test execution remain separate milestones.

---

## Advisory lint and optional cleanup

Lint/hygiene checks still run during loops and reviews, but cosmetic findings
are LOW advisories rather than local Done Criteria. Use:

```powershell
pwsh .\.frontier\runtime\frontier.ps1 scrub -Path <changed-area> -Advisory
```

The scan is read-only. It preserves original tool severity and strict-gate
metadata, reports LOW candidates and does not block local completion for those
findings. A scan failure is still an error, and exit code zero does not mean
lint is clean. `-Advisory` cannot be combined with `-Fix` or `-Production`.

The owning agent reports affected files and asks whether you want cleanup.
No affirmative answer means no fixes. Approved cleanup is a separate bounded
task; it is not silently added to feature work. Build/type errors and proven
correctness, security, reliability or accessibility defects retain their
impact-based severity. CI, commit and production checks may still enforce
their existing rules; advisory handling does not waive them.

## Recovering evidence verification

Loop audit subprocesses drain stdout and stderr concurrently under a 30-second
deadline; the code-quality evaluator has 90 seconds, leaving headroom within the
extension's two-minute command limit. A timeout or nonzero checker exit is a
failure, never evidence approval. Completion checks passing counts and final
artifact freshness before the expensive evaluator.

- Checker timeout/startup failure: inspect the reported checker and its dependencies,
  then retry; do not regenerate unrelated test suites or disable verification.
- Missing count: omit it while suites are deferred. Explicit regressed counts
  remain invalid; report the real evidence and offer any retest after the loop.
- Stale final evidence: run a fresh, scoped final check after the review iteration
  and submit its real output. Never touch timestamps or copy old evidence to pass.
- Changed hashes or review findings: refresh non-test checks and obtain a new
  review; suite execution still needs the separate post-loop decision.
- Complete the loop before committing; an active loop is rejected by the commit hook.

Engineer, Architect and UX Designer request GPT-6 Astra; every other agent
requests Claude Opus 5.5. Cross-family review requires a separately invoked
reviewer and host-confirmed model selection. The CLI's automatic self-review
reuses the author's model and effort. Astra resolves only on Copilot without
silent substitution. Opus 5.5 uses adaptive thinking without sampling parameters;
each account must expose the selected model.

Frontier workspaces keep a repository graph that initialization builds in the
background and session starts refresh when stale; sessions receive a bounded
primer and task-specific source pointers without waiting for discovery. Run
`frontier context -q "<task>"` to query it or `frontier context --sync` to update it now.
See [Repository graph context](REPOSITORY-CONTEXT.md) for curation,
incremental refresh, output limits and host-specific startup behavior.

The lifecycle signal hook records event, session and tool metadata only. It does
not persist prompts, tool arguments, tool results or error payloads. This change
does not sanitize historical signal logs; review their retention and access
separately before sharing a workspace or its logs.
