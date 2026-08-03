# Execution Plan: Raise AgentX Coding Harness Readiness Toward 80

**Author**: AgentX Auto
**Date**: 2026-07-28
**Status**: Local Implementation Complete - Remote Validation Pending
**Issue**: #377
**Baseline evaluation**: [SOLUTION-EVALUATION-agentx-coding-harness-20260728.md](../../artifacts/reviews/SOLUTION-EVALUATION-agentx-coding-harness-20260728.md)

---

## Purpose / Big Picture

Raise the coding-harness-scoped readiness score from 60 toward 80 without adding controls that do not fit a local VS Code/CLI product.

The implementation prioritizes controls that improve real behavior and multiple score dimensions at once:

1. make the existing evaluation contract blocking and representative of live routing;
2. land continuous SAST and quality gates in CI;
3. activate the already-tested network and path guardrails at real boundaries;
4. remove high runtime dependency advisories in enabled core packages;
5. add a real Extension Host smoke test;
6. add SBOM/provenance for public VSIX/MCP release artifacts;
7. reduce instruction/token debt without crossing agent permission boundaries.

A score of 80 is an **outcome**, not an acceptance shortcut. The work is complete only when the fresh ledger-based evaluation recomputes to at least 80 and all applicable release gates are closed or explicitly accepted.

## Success Criteria

- [x] `run-ai-eval-sample.ps1` reads manifest thresholds and exits nonzero below blocking values.
- [x] Representative routing evaluation reaches at least `0.80` and runs in CI.
- [ ] SAST workflow and ratchet baselines are committed, execute remotely, and pass.
- [x] Path and SSRF validators are wired at mutable file/download boundaries with integration tests.
- [x] Enabled core runtime package scopes have zero high/critical advisories.
- [x] At least one real VS Code Extension Host smoke test covers activation, sidebar registration, and a command.
- [x] Public release pipeline is configured to emit SBOM and build provenance/attestation artifacts.
- [ ] Required status checks protect `master` after workflows are green.
- [x] Agent token-budget check exits 0, or remaining exceptions have explicit, narrow overrides and rationale.
- [ ] Fresh integrated evaluation is at least 80 and independently approved.

## Progress

- [x] Evaluation thresholds, negative behavior tests, and blocking CI workflow
- [x] SSRF/redirect and plugin target boundary enforcement
- [x] Core/companion high and critical runtime advisory remediation
- [x] Real VS Code Extension Host smoke with in-host pass marker
- [x] CycloneDX and Sigstore release workflow wiring
- [x] Agent/instruction token-budget remediation
- [ ] Remote workflow runs and required branch checks (requires commit/push authorization)
- [ ] Fresh integrated evaluation and independent approval

## Decision Log

- **2026-07-29 - Scope audits to shipped dependencies.** Dev tooling remains covered
	by clean install, tests, and lint ratchets; release/dependency gates use
	`--omit=dev` and omit unused optional dependencies where the runtime does not load
	them.
- **2026-07-29 - Publish attested bytes.** Marketplace publication downloads and
	verifies the GitHub release VSIX instead of rebuilding an unattested artifact.
- **2026-07-29 - Bind evidence to final artifacts.** Release automation scans the
	unpacked final VSIX and an explicit versioned MCP archive, then generates
	provenance and SBOM attestations for both subjects.
- **2026-07-29 - Preserve agent permission boundaries.** Token reduction moves shared
	mechanics to `AGENT-PROTOCOL.md` and skills; it does not merge roles or alter
	frontmatter tools, write scopes, deliverables, or handoffs.
- **2026-07-29 - Defer remote enforcement.** Required checks are configured only after
	the new workflows run successfully on a pushed commit; no commit/push is performed
	without explicit user authorization.
- **2026-07-29 - Evaluate the production router.** GitHub issue triage and the
	regression evaluator invoke `scripts/classify-issue.js`; the threshold gate no
	longer scores an evaluator-only regex or infers prompt quality from required text.
- **2026-07-29 - Pin outbound DNS.** Download validation resolves every address,
	fails closed on DNS errors, and supplies a validated address to the HTTP(S) lookup
	callback on every redirect hop.

## Scope

### In Scope

- `scripts/run-ai-eval-sample.ps1`, `evaluation/**`, evaluation CI
- `.github/workflows/**`, branch protection
- `vscode-extension/src/commands/initializeInternals.ts`
- plugin install and mutable workspace file boundaries
- `.agentx/mcp-server/**`
- VS Code Extension Host test infrastructure
- SBOM/provenance for VSIX and MCP adapter
- agent instruction/token reduction

### Not In Scope

- Azure workload controls
- hosted-service SLO/DR/autoscale
- RAG/product model safety controls not shipped by AgentX
- merging Reviewer/Auto-Fix or ADO Planner/Ops permission profiles
- rewriting the PowerShell monoliths
- full OpenTelemetry or provider-cost accounting

## Alternatives Considered

### A. Score-only documentation changes

Rejected. Reweighting or marking additional controls N/A would improve the number without improving the harness.

### B. Add all enterprise controls from the standards catalog

Rejected. Azure tenant controls, hosted-service operations, and provider-level model safety are not applicable.

### C. Fix only P0 gates and stop near 70

Useful intermediate state, but does not satisfy the user's requested target.

### D. Implement P0/P1 plus proportionate public-artifact supply-chain controls

**Chosen.** This improves actual behavior, continuous enforcement, and the attached benchmark/standards scores without turning a local tool into a fictitious cloud platform.

## Falsifiable Local Hypotheses

| Hypothesis | Disconfirming check | Planned change |
|---|---|---|
| Evaluation governance is the largest cheap gap because `0.47 < 0.80` still exits 0 | Runner already parses/enforces thresholds or is not used anywhere | Parse manifest thresholds, fail below floor, add CI |
| SSRF/path controls are dormant | Production call site already validates every redirect/path | Wire validators only at uncovered boundaries |
| MCP highs are dependency-version debt, not inherent stdio behavior | Latest compatible SDK still audits high or breaks tests | Update lock/package, audit, smoke MCP tool listing |
| E2E gap is test-infrastructure absence | Existing Extension Host smoke already runs in CI | Reuse existing infrastructure rather than add another framework |
| SBOM/provenance can be added without changing runtime | Packaging tool cannot emit artifact or attestation permissions unavailable | Emit CycloneDX/SPDX and GitHub attestation as release artifacts |

## Plan of Work

### Slice 1 - Evaluation Gate

1. Write tests for threshold parsing and failing exit behavior.
2. Extend the deterministic classifier to all declared routing labels.
3. Connect the eval command to CI.
4. Verify clean pass at `>=0.80` and injected regression failure.

### Slice 2 - Boundary Guardrails

1. Add SSRF validation to initial URL and every redirect in `downloadFile`.
2. Add path containment to plugin/runtime mutable file targets.
3. Add negative integration tests for metadata/private redirect, traversal, and symlink/canonical-path escape.

### Slice 3 - Dependency and Release Evidence

1. Upgrade MCP SDK/dependencies to zero high/critical advisories.
2. Decide/document optional companion release scope; keep core gates scoped to enabled core packages.
3. Generate SBOM for extension and MCP adapter.
4. Add build provenance/attestation in release pipeline.

### Slice 4 - Live Extension and Context

1. Add one Extension Host smoke test using the existing VS Code test tooling where possible.
2. Reduce the highest over-budget agent definitions by moving repeated content to shared protocol/skills.
3. Re-run token budgets and full test suites after each reduction.

### Slice 5 - Remote Enforcement and Re-evaluation

1. Commit/push only after local gates are green.
2. Run SAST, evaluation, quality, dependency, and release checks remotely.
3. Configure required checks and admin enforcement.
4. Re-run the three ledgers and integrated evaluation.
5. Independent reviewer approval required.

## Steps

| # | Step | Owner | Status | Evidence |
|---|---|---|---|---|
| 1 | Baseline scoped evaluation | AgentX Auto | Complete | 60/100 report + three ledgers |
| 2 | Evaluation threshold and routing | AgentX Auto | Complete | 8/8 behavior checks; score 1.00; blocking workflow |
| 3 | Network/path guardrails | AgentX Auto | Complete | downloader SSRF/redirect and plugin target tests |
| 4 | MCP dependency remediation | AgentX Auto | Complete | real stdio smoke; zero high/critical runtime advisories |
| 5 | Extension Host smoke | AgentX Auto | Complete | real host activation/view/command smoke passes |
| 6 | SBOM/provenance | AgentX Auto | Complete locally | SHA-pinned SBOM/attestation workflow and policy validation; remote release pending |
| 7 | Agent token reduction | AgentX Auto | Complete | 68/68 governed files within budget |
| 8 | Remote required gates | AgentX Auto | Blocked | Requires explicit commit/push authorization, green remote runs, then branch protection update |
| 9 | Fresh evaluation and review | AgentX Reviewer | Complete locally | 73.3 local; 82.8 projected after remote enforcement; zero HIGH/MEDIUM implementation findings |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Dirty worktree contains prior/user changes | High | Read diffs before touching shared files; never revert unrelated changes |
| Gate changes fail closed and block current branch | High | Prove clean and injected-failure paths locally before remote enforcement |
| Validator wiring blocks legitimate local/private URLs | Medium | Explicit allowlist only where product requires it; negative and positive tests |
| Dependency update changes MCP APIs | Medium | Compile/smoke tool listing and representative CLI call |
| Agent prompt reduction deletes role-specific constraints | High | Preserve permission boundaries; use token checker + agent self-tests |
| Branch protection configured before workflows stabilize | Medium | Apply only after successful remote runs |

## Validation and Acceptance

Required local checks:

```powershell
cd vscode-extension
npx tsc -p ./
npx mocha "out/test/**/*.js"
node scripts/lint-ratchet.js

cd ..
pwsh scripts/run-psscriptanalyzer.ps1
pwsh scripts/run-ai-eval-sample.ps1
pwsh scripts/check-harness-compliance.ps1
pwsh tests/agentic-runner-behavior.ps1
pwsh tests/loop-parity-behavior.ps1
pwsh scripts/token-counter.ps1 -Action check
```

Required remote evidence:

- successful SAST workflow;
- successful evaluation workflow;
- successful quality and dependency workflows;
- required status checks visible on `master`;
- release artifact includes SBOM/provenance.

## Idempotence and Recovery

- Evaluation and scan commands are read-only except their explicit report artifacts.
- Dependency updates are lockfile-based and reversible by restoring only the touched package files.
- Boundary validation changes are guarded by tests before production code edits.
- Branch protection is the last step and can be reverted through the GitHub API if a required check is misnamed.
- SBOM/provenance additions do not alter the VSIX payload.

## Artifacts and Notes

- Baseline evaluation: `docs/artifacts/reviews/SOLUTION-EVALUATION-agentx-coding-harness-20260728.md`
- Standards ledger: `docs/artifacts/reviews/evidence/agentx-coding-harness-standards-20260728.csv`
- Benchmark ledger: `docs/artifacts/reviews/evidence/agentx-coding-harness-benchmarks-20260728.csv`
- Agent matrix: `docs/artifacts/reviews/evidence/agentx-agent-modernization-matrix-20260728.csv`

## Outcomes & Retrospective

The local implementation and review are complete. Fresh evidence raises the integrated
score from **60.0 to 73.3**. The target is **82.8 projected** only after SAST,
evaluation, quality, dependency, release, and Marketplace workflows run green remotely
and their exact checks are required on `master`.

The implementation work closed the evaluation false green, dormant path/SSRF controls,
MCP/companion high advisories, missing Extension Host coverage, token-budget failures,
and missing final-artifact SBOM/provenance wiring. Independent review found and drove
additional fixes for junction escape, DNS rebinding, dependency-scan fail-open behavior,
MCP clean-checkout behavior, E2E false-green behavior, and SBOM subject mismatch.

See
[SOLUTION-EVALUATION-agentx-coding-harness-20260729.md](../../artifacts/reviews/SOLUTION-EVALUATION-agentx-coding-harness-20260729.md)
for the arithmetic and delta ledgers. Do not report 80+ until the remote evidence exists.
