# Execution Plan: Remediate MEDIUM findings from the coding-harness review

**Author**: AgentX Auto
**Date**: 2026-07-27
**Status**: Complete
**Related**: [SOLUTION-REVIEW-agentx-20260727.md](../../artifacts/reviews/SOLUTION-REVIEW-agentx-20260727.md)

---

## Purpose / Big Picture

The re-scoped coding-harness review left seven findings unfixed, three of them MEDIUM. This change closes the MEDIUM set plus the two LOW items that were cheap and adjacent.

Success is observable: static analysis now runs in CI and fails on regression; the workflow gates that previously existed only in a local git hook are re-checked server-side; and the loop evidence gate detects stale artifacts by age as well as by content hash.

One MEDIUM is explicitly **not** fixed -- the PowerShell monolith decomposition -- with rationale recorded in the Decision Log.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: ESLint reports **363 errors** today, 328 of them `@typescript-eslint/no-explicit-any`.
  Evidence: `node scripts/lint-ratchet.js` -> `[INFO] ESLint: 363 error(s), 2 warning(s)`
  Consequence: the SAST job could not simply be made blocking; a ratchet was required.

- Observation: PSScriptAnalyzer reports 869 warnings, but 652 are `PSAvoidUsingWriteHost` -- a style rule that is wrong for a CLI whose console output is the product.
  Evidence: rule histogram captured during baseline measurement.
  Consequence: a curated rule set was needed before any gate could be meaningful.

- Observation: the security-critical PSScriptAnalyzer rules are already at **zero** in production paths (`.agentx/`, `scripts/`); the single `PSAvoidUsingInvokeExpression` hit is in `tests/test-install.ps1`.
  Evidence: `[PASS] No security-rule findings in production paths.`
  Consequence: those rules could be gated at zero tolerance immediately rather than ratcheted.

- Observation: `ConvertFrom-Json` returns `lastIterationAt` as a `DateTime` whose Kind is not `Utc`, even though `Get-Timestamp` writes a trailing `Z`.
  Evidence: freshness guard initially printed `Last iteration: ...+05:30` against `Written: ...+00:00`.
  Consequence: a naive `[datetimeoffset]::Parse` skewed the comparison by the local offset (5.5h here), making the guard too lenient. Fixed by re-labelling with `SpecifyKind(Utc)` rather than converting.

- Observation: `.agentx/state/` held 11 ad-hoc directories dating back to May, several completely empty.
  Evidence: directory listing with file counts and last-write dates.
  Consequence: retention was added to `loop start`.

## Decision Log

- Decision: Introduce SAST as a **ratchet** rather than a blocking gate.
  Options Considered: (a) block on all findings, (b) leave advisory, (c) baseline and fail on increase.
  Chosen: (c).
  Rationale: (a) fails every build on day one against 363 + 80 pre-existing findings; (b) is what `quality-gates.yml` already did with `npm run lint || echo`, which is why lint errors never failed anything. (c) prevents new debt while keeping existing debt visible and payable.
  Date/Author: 2026-07-27 / AgentX Auto

- Decision: Gate PSScriptAnalyzer security rules at zero tolerance, scoped to production paths only.
  Rationale: production is already clean, so the gate is enforceable today. Test fixtures deliberately exercise unusual constructs and are held to the ratchet instead.
  Date/Author: 2026-07-27 / AgentX Auto

- Decision: Do **not** enforce the quality-loop iteration gate in CI.
  Rationale: `.agentx/state/loop-state.json` is untracked by design -- it is per-developer working state. CI has nothing to inspect. Documented in the script rather than faked.
  Date/Author: 2026-07-27 / AgentX Auto

- Decision: Defer decomposition of `agentx-cli.ps1` (6,708 lines) and `agentic-runner.ps1` (3,921 lines).
  Options Considered: (a) decompose now alongside the security fixes, (b) partial extraction, (c) defer to a dedicated change.
  Chosen: (c).
  Rationale: this is a pure-refactor with real regression risk and no behavioural benefit. Bundling it with security fixes would make both harder to review and would obscure which change caused any regression. The behavioural test coverage that makes such a refactor safe (185 runner assertions, 60 loop assertions) is in place, so it can be done confidently as its own unit of work.
  Date/Author: 2026-07-27 / AgentX Auto

- Decision: Remove `.agentx/memory/` rather than migrate it.
  Rationale: referenced by no code, contained no files, and `memories/` is the wired path (`agentic-runner.ps1:3887`, `agentx-cli.ps1:5743`). The `.gitignore` and installer-preserve entries stay, so any user with legacy data there is unaffected.
  Date/Author: 2026-07-27 / AgentX Auto

## Context and Orientation

| Area | Files |
|---|---|
| SAST config and gates | `PSScriptAnalyzerSettings.psd1`, `scripts/run-psscriptanalyzer.ps1`, `vscode-extension/scripts/lint-ratchet.js`, `.github/workflows/sast.yml` |
| CI gate parity | `scripts/check-harness-compliance.ps1` (invoked from `quality-gates.yml`) |
| Evidence gate | `.agentx/agentx-cli.ps1` -- `Invoke-LoopIterate`, `Invoke-LoopComplete` |
| State retention | `.agentx/agentx-cli.ps1` -- `Remove-StaleStateDirectories`, called from `Invoke-LoopStart` |
| Exec sink | `vscode-extension/src/utils/dependencyCheckerInternals.ts` |

Constraint: the local pre-commit hook remains the only enforcement point for the quality-loop iteration gate. That is a documented limitation, not an oversight.

## Plan of Work

1. Measure the real SAST baseline before designing the gate, so the gate matches reality rather than aspiration.
2. Add a curated PSScriptAnalyzer rule set splitting security rules (zero tolerance) from defect rules (ratchet).
3. Add an ESLint ratchet using the ESLint Node API.
4. Wire CodeQL, PSScriptAnalyzer and the ESLint ratchet into a new `sast.yml`.
5. Extend `check-harness-compliance.ps1` with Model Council, Compound Capture and scrub gates.
6. Add an age-based freshness check to the loop evidence gate, alongside the existing hash check.
7. Route `tryExec` through the command policy; drop the dead `programName` helper.
8. Add conservative retention for `.agentx/state/`.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Measure SAST baseline | AgentX Auto | Complete | 869 raw -> 80 curated defect findings; 0 production security findings |
| 2 | PSScriptAnalyzer gate + baseline | AgentX Auto | Complete | Regression test: injected empty catch -> `[FAIL] ... 16 -> 17 (+1)` |
| 3 | ESLint ratchet + baseline | AgentX Auto | Complete | Regression test: injected `any` -> `[FAIL] ... 328 -> 330 (+2)` |
| 4 | `sast.yml` | AgentX Auto | Complete | 3 jobs, all actions SHA-pinned, YAML validated |
| 5 | CI gate parity | AgentX Auto | Complete | Scrub gate live: `[PASS] ... no HIGH findings across 33 changed file(s)` |
| 6 | Evidence freshness | AgentX Auto | Complete | UTC skew found and fixed during verification |
| 7 | `tryExec` guard + dead code | AgentX Auto | Complete | `tsc --noEmit` exit 0 |
| 8 | State retention | AgentX Auto | Complete | Conservative: empty or >30 days, protected allowlist |

## Concrete Steps

```powershell
# SAST
pwsh scripts/run-psscriptanalyzer.ps1                 # enforce
pwsh scripts/run-psscriptanalyzer.ps1 -UpdateBaseline # after genuinely fixing findings
node vscode-extension/scripts/lint-ratchet.js
node vscode-extension/scripts/lint-ratchet.js --update

# Gates
pwsh scripts/check-harness-compliance.ps1 -ReportOnly

# Full verification
cd vscode-extension; npm run test:coverage
pwsh tests/loop-parity-behavior.ps1
pwsh tests/agentic-runner-behavior.ps1
```

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| ESLint 363 pre-existing errors | Cannot make lint blocking | Ratchet against committed baseline | Resolved |
| `npx.cmd` EINVAL on Windows / ESLint 8 does not export `./bin/eslint.js` | Ratchet script could not spawn ESLint | Switched to the ESLint Node API | Resolved |
| `ConvertFrom-Json` DateTime Kind skew | Freshness guard too lenient by local offset | `SpecifyKind(Utc)` re-labelling | Resolved |

## Validation and Acceptance

- [x] Extension suite green: **1000 passing, 0 failing, exit 0**, coverage 82.16% lines / 75.26% branches against gates 80/73
- [x] `tsc -p ./ --noEmit` exit 0
- [x] PowerShell suites: loop-parity 28/28, loop-rollback 32/32, harness-audit 10/10, scrub 20/20, agentic-runner 185/185 -- all exit 0
- [x] `agentx-cli.ps1` and `check-harness-compliance.ps1` both parse cleanly
- [x] All workflow/dependabot YAML files parse
- [x] PSScriptAnalyzer gate exit 0; **fails** on missing baseline, missing path, and a planted production security finding
- [x] ESLint ratchet exit 0; **fails** on missing baseline and on an injected `any`
- [x] Both baselines confirmed NOT gitignored (`git check-ignore` -> no match)
- [x] Freshness guard proven on **both** `loop iterate` and `loop complete`; timestamps compared in true UTC
- [x] `APPROVED` regex verified against the real 9-review corpus and 7 adversarial strings
- [x] Harness compliance gate exit 0

## Idempotence and Recovery

Every gate is re-runnable and side-effect free except the two baseline files, which are only written with an explicit `--update` / `-UpdateBaseline` flag.

Recovery: delete `.agentx/state/psscriptanalyzer-baseline.json` or `vscode-extension/.eslint-baseline.json` and regenerate. Retention only removes directories that are empty or older than 30 days, and never touches `loop-evidence` or `loop-history`.

## Artifacts and Notes

Evidence: `.agentx/state/review-evidence/medium/` (test output, gate runs, regression proofs)
Evidence: `.agentx/state/loop-evidence/` (per-iteration archives)
Evidence: `.agentx/state/psscriptanalyzer-baseline.json` (80 defect findings)
Evidence: `vscode-extension/.eslint-baseline.json` (365 findings)

## Outcomes & Retrospective

Three MEDIUM findings closed (SAST, CI gate parity, evidence freshness-vs-identity), plus two LOW items (unguarded `tryExec` sink, state retention) and the vestigial memory directory. One MEDIUM deferred with recorded rationale.

### The first implementation was decorative

An adversarial review returned **CHANGES REQUESTED** with 4 HIGH and 9 MEDIUM findings, and its headline conclusion was blunt: *"the entire `sast.yml` workflow is decorative"*. It was right, for three compounding reasons:

1. **Both ratchet baselines were invisible to CI.** The PSScriptAnalyzer baseline was written to `.agentx/state/`, which `.gitignore` excludes, so it could never be committed. The ESLint baseline was simply untracked. On a fresh `actions/checkout` both were absent -- and both scripts treated a missing baseline as warn-and-exit-0.
2. **The zero-tolerance security gate never fired.** `Test-IsProductionPath` was fed `DiagnosticRecord.ScriptName`, which is the *leaf filename*; the full path is `ScriptPath`. Every finding was therefore classified non-production. Proven by planting `Invoke-Expression` in `scripts/` and watching the gate report `[PASS]`.
3. **21 tracked `.ps1` files were outside the analysed set**, including `install.ps1` -- the file the docs tell users to run as `irm ... | iex`, and so the highest blast-radius script in the repository.

All fixed and re-proven. The gates now fail closed on a missing baseline or a missing analysis path, security rules count toward the ratchet as well as the zero-tolerance bar, and the analysed set covers `.github`, `packs` and `install.ps1`.

### Other findings worth recording

| Finding | Fix |
|---|---|
| Freshness guard was absent from `loop complete` -- the command the pre-commit hook keys on. A final gate log generated at session start could be held back and submitted at the end. | Extracted `Test-LoopEvidenceFreshness`, applied to both commands |
| `SpecifyKind(Utc)` was applied unconditionally. My justifying premise was empirically **false**: `ConvertFrom-Json` returns `Kind=Utc` for `Z` values. For offset-bearing values it returns `Kind=Local`, where blanket `SpecifyKind` skews +5.5h and rejects fresh artifacts. | `ConvertTo-LoopUtcOffset` handles each Kind correctly |
| The `APPROVED` regex matched `NOT APPROVED`, `APPROVED: false`, and the rubric line every review inherits from the template -- 8 of 9 real reviews. | Anchored verdict-line match; now 6 of 9, all legitimate |
| Council and Capture gates keyed on *changed* files, so 5 grandfathered ADRs and 4 reviews were CI landmines with no escape (the Council gate has no skip token). | Added-only semantics via `--diff-filter=A` |
| Scrub gate ignored the exit code, so a crash was indistinguishable from a clean scan. | Fails closed on non-zero exit with no findings |
| `[skip-capture]` was dead on push builds: `$BaseRef` is empty there, and `git log ..HEAD` returns nothing. | Falls back to `git log -1` |
| `Test-Path` without `-LiteralPath` silently dropped bracketed and quoted filenames from all three gates. | `-LiteralPath` throughout |
| Retention deleted empty directories with **no time component**, destroying a directory created moments earlier for a pending operation. Protected 2 of 12 live directories. | Age required in every case, using the directory's own timestamp; protected list covers all evidence directories |

The reviewer also verified several claims as **correct** and declined to manufacture findings against them: the `tryExec` guard (all 11 call sites re-run through the real compiled validator, zero blocked), the Council slug derivation, `-ReportOnly` suppression, cross-platform path handling, and scrub argument passing.

### Lesson

Measuring before designing changed the design twice, and reviewing before believing changed it a third time. The gates looked correct in isolation and passed their own local runs -- the failure mode was entirely about the environment CI would actually see: a fresh checkout with no baseline, and a `DiagnosticRecord` property whose name reads like a path but is not one. A gate that cannot fail is worse than no gate, because it advertises coverage that does not exist.
