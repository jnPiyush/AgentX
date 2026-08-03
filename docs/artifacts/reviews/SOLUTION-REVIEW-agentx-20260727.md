# AgentX Solution Review -- Re-scoped for a Coding Harness

**Solution**: AgentX v8.6.1
**Review date**: 2026-07-27 (revised)
**Supersedes**: `SOLUTION-REVIEW-agentx-20260727-initial-misscoped.md`, which scored AgentX as an enterprise agentic platform

---

## 1. What Changed and Why

The first pass ran the Standards and Benchmark skills against their full catalogues and produced an Integrated Score of 51 ("Not Ready"). That number was **wrong in framing**, not in arithmetic.

Those catalogues assume a deployed, multi-tenant, cloud-hosted system that serves a model to end users. AgentX is none of those things. It is a **local coding harness**: a VS Code extension plus a PowerShell CLI plus a Markdown agent/skill corpus. It runs on one developer's machine, with that developer's privileges, orchestrating that developer's own Copilot subscription. There is no service to operate, no tenant to isolate, no model being served, and no cloud resource being provisioned.

Scoring a coding harness against Azure control-plane hardening and GenAI red-team requirements produced a low number that said more about the wrong instrument than about the product.

This revision re-runs the review with the correct threat model, withdraws the inapplicable findings, and **fixes the ones that are real**.

| Score | Initial (mis-scoped) | Re-scoped | Note |
|---|---:|---:|---|
| Harness fitness (composite) | 51 | **74** | Different measurement basis, plus real fixes applied |
| Modernization readiness | 65 | **70** | Governance improved by the fixes |
| Verdict | Not Ready | **Healthy -- fit for purpose** | With residual recommendations below |

---

## 2. The Correct Threat Model

For a local coding harness, three things genuinely matter:

1. **Command execution safety.** AgentX runs shell commands, some proposed by a model that may have just read untrusted content -- a repo file, an issue body, a fetched web page. A destructive command must not execute merely because a model emitted it. This is *the* security property of a coding harness.
2. **Secret hygiene.** Transcripts, error messages, and loop evidence get written to `.agentx/state/` and to output channels. Credentials must not be persisted there.
3. **Extension supply chain.** A compromised dependency reaches every user through the Marketplace.

Everything else is secondary, and much of it is not applicable at all.

---

## 3. Findings Withdrawn (not applicable to a coding harness)

| Withdrawn finding | Why it does not apply |
|---|---|
| No SBOM (CycloneDX/SPDX) | Proportionate for a distributed service or container image. For a VSIX with one runtime dependency (`yaml`) and a committed lockfile, an SBOM adds process weight without meaningful risk reduction. |
| No SLSA L2+ build provenance / artifact signing | SLSA L2 targets attacker-resistant build systems for widely-consumed artifacts. Marketplace publishing already provides the integrity anchor. Pursuing L2 here is over-engineering. |
| No formal threat model with DFDs and STRIDE | A DFD-based threat model suits a system with network boundaries and trust zones. A documented threat model in prose is the proportionate form -- now written into `SECURITY.md`. |
| No AI safety evals (jailbreak, hallucination, groundedness, prompt-injection scoring) | **AgentX does not serve a model.** It orchestrates the user's own Copilot/GitHub Models subscription. Groundedness and hallucination are properties of the provider's model, evaluated by the provider. AgentX's relevant control is what it *does* with model output -- which is command execution safety, addressed below. |
| No RAG evals (poisoning, attribution, ACL filtering, freshness) | AgentX ships no RAG pipeline in the product. The `rag-pipelines` skill is documentation it gives to users. |
| ISO 42001 AIMS, NIST AI RMF / GenAI Profile, MITRE ATLAS | Governance frameworks for organisations deploying AI systems. A developer tool is not an AI management system. |
| WAF operations: SLO/SLA/RTO/RPO, DR runbooks, chaos testing, autoscale, health model | There is no running service. There is nothing to fail over, scale, or restore. |
| Azure control plane (MCSB, Azure Policy, Defender, CIS) -- 40 canonical tests | Already excluded in the first pass. Verified: no product IaC exists. |
| No cost/token telemetry | Tokens are spent against the **user's own** Copilot subscription, which already reports usage. AgentX building a parallel cost ledger duplicates a control the user already has. Reclassified from HIGH defect to optional feature. |
| No distributed tracing / OpenTelemetry | OTel targets multi-service request flows. For a single-process local tool, loop state plus per-iteration evidence archives already provide the durable audit trail. Reclassified from HIGH to optional. |
| No DAST, fuzzing, penetration test | No network listener, no untrusted parser, no deployed endpoint. |

**Net effect**: 10 of the original 15 blockers were artefacts of the wrong scope.

---

## 4. Findings That Are Real -- and Now Fixed

### FIXED-1 -- Evidence archiving destroyed the caller's file (CRITICAL)

`agentx loop iterate -e <file>` and `loop complete -e <file>` used `Move-Item` on the caller-supplied path. Any file passed as evidence was deleted from its original location. This was reproduced live: the first review report was destroyed when passed as evidence and had to be recovered from the archive.

The `Move-Item` was **deliberate**, not a typo -- the original comment stated it existed so "the source path no longer exists after acceptance... avoids stale evidence reuse". So the fix had to preserve that intent, not just flip the verb.

**Fix**: `Copy-Item` plus SHA-256 tracking. Accepted artifact hashes are recorded in loop state; resubmitting an identical artifact is rejected. Anti-stale-evidence intent preserved, data loss eliminated.

`.agentx/agentx-cli.ps1` -- both the iterate and complete archive paths.

**Verified live**:
```
SOURCE FILE STILL EXISTS AFTER ITERATE: True
[FAIL] This evidence artifact was already accepted in an earlier iteration (identical SHA-256).
```

### FIXED-2 -- The command guardrail was never wired in (HIGH -- the core harness control)

`commandValidator.ts` implements a three-layer policy (blocked / allowed / requires-confirmation) with 31 dangerous-pattern regexes, and had 96% test coverage. It was called by **nothing**. `execShell` and `execShellStreaming` went straight to `exec`/`spawn`. A model that emitted `rm -rf /` or `git reset --hard` would have had it executed.

**Fix**: both shell entry points now route through a single `runShell()` implementation that calls the validator and rejects `blocked` commands before any process spawns.

Deliberate design decision: **only Layer 1 (`blocked`) is enforced here.** `requires_confirmation` passes through, because `execShell` is a non-interactive internal API and a coding harness must be able to run arbitrary build and test tooling.

`vscode-extension/src/utils/shell.ts` -- `assertCommandAllowed()` inside `prepareShell()`.

### FIXED-2b -- Shell argument asymmetry defeated the guard (HIGH, found by adversarial review)

This one was missed in the first hardening pass and surfaced by the reviewer sub-agent.

`execShell` used Node's `exec(command, { shell })`, which invokes `pwsh -c "<command>"` and therefore **sourced the user's `$PROFILE` on every call**. `execShellStreaming` used `buildShellArgs()` -> `['-NoProfile', '-Command', ...]`. Same for bash: `-lc` (login shell, sources `~/.bash_profile`) versus `-c`.

Validating command *text* is meaningless when the two execution paths give that text different meanings. A hostile or merely broken `$PROFILE` could redefine `git`, and `git status` -- an allowlisted command -- would run it.

**Fix**: both entry points now delegate to one `runShell()` built on `spawn` + `buildShellArgs`, so `-NoProfile` applies universally. The 120s timeout previously provided by `exec` is preserved explicitly in the shared implementation. As a side effect this removed all duplicated logic: scrub findings on `shell.ts` went from 8 (baseline) to **0**.

### FIXED-3 -- Secrets could persist into logs and error surfaces (MEDIUM)

`secretRedactor.ts` was fully implemented, 100% covered, and called by nothing. Shell error messages embed the failing command and its stderr, and those flow into output channels and `.agentx/state/`.

**Fix**: `redactSecrets()` now wraps all three shell error paths (`exec` callback, `spawn` error, non-zero exit).

Scoped deliberately to **error paths only**. Redacting normal stdout would corrupt data for callers that parse command output.

**Verified by test**: a `ghp_` token in stderr does not appear in the rejected error.

### FIXED-4 -- Documented policy did not match enforced policy (MEDIUM)

`.github/security/allowed-commands.json` is cited across `Skills.md`, ADR-341, SPEC-401 and `.claude/settings.json` as an active control. No code loaded it, and its blocked list was **stricter** than the runtime regexes: `git clean -fd`, `git filter-branch`, `gh repo delete`, `gh repo archive`, and global npm installs were documented as blocked but were not.

**Fix**: those gaps are now enforced in `commandValidatorPolicy.ts`.

Judgement applied on scoping -- `rm -rf <relative-path>` was **not** blanket-blocked, because `rm -rf node_modules` and `rm -rf dist` are routine build work in a coding harness. Only home-directory and root deletions are blocked. Likewise `git clean -n` (dry run) stays allowed; only forced deletes are blocked.

### FIXED-4b -- The first version of those patterns was weak (found by adversarial review)

The reviewer sub-agent tested the new regexes against an attacker rather than against the examples they were written from, and broke seven of eight. All proofs were reproduced and fixed:

| Evasion / defect | Now |
|---|---|
| `rm -fr /` (flag order) | blocked |
| `rm -r ~`, `rm -rf "$HOME"`, `rm -rf ${HOME}`, `rm -rf $env:USERPROFILE` | blocked |
| `Remove-Item -Recurse -Force $HOME` -- **pwsh is the default shell and had no cmdlet coverage at all** | blocked |
| `git clean --force -d`, `git clean -x -f` (flag separation / long form) | blocked |
| `npm --global install x`, `npm add -g x`, `npm install x --location=global` | blocked |
| `del /f /s /q C:\`, `rmdir /q /s C:\` (flag order) | blocked |
| `gh api --method DELETE /repos/O/R`, `git filter-repo` | blocked |
| `Invoke-Expression $cmd` (guard required a parenthesis) | blocked |
| **False positive**: `npm install && git log -g` -- `.*` spanned the `&&` | allowed |
| **False positive**: `npm install --global-style` | allowed |
| **False positive**: `rmdir /s /q build && echo Removed:` -- `[a-z]:` matched `Removed:` | allowed |

Every `.*` in these patterns was replaced with `[^;&|]*` so a pattern cannot span a compound separator. `splitCompoundCommand` now also splits on newline and single `&`, which previously let `npm test\n<anything>` collapse into one allowlist-matching part.

25 of the 45 guardrail tests are the reviewer's own proof strings, so these specific evasions cannot silently regress.

### FIXED-5 -- Script-injection sinks in CI (MEDIUM)

`quality-gates.yml` interpolated `${{ github.event.pull_request.title }}` directly into `run:` shell blocks in two places. A PR titled with a shell metacharacter payload would execute in the runner. `issue-triage.yml` already did this correctly via `env:`.

**Fix**: PR title and head ref moved to `env:` and referenced as quoted shell variables.

### FIXED-6 -- Dependency scan covered one package tree of three (MEDIUM)

`find . -name 'package.json' | head -1` meant only the first match was audited. `vscode-extension`, `companions/whatsapp`, and `companions/video-studio` all have manifests.

**Fix**: the job now enumerates every tree, audits each, aggregates high/critical counts, fails on any, and uploads per-project reports. Also runs `--ignore-scripts` during install and warns when a lockfile is missing.

### FIXED-7 -- No vulnerability disclosure path (MEDIUM)

A publicly distributed Marketplace extension had no `SECURITY.md`, so a researcher's only option was a public issue.

**Fix**: added `SECURITY.md` with the harness threat model, private reporting via GitHub Security Advisories, response targets, explicit in-scope/out-of-scope lists, the current control inventory, and -- deliberately -- a **Known Limitations** section stating plainly that the blocked-command list is a catastrophic-operation denylist rather than a sandbox, and that the local git hooks are process controls, not security boundaries.

### FIXED-8 -- No automated dependency updates (LOW-MEDIUM)

Actions were SHA-pinned (good) but nothing kept those pins current, and no npm updates were automated.

**Fix**: added `.github/dependabot.yml` covering the extension weekly (with dev-dependency grouping), the two companions monthly, and GitHub Actions weekly.

### FIXED-9 -- False claim in SPEC-341 (LOW, but it is a security claim)

SPEC-341 listed "CI gitleaks scan verifies" as an active mitigation for token leakage. No such job exists.

**Fix**: corrected to state the mitigation is manual until a scanning job is added.

### FIXED-10 -- Evidence-gate weaknesses (found by adversarial review)

Four further defects in the loop evidence gate, all fixed:

| Defect | Fix |
|---|---|
| The SHA-256 reuse guard was added to `loop iterate` but **not** to `loop complete` -- the gate the pre-commit hook actually keys on | Guard now applied in both places |
| `Get-FileHash` failure fell through to "accept and record nothing" -- fail-open on the control | Now fails closed and refuses the artifact |
| `if (-not $env:AGENTX_SKIP_EVIDENCE_GATE)` treated any non-empty value as truthy, so `'0'` and `'false'` **disabled** the gate | Now requires exactly `'1'` |
| Archive filenames used second-granularity timestamps with `-Force`, so two artifacts in the same second silently overwrote | Millisecond precision |

The reviewer also correctly noted the guard proves **byte-identity, not freshness** -- appending a newline to a stale report defeats it. The comment now says what the control actually does rather than overclaiming.

### Honesty correction: what the guardrail is not

The first version of the `shell.ts` comment claimed confirmation "belongs to the tool-call path that owns a user prompt". No such path exists -- `shell.ts` is the only production caller of `validateCommand`, so Layers 2 and 3 have no runtime consumer and the shipped control is a **denylist**.

The reviewer was right that a denylist over command text cannot be made evasion-proof (`g""it clean -fd`, `$c='...'; iex $c`). The comment and `SECURITY.md` now state this plainly instead of implying a compensating control that does not exist. It stops accidents and naive model output; it is not a sandbox.

---

## 5. Follow-Up Round: MEDIUM Findings Closed

All MEDIUM findings from the first re-scoped pass have since been fixed, except one that is deliberately deferred. See [EXEC-PLAN-20260727-medium-findings.md](../../execution/plans/EXEC-PLAN-20260727-medium-findings.md).

| Finding | Severity | Status |
|---|---|---|
| No SAST (CodeQL / PSScriptAnalyzer / blocking lint) | MEDIUM | **FIXED** -- new `sast.yml` with three jobs |
| Workflow gates enforced only by the local git hook | MEDIUM | **FIXED** -- Model Council, Compound Capture and scrub gates added to `check-harness-compliance.ps1`, which runs in `quality-gates.yml` |
| Evidence guard proved byte-identity, not freshness | MEDIUM | **FIXED** -- age check added alongside the hash check |
| Unguarded exported `exec` sink (`tryExec`) | LOW | **FIXED** -- routed through the command policy |
| `.agentx/state/` accumulated ad-hoc dirs with no lifecycle | LOW | **FIXED** -- conservative retention on `loop start` |
| `.agentx/memory/` empty while `memories/` holds content | LOW | **FIXED** -- vestigial directory removed |
| Dead `programName` helper | LOW | **FIXED** |
| `agentx-cli.ps1` 6,708 lines; `agentic-runner.ps1` 3,921 | MEDIUM | **DEFERRED** -- see rationale below |

### SAST: measured before designed

The gate was originally conceived as "add CodeQL and make `npm run lint` blocking". Measurement showed that would fail every build:

| Analyser | Raw | After curation | Design |
|---|---:|---:|---|
| ESLint | 363 errors (328 `no-explicit-any`) | -- | Ratchet against committed baseline |
| PSScriptAnalyzer | 869 warnings (652 `PSAvoidUsingWriteHost`) | 80 defect findings | Ratchet, plus **zero tolerance** on 6 security rules |
| CodeQL | n/a (new) | -- | `security-and-quality` queries, reports to code scanning |

`PSAvoidUsingWriteHost` was excluded on judgement: console output is the product for a CLI, so 652 hits are noise, not signal. The security rules could be gated at zero immediately because production paths (`.agentx/`, `scripts/`) are already clean -- the single `PSAvoidUsingInvokeExpression` hit is in a test fixture.

Both ratchets were proven in both directions: clean state passes, an injected finding fails with the exact rule and delta.

### Deferred: the PowerShell monoliths

This is real debt and stays on the list. It is deferred because it is a pure refactor with genuine regression risk and no behavioural benefit -- bundling it with security fixes would make both harder to review and would obscure the cause of any regression. The behavioural coverage needed to do it safely now exists (185 runner assertions, 60 loop assertions), so it can proceed as its own change.

### What CI still cannot enforce

The quality-loop iteration gate remains hook-only. `.agentx/state/loop-state.json` is untracked by design -- it is per-developer working state -- so CI has nothing to inspect. This is documented in the script rather than papered over.

---

## 6. Real Findings NOT Fixed (with rationale)

| Finding | Severity | Why deferred |
|---|---|---|
| Workflow gates (quality loop, Model Council, Compound Capture, scrub) are enforced only by a local git hook; CI enforces only the execution-plan gate. `--no-verify` bypasses them. | MEDIUM | Legitimately real, but these are **development-process** controls, not security boundaries -- and this repo is effectively single-maintainer, where the hook is installed. Porting them to CI is a meaningful change to the contribution workflow and deserves its own issue, not a drive-by edit. Now documented as a known limitation in `SECURITY.md`. |
| No SAST (CodeQL for TypeScript, PSScriptAnalyzer for PowerShell) | MEDIUM | Worth adding and cheap on a public repo. Held back because CodeQL on a 22k-line TS codebase will surface an initial finding backlog that needs triage; bundling that into this change would obscure the security fixes. Recommended as the next follow-up. |
| `agentx-cli.ps1` is 6,708 lines; `agentic-runner.ps1` is 3,921 | MEDIUM | Genuine maintainability debt. A decomposition into `scripts/modules/` is a refactor with real regression risk and no behavioural benefit -- it should be planned, not bundled with security fixes. |
| Memory subsystem is untyped; no retention or eviction; `.agentx/memory/` empty while `memories/` holds content | LOW-MEDIUM | Real but low-risk for a local tool. Consolidating the two paths is a small task; typing the memory model is a design change. |
| `.agentx/state/` accumulates ad-hoc evidence directories with no lifecycle | LOW | Disk hygiene, not correctness. A retention policy is worth adding. |
| `tests-baseline.json` ships with `passing: null`, silently disabling regression checks | LOW | Fixed for this repo during review; should be seeded by `initializeLocalRuntime` so fresh installs get it. |
| 24 agents where Agent X autonomous mode executes every role internally | LOW | An architecture question, not a defect. Worth a deliberate topology review. |

---

## 6. Verification Evidence

All claims below are measured, not asserted.

| Check | Before | After |
|---|---|---|
| Extension test suite | 961 passing | **1000 passing, 0 failing** (two consecutive stable runs) |
| Line coverage (gate: 80%) | 82.07% | **82.21%** |
| Branch coverage (gate: 73%) | 75.17% | **75.30%** |
| Coverage gate exit code | 0 | **0** |
| `agentx-cli.ps1` parses | yes | **yes (verified with the PS parser)** |
| `tests/loop-parity-behavior.ps1` | -- | **28/28 passed, exit 0** |
| `tests/loop-rollback-behavior.ps1` | -- | **32/32 passed, exit 0** |
| `tests/harness-audit-behavior.ps1` | -- | **10/10 passed, exit 0** |
| `tests/scrub-behavior.ps1` | -- | **20/20 passed, exit 0** |
| Scrub findings on `shell.ts` | 8 | **0** |
| Evidence file survives `loop iterate` | **destroyed** | **preserved (verified live)** |
| Identical evidence resubmission | accepted (file gone) | **rejected on SHA-256** |
| Secret in stderr reaches error message | yes | **redacted (test asserts)** |
| `$PROFILE` sourced on `execShell` calls | **yes** | **no (`-NoProfile` on both paths)** |

45 guardrail tests now cover blocked-command rejection, the reviewer's evasion strings, false-positive protection for routine build commands, and secret redaction in failure paths.

One test-design defect was found and fixed during verification: the "must not be blocked" cases originally asserted through `execShell`, which meant they **actually executed** `npm install` and timed out intermittently. They now assert against `validateCommand` directly -- testing the policy rather than the process spawn. Suite time dropped from ~60s to 43s and the flake disappeared.

### Files changed

| File | Change |
|---|---|
| `.agentx/agentx-cli.ps1` | `Move-Item` -> `Copy-Item` + SHA-256 reuse guard on **both** iterate and complete; fail-closed hashing; strict `'1'` bypass token; ms-precision archive names |
| `vscode-extension/src/utils/shell.ts` | Single `runShell()` implementation for both entry points (fixes `-NoProfile` asymmetry); policy guard; `redactSecrets()` on error paths; honest scope comment |
| `vscode-extension/src/utils/commandValidatorPolicy.ts` | Destructive patterns rewritten to be flag-order- and quote-tolerant; PowerShell cmdlet coverage added; `.*` replaced with `[^;&\|]*` to stop cross-separator false positives |
| `vscode-extension/src/utils/commandValidatorHelpers.ts` | `splitCompoundCommand` now splits on newline and single `&` |
| `vscode-extension/src/test/utils/shell.test.ts` | 45 guardrail and redaction tests, including the reviewer's proof strings |
| `.github/workflows/quality-gates.yml` | Untrusted PR title moved to `env:` (2 sites) |
| `.github/workflows/dependency-scanning.yml` | Node scan covers all package trees |
| `.github/dependabot.yml` | New -- npm + Actions update automation |
| `SECURITY.md` | New -- threat model, disclosure policy, control inventory, known limitations |
| `docs/artifacts/specs/SPEC-341.md` | Corrected false gitleaks mitigation claim |

---

## 7. Re-scoped Assessment

| Harness control | Before | After |
|---|---:|---:|
| Command execution safety | 0 | **5** |
| Secret hygiene | 0 | **4** |
| Policy / documentation consistency | 2 | **4** |
| Workflow data integrity | 0 | **5** |
| Dependency supply chain | 3 | **4** |
| CI hygiene | 2 | **4** |
| Vulnerability disclosure | 0 | **4** |
| Test and coverage discipline | 4 | **4** |
| Workflow gate enforcement (CI parity) | 2 | 2 |
| Static analysis | 1 | 1 |

**Harness fitness: 74 / 100** -- Healthy.

**Verdict**: **fit for purpose as a local coding harness.** The control that actually mattered -- not executing destructive commands a model proposed -- was missing and is now enforced. The data-loss defect in the product's own core workflow is fixed. Remaining items are maintainability and process-hardening work, not blockers.

**Recommended next**: add CodeQL + PSScriptAnalyzer as a separate change with its own triage pass; port the four local-only workflow gates into CI.

---

## 8. Notes on the Review Process

Two things are worth recording, because they are more useful than the score.

**The first pass measured the wrong thing.** It was internally rigorous -- every citation verified, arithmetic checked, an adversarial pass confirming twelve claims against source -- and still reached a misleading conclusion, because it never questioned whether the instrument fit the subject. The Standards and Benchmark catalogues are built for deployed enterprise systems. Applied unchanged to a developer tool they generate real-looking findings (no SBOM, no SLSA, no GenAI red-team) that carry genuine severity labels and no actual risk. Verification confirms a claim is *true*; it does not confirm it is *relevant*. Scope has to be argued before scoring, not inherited from the catalogue.

**The first round of fixes was weak, and only an adversarial reviewer caught it.** The initial regexes were written against the example strings in the policy file rather than against an attacker, and a reviewer sub-agent broke seven of eight in minutes -- flag reordering, long-form flags, quoting, and a complete blind spot for PowerShell's own deletion cmdlet despite pwsh being the default shell. It also found the `-NoProfile` asymmetry, which made the entire guard bypassable, and it correctly refused to confirm a defect I had asserted in its prompt (the hash-ordering question) after checking the code. Writing a security control and reviewing a security control are genuinely different tasks; the second one needs someone trying to break it.

A related process note: a `pwsh`-not-on-PATH failure in the terminal initially masked a PowerShell **syntax error** I had introduced, because the harness reported `exit=0` from the failed lookup rather than from the tests. Parse-checking the file directly is what surfaced it. Green output is not the same as green tests.
