---
title: HydraFusion core execution engine
description: Prepare bounded HydraFusion candidates with isolated execution, independent promotion and explicit release qualification.
---

## Purpose / Big Picture

Provide an opt-in HydraFusion adapter for bounded Frontier read/edit tasks.
Native execution remains the default. A generated candidate requires independent
owner approval, checked promotion and final-state verification.

## Accepted hardening contract

The 2026-09-30 follow-up accepts the read-only review recommendation: keep
HydraFusion opt-in, isolate candidate generation, and preserve Frontier's
approval and budget boundaries. This section supersedes the earlier direct-write
implementation below; earlier measurements remain historical evidence only.

Execution uses one implementation owner and a separate independent review.
No model council or paid model evaluation is authorized by this implementation
task. The architecture alignment check approved the design subject to explicit
review custody, input stability, process termination and aggregate budgeting.

Alternatives considered before implementation:

- Patching only the six local defects leaves the original checkout exposed.
- A linked Git worktree isolates files but shares Git metadata with the source.
- An independent snapshot repository, restricted native tools and explicit
  reviewed promotion separate candidate production from acceptance. Selected.

### State and approval

- A successful delegated process produces `candidate_ready`, not task success.
- All runs require an active owner loop and an explicit positive AI-credit
  budget. Native execution remains unchanged and is the default.
- One durable, locked ledger binds a goal and role to the owner loop. Attempts,
  observed calls, credits and elapsed time are cumulative. Default maximum:
  two attempts; no automatic retries. Missing usage blocks refinement.
- A refinement consumes fresh, candidate-bound `changes-requested` feedback
  recorded by the owner through the existing loop review mechanism. Repeated
  patch/result content stops as `no_progress`.
- Acceptance requires matching baseline, policy, manifest, patch and response
  hashes, an independently attributed approval archived in the owner loop,
  zero HIGH/MEDIUM findings, and the existing code-quality validator against
  the frozen candidate. A different reviewer string alone is not approval.
- Applying a candidate requires a quiescent source checkout. Recheck drift
  under the Frontier lock, preserve the source index, and verify exact
  postimages. An interrupted/partial application is `recovery_required`,
  never automatically rolled back over user work or retried.
- The applied revision remains pending final owner verification and independent
  review; candidate approval cannot complete the owner loop.
- Discard cannot remove applied, applying or partially applied history. The
  delivery gate audits all attempts; acceptance is limited to the latest
  settled candidate. Interrupted workers use identity-bound `engine recover`,
  with unknown billing retained and no automatic budget reset.

### Isolation and limits

- Capture current working-tree bytes, including eligible dirty and untracked
  files, into an independent repository without shared Git metadata/remotes.
- Exclude links, sensitive files, mutable Frontier state, executable discovery
  configuration and generated dependencies. Record omissions; never represent
  omitted tracked inputs as candidate deletions.
- A private CLI home, an explicit built-in tool allowlist, and a native
  `preToolUse` hook restrict the initial pilot to contained reads and edits.
  Shell, web, MCP and nested agent tools are unavailable. Policy/configuration
  and protected paths cannot be changed by the worker.
- This is application-level workspace isolation, not an OS sandbox against a
  malicious CLI binary or administrator. Command-hook timeouts can fail open,
  so there is no blanket write grant and the private permission state defaults
  to denial. Candidate validation is independent of CLI usage claims.
- Terminate and confirm the owned process tree on exceptions, cancellation,
  timeout and output-limit exhaustion before freezing or removing artifacts.
- Persist child PID/start-time/executable receipts across owner interruption;
  incomplete launch identity is blocked for manual confirmation, never guessed.
- Generate raw patch bytes through Git's file output so Latin-1 and other
  non-UTF-8 text does not fail decoding after a paid run.
- Require valid route identity, a supported pattern, matched completion and
  terminal result. Reject malformed usage arrays. Explicitly preserve empty
  change collections. Count model-call events against the requested `--max`;
  provider credit limits remain soft rather than guaranteed spending ceilings.

### File and reuse inventory

| Surface | Decision |
|---------|----------|
| `hydrafusion.ps1` | Extend engine selection; share bounded process execution and strict event validation |
| `hydrafusion-policy.ps1` | New: native hook entry point and shared path/boundary rules |
| `hydrafusion-protocol.ps1` | New: bounded process lifecycle and strict event/usage state machine shared by execution and validation |
| `hydrafusion-workspace.ps1` | New: snapshot, candidate/ledger persistence and reviewed promotion |
| `agentic-runner.ps1`, `frontier-cli.ps1`, MCP server | Extend existing execution/result contracts; pending is not completion |
| `scripts/score-code-quality.ps1` | Reuse unchanged against the retained candidate |
| Existing install manifests and asset copier | Register the runtime helpers; do not copy framework trees into consumer workspaces |
| Existing behavior suite and mock CLI | Extend with isolation, authorization, failure and budget regression cases |
| GUIDE, protocol, CHANGELOG, learning | Update only the changed contracts and record evidence honestly |

### Acceptance and regression mapping

| Criterion | Required regression |
|-----------|---------------------|
| No orphan process on error | callback failure and cancellation stop the child before returning |
| Recoverable interruption | hard-killed owner settles via recorded child identity; unknown usage stays unknown |
| No source edits before promotion | success, denied write, failure and timeout preserve dirty source bytes and index |
| Full change detection | deleted/renamed sources, ignored additions, links and protected state changes are rejected |
| Valid protocol evidence | completion without resolution, mismatched IDs, invalid patterns/results and null usage fail closed |
| Valid empty change set | a no-change Git candidate remains a valid empty manifest |
| Bounded execution | call, credit, time, output and attempt limits stop without automatic retry |
| Review is independently recorded | missing, self-attributed, unarchived, stale or mismatched approvals cannot promote |
| Stable, one-time promotion | drift/conflicts reject; repeated acceptance is idempotent; source index is unchanged |
| Approval history cannot be hidden | applied/mid-apply/recovery states reject discard; superseded attempts reject acceptance |
| Byte-exact candidate | non-UTF-8 patch export and promotion preserve original bytes |
| Useful refinement | bound feedback required; repeated content stops; unknown usage cannot finance another attempt |
| Honest delivery | candidate and applied-pending-verification states never mark watch/ship work complete |

Suites are authored during the loop and remain not run until the separate
post-loop consent. Syntax, schema, build, scoped static checks and an offline
smoke invocation provide non-test evidence. A matched native-versus-HydraFusion
quality/cost pilot remains an explicit later evaluation, not a claimed gain.

### Current hardening progress

- [x] Accepted scope, alternatives, architecture alignment and contracts recorded.
- [x] Strict protocol/process handling and isolated candidate generation implemented.
- [x] Independent review custody, explicit promotion and owner-loop delivery gate implemented.
- [x] Offline candidate and promotion control-flow diagnostics executed in disposable fixtures.
- [x] Final packaging and static checks (312-entry strict manifest; syntax; four zero-finding advisory scrubs).
- [x] Independent exact-scope review.
- [x] Quality loop completion and post-loop test-suite offer.

The promotion diagnostic uses a synthetic review record for a known fixture.
It proves control flow only and is not an approval of this implementation.
No paid model calls or suites have been run during the hardening loop.

### Independent hardening review, first pass

The reviewer requested changes with four MEDIUM and seven LOW findings.
Fixes close the discard/superseded-candidate approval paths; add persistent
interruption receipts and explicit recovery; make Git produce byte-preserving
patch files; and expand regression cases for protocol, budgets, interruption,
approval custody, links and pipeline pause. The remaining LOW corrections
preserve case-sensitive paths, detect all-attempt cycles, reject obsolete tool
grants, remove repeated policy-path checks and qualify the pilot description.
Final verification and re-review are still required for the revised state.

### Independent hardening review, second pass

The reviewer verified the first-pass fixes and identified two remaining MEDIUM
issues: a successful sprint inherited an advisory Git exit status, and durable
delivery/recovery was coupled to temporary scratch availability. Success now
sets the sprint exit explicitly, while candidate metadata access is separate
from artifact-required acceptance/refinement. Ledger reconciliation is retryable
without overwriting completed outcomes or known billing. The GUIDE describes
manual partial-promotion repair and a fresh include-existing-changes owner loop.
New regression cases cover empty Git history, expired snapshots, partial ledger
writes and the MCP teardown allowance. Suites remain unrun pending consent.

### Final functional advisory

The next review approved the implementation with one LOW setup-interruption
finding. A zero-usage `preparing` record is now published before budget
reservation, and the driver retains it before scratch IO. Recovery and disposal
therefore remain available even if setup fails before the first full run record.
A regression case covers that reservation window; final hash-bound re-review
is required after this correction.

### Hardening outcome

The final independent review approved the corrected scope at 89/100 with zero
HIGH/MEDIUM findings and one cosmetic LOW. The hardening loop completed at
10/20 iterations on 2026-10-01. The owner offered offline suites afterward;
the user was unavailable, so they were not run. The archived review and loop
evidence, not historical live probes, establish this source-review outcome.

### Initial 9.7.0 local release preparation

Use Single for deterministic release assembly, with the separate mandatory
independent review. No execution-controller, cross-family or live-model
qualification is claimed. The rollout strategy remains explicit opt-in; native
execution is unchanged.

Alternatives are to replace the earlier 9.6.2 candidate or prepare a new minor
candidate. Select 9.7.0 for the backward-compatible capabilities and preserve
the existing 9.6.2 artifact and draft. No commit, push, tag, installation or
publication is authorized by this preparation task.

| Step | Acceptance | State |
| --- | --- | --- |
| Metadata | Use the canonical stamp tool across first-party release surfaces | Stamped to 9.7.0 |
| Runtime dependencies | Replace the temporary URI override with a compatible patched release; refresh only affected locks | Complete; both runtime audits report zero vulnerabilities |
| Build and package | Compile through the existing prepublish path; inspect VSIX contents and exact runtime hashes | Complete; 1,666 archive entries, 1,662 byte-compared files |
| Non-test verification | Syntax, frontmatter, strict install manifest, production audits and source/archive parity | Complete; 635 frontmatter checks, 30 parsed scripts, 312 clean manifest entries |
| Independent review | Current scope and evidence; complete the release-preparation loop | Candidate prepared; verdict remains authoritative in loop state |
| Qualification | Approved offline suites, coverage, live hardened CLI and supported-platform evidence | Blocked; not run |
| Publication | Required CI, source approval and explicit publishing authority | Not authorized |

The current MCP runtime audit found moderate advisories in `fast-uri` and
`ip-address`. `fast-uri` 3.1.8 includes the previously pinned upstream fix plus
host-case normalization; `ip-address` 10.7.2 fits its parent's `^10.2.0` range.
The SDK and unrelated transitive dependencies remain unchanged. Fresh audits
report zero vulnerabilities. The VSIX contains 11 canonical runtime entry points
and 200 chat contributions; the standalone MCP server retains its checkout-based
installation rather than becoming an embedded VSIX component.

The local readiness command resolves Copilot CLI 1.0.17, below the required
1.0.89. It confirms native is the default and does not invoke a model. The local
package and qualification handoff are under `dist/vsix/`; the checksum identifies
the exact candidate independently of the uncommitted worktree.

The first release-preparation review requested two MEDIUM evidence corrections:
installed MCP packages still had old bytes despite current npm metadata, and
in-process CLI redirection produced an empty readiness file. Clean restoration
with `npm ci`, physical dependency-resolution checks and child-process JSON
capture now provide retained evidence. The corrected evidence bundle supersedes,
but does not rewrite, the earlier capture; fresh independent approval is required.

Release artifacts MUST include an accurate qualification handoff and checksum.
Earlier approved source and historical passing tests MUST NOT be relabeled as
fresh release evidence. Tests remain outside the loop and require post-loop
consent; live calls also require a separate explicit budget.

### Final 9.7.0 release and local installation

The follow-up request authorizes local VS Code installation, removal of the
candidate designation and the full local suite. It does not authorize publishing
or paid provider calls. Keep native as default and preserve the earlier artifacts.

The approved-revision full run completed: 39 of 42 offline PowerShell scripts
passed; both HydraFusion suites and the framework aggregate failed. Extension
coverage (1,112 tests, 84.29% lines), real Windows Extension Host (2), MCP (15 and
smoke), root JavaScript (29), Bash framework (121) and companion tests all passed.
These results are a baseline, not results for later fixes.

Root cause: Windows can expose a newly started process before `MainModule` is
available. Direct `.FileName` access either fails under StrictMode or publishes
an incomplete receipt. Refreshing metadata within a one-second deadline is the
selected correction. Guessing the executable or retrying until tests happen to
pass is rejected. Missing executable identity continues to block recovery.

The missing-review fixture must use an allowed source-state path to exercise
the missing-file error instead of an earlier containment rejection. Framework
assertions must validate the selected patched releases and the documented
checkout-based MCP distribution, not the superseded temporary commit override
or an unimplemented VSIX MCP bundle.

| Step | Acceptance |
| --- | --- |
| Fix | Bounded process metadata acquisition; fail-closed receipts; deterministic startup regression |
| Verify | Parse, static checks and direct process diagnostic; no suites inside the fix loop |
| Review | Fresh independent exact-scope approval and successful loop completion |
| Retest | Offer a separate post-loop run of the affected suites; retain actual results |
| Package | Use `agentx-9.7.0.vsix`, with release metadata and source/payload hashes |
| Install | Install into stable VS Code and verify registered version and runtime bytes |
| Deliver | Record executed checks, remaining experimental-provider limits and no public release |

## Decision Log: alternatives considered

- Add `hydrafusion` to the native runner's model map. Rejected: the Copilot model
  API catalog (46 models on 2026-09-30) does not list it, and HydraFusion
  orchestrates a whole CLI task rather than answering one completion.
- Pin `model: hydrafusion` in agent frontmatter. Rejected: Copilot CLI 1.0.89
  reports the model as unavailable and falls back to `gpt-5.6-sol`, and VS Code
  would equally lose the Opus 5.5 / GPT-6 Astra routing.
- Delegate the task to Copilot CLI with `--experimental --model hydrafusion`, an
  unpinned temporary plugin copy of the agent, JSON events and post-run checks.
  Selected: it is the supported native selector and it is verifiable.
- Make HydraFusion the default for every task. Deferred: it is an experimental
  preview with per-leg AI credit cost; opt-in keeps behavior and cost explicit.

The user was unavailable for the default-versus-opt-in question; opt-in was
chosen as the pragmatic option and is recorded here.

## Contracts

- `.frontier/runtime/hydrafusion.ps1`: `Resolve-FrontierExecutionEngine`,
  `Get-HydraFusionSettings`, `Resolve-HydraFusionCli`, `New-HydraFusionAgentPlugin`,
  `Invoke-HydraFusionTask`, `Write-HydraFusionRunRecord`.
- `Invoke-AgenticLoop -Engine native|hydrafusion -AllowTools` is the single switch;
  run, watch, ship and MCP inherit it. Delegated clarification responders inside a
  native run stay native because they share the parent's native usage ledger.
- Success (`text_response`) requires a CLI exit of 0, `session.fusion_resolved`
  before any model call, every fusion completed without degradation, a verified
  change set (CLI usage report and/or Git status comparison), and every modified
  file inside the role's boundaries and outside gate files. Other outcomes are
  explicit; violations are detected after the run, not prevented or reverted.
- No `--allow-all`, `--yolo` or broad tool grants; write only for roles with
  write boundaries; shell only through explicit, specific grants.
- Run records hold a prompt hash, never the prompt.

## Plan of Work

1. Probe CLI availability, selector fidelity, custom-agent precedence and events.
2. Implement the engine module and runner switch; CLI flags, `engine` command,
   config validation; MCP `engine`; packaging.
3. Mock-CLI behavior suite; one bounded real end-to-end edit in a disposable repo.
4. Docs, independent review, loop completion.

## Progress: initial implementation (historical)

- [x] Probes recorded (see Evidence).
- [x] Engine, runner switch, CLI, MCP and packaging implemented.
- [x] Behavior suite and real end-to-end run.
- [x] Guide, protocol note, changelog and learning.
- [x] Independent review round 1 findings fixed.
- [ ] Independent re-review and loop completion.

## Validation and Acceptance

- [x] Per-task and workspace-default selection; unknown engines rejected.
- [x] CLI below 1.0.89 or missing fails before any task is sent.
- [x] Unverified, degraded, timed-out, failed and out-of-boundary runs are not
      reported as success; no fallback to another engine or model.
- [x] Report-only roles receive no write grant.
- [x] Real Copilot CLI 1.0.89 run produced a verified fusion and a boundary-clean change.

## Artifacts and Notes: initial integration evidence (historical)

- Evidence: delivery commit 28cdbcea (`feat: harden Frontier execution and Cursor integration (#411)`).

Probes on 2026-09-30 (about 40 AI credits): the Copilot `/models` API has no
HydraFusion; CLI 1.0.84 rejects `--model hydrafusion` and 1.0.89 accepts it with
`--experimental`; a custom agent's `model:` overrides `--model` (usage showed
`gpt-5-mini`), and `model: hydrafusion` in frontmatter falls back to
`gpt-5.6-sol`; an unpinned agent plus `--model hydrafusion` emits
`session.fusion_*` events; plugin agents are addressed `<plugin>:<agent>`; VS Code
tool names are ignored by the CLI, so an early real run could not edit files until
aliases were added.

`tests/hydrafusion-engine-behavior.ps1` (mock CLI) passed 54/54. The real
end-to-end Engineer run created `src/greeting.ps1` with the Critique pattern
(solver `gpt-5.6-luna`, critic `gpt-5.6-terra`), 0.68 AI credits, 25 seconds,
no boundary violations. MCP tests passed 13/13.

## Review round 1

The independent review requested changes (2 MEDIUM, 9 LOW; score 73/100):

- MEDIUM: the boundary check trusted only the usage report, so a missing report
  or a shell/hook write passed as success. Fixed: fail closed when no change
  source exists; in Git work trees compare status and file hashes before and
  after (enclosing repositories count only when they track files in the workspace).
- MEDIUM: the install manifest was stale after a late edit. Regenerated last.
- LOW fixes: incomplete fusions are degraded; `verified` means success and
  `engaged` records routing; `write` grants are refused for report-only roles;
  `node` inside the workspace is refused; unexpected exceptions become structured
  results; the credit cap limit is consistent; native runs survive a missing
  module; a warning explains that `harness.tokenBudget` does not apply; docs no
  longer claim subagent delegation or boundary enforcement. The behavior suite
  grew to 66 checks.

## Rollback

Set `executionEngine` to `native` (or remove it) to stop using the engine;
reverting the module and the `Invoke-AgenticLoop` switch removes it entirely.
Run records under `.frontier/state/hydrafusion/` are local state.
