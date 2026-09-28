---
description: 'Execution plan for harness optimization: defects, always-on context diet, stage-gate evaluation, and tokenomics.'
---

# Execution Plan: Harness Optimization for Advanced Models

**Author**: Frontier Engineering FDE
**Date**: 2026-09-22
**Status**: Complete

---

## Purpose / Big Picture

Frontier ships an agent harness whose always-on instructions, stage gates, and
cost accounting should help capable models do verified work without paying for
context they do not need. After this work:

- Every chat request carries a small always-on router instead of ~75K-98K tokens
  of auto-attached reference docs. Detailed docs stay available on demand.
- Stage deliverables (PRD, ADR, Spec, UX, plan, review) have a rubric-based,
  hash-bound stage gate at handoff, not only an existence check.
- Runner model calls produce an actual usage ledger, and always-on context has a
  budget that CI and `tokens context` can enforce.
- Known defects found during review are fixed with regression tests.

Success is observable: `tokens context` reports the always-on closure within
budget, `stage-gate` validates or blocks reports deterministically, handoff
validation runs the stage gate, and the targeted test suites pass.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Steps 1-6 implemented with regression tests
- [ ] Acceptance evidence recorded (final review and loop completion)

## Surprises & Discoveries

- Observation: VS Code attaches files linked from instruction-type files.
  Evidence: this session's attachments equal the link targets of the bundled
  `copilot-instructions.md` and `AGENTS.md`; VS Code documents
  `chat.includeReferencedInstructions` for "instructions referenced via Markdown links".
- Observation: The modeled consumer closure is 21 files / ~98K tokens; the
  attachments observed in this session sum to ~75K. GUIDE, WORKFLOW (two
  copies), Skills (two copies), QUALITY_SCORE and tech-debt load on every request.
  Evidence: `build/measure-always-on.js` output in `build/closure-full.txt`.
- Observation: Docs-only loops skip the code-quality gate; PRD/ADR/Spec/UX reach
  handoff with only a reviewer verdict. `agentx validate <n> pm|architect|ux|reviewer`
  checks file existence only; `score-output.ps1` uses proxies (file-count ratio,
  URL count).
- Observation: The runner normalizes provider `usage` but never accumulates it.
- Observation: Rebrand commit f17c505d corrupted `docs/WORKFLOW.md`
  ("Agent X Autonomous" -> "Frontier Orchestration FDEnomous"; steps 1-3 of the
  orchestration clarification protocol deleted) and a test banner.
- Observation: Clone instructions point at nonexistent `jnpiyush/Frontier.git`
  and `cd Frontier` after cloning `AgentX.git`.
- Observation: `diagnose` bundle-sync probes pre-rebrand `vscode-extension/.github/agentx`,
  so it never runs; `score` resolves `score-output.ps1` from the workspace only.
- Observation: Bundled `score-output.ps1`, `stocktake.ps1`, `validate-handoff.ps1`
  derive the workspace root from `$PSScriptRoot/..`; from the extension bundle
  that is the extension folder, not the user's repository.
- Observation: `COUNCIL-428` has two links with one `../` too many.
- Observation: `validate <n> tester` required `docs/testing/TEST-<n>.md`, but the
  Tester agent writes `CERT-<n>.md`, so `ship` failed its test stage for every
  certified issue. Evidence: tester.agent.md "Create docs/testing/CERT-{issue}.md".
- Observation: The tracked `.agentx/install-manifest.json` is stamped 9.3.1 and
  294 of its 600 entries are gitignored `build/` scratch copies, because the
  generator's suffix globs match any nested `scripts/*.ps1`.
- Observation: Root installers ship `scripts/` but neither `docs/guides/`
  (referenced by AGENTS.md and WORKFLOW.md) nor `evaluation/rubrics/`.
- Observation: Returning a JSON array from a PowerShell helper unrolls it (empty
  arrays vanish, single elements become scalars); report validation must read
  arrays through a wrapper. Caught by the stage-gate tests.
- Observation: The engineer agent exceeded its 7,000-token budget, and every
  role agent opened with an all-caps banner. The skill-creator frontmatter
  template embedded skill-creator's own description.
- Observation: `scripts/research.ps1` still wrote `.agentx/state/research`, so
  experiment state split from the migrated `.frontier/` tree, and scrub skipped
  only the legacy `.agentx/` runtime folders.
- Observation: Four Bash-suite agent assertions (`validatePRDIntent`,
  `Domain Classification`, `AI-Aware Research`, `AI Implementation Setup`) had
  no case-sensitive match at HEAD; the PowerShell suite already used the current
  headings. The new stage-gate suite was not in CI.
- Observation: The first independent review (changes requested, 3 MEDIUM, 9 LOW)
  found the token budget checked only per iteration and per run, OpenAI-shaped
  usage exports that `budget.ps1` could not price (no cache-write field), and
  raw-byte gate hashes that differ between CRLF and LF checkouts. It also found
  permissive verdict parsing, templates that violate the zero-code fence rule,
  legacy `.agentx` handoff/signal paths (the signal hook wrote where `discover`
  never reads), a diagnose PASS for an unconfigured budget, uneven workspace-root
  variables, a fail-open `stageGates` typo path and missed link forms.
  Evidence: `build/review/cq-review.json` (score 65).
- Observation: The second independent review (score 79, 0 HIGH/MEDIUM, 7 LOW)
  found budget stops reported as `human_required` or `max_iterations`, verdict
  forms that still passed (`[TODO] APPROVED`, two checked boxes, `approved?`,
  `pending`, `## Decision Log`), and that delegated clarification had never run
  end to end. Evidence: `build/review/cq-review-2.json`.
- Observation: Clarification crashed on its first exchange for three separate
  reasons: a Mandatory parameter rejected the empty history, the ledger record
  ID leaked into the loop result, and strict mode rejected dot access to the
  missing `awaitingHuman` key. Under `Set-StrictMode -Version Latest`, `$null.id`
  and missing hashtable keys throw.
- Observation: `ConvertTo-AnthropicMessage` iterated `@($null)` for a text-only
  assistant turn, so every direct Anthropic run failed on the call after a text
  answer (self-review feedback, clarification, resume).
  Evidence: `build/anthropic-diag.ps1` reproduction and a new regression test.
- Observation: The umbrella suite failed once (249/250) because the Bash pack
  install in `installer-license-behavior.ps1` exceeded its 600 s limit. A direct
  run finished in 609 s: `copy_tree` and `copy_file` started `dirname` and
  `mkdir` for every file, and Git Bash process creation costs about 1 s per file
  here. Evidence: `build/pack-timing.log` (609 s), `build/pack-timing-2.log`
  (199 s after the fix, same 567 files).
- Observation: `tests/test-framework.sh` had eight stale assertions at HEAD
  (`agent-x.agent.md`, the removed `clarify` command, three chat modules deleted
  in v8.0.0, `agentxContext.ts`), and its six "exits cleanly" checks were
  vacuous: `\$?` was evaluated inside `assert_true` after `local` reset it.
  The help check broke eval quoting because the help text contains quotes.
- Observation: The third independent review approved (score 88, 0 HIGH/MEDIUM,
  4 LOW): conditional approvals and contradictory verdict lines still passed,
  `ConvertTo-ClaudeCodePrompt` had the same `@($null)` defect as the Anthropic
  converter, the Bash content checks matched bare words through `eval`, and
  delegated clarification runs wrote their own usage file on top of the merged
  parent export. Evidence: `build/review/cq-review-3.json`.
- Observation: The fourth review approved (score 85, 0 HIGH/MEDIUM, 3 LOW, all
  in verdict parsing): a voided, negated or doubly checked verdict line was
  ignored whenever another line held a clean verdict, the condition list missed
  common wording (`when`, `with conditions`, `(conditional)`), a decimal point
  ended the verdict clause, and rejected lines got the generic message.
  Evidence: `build/review/cq-review-4.json`.
- Observation: The fifth review approved (score 85, 0 HIGH/MEDIUM, 5 LOW, all
  in verdict parsing): bare `provided` and abbreviations such as `sec.` let
  conditional approvals pass, rationale naming two verdict values voided a
  clean verdict, `_underscore_` verdicts and emphasized or `NOT YET` negations
  went unread, prose such as `Pass rate: 91%` under a decision heading counted
  as a verdict, and 16,000 `*` characters took 66 s (quadratic backtracking).
  A first fix treated any verdict not followed by punctuation as prose. It
  passed the suite but would have ignored `NOT APPROVED until F1 is fixed`
  beside a clean verdict, so it was replaced before review and that case is now
  a fixture. Evidence: `build/review/cq-review-5.json`.
- Observation: The final (sixth) review approved (score 85, 0 HIGH/MEDIUM,
  4 LOW). Open gaps: the prose shapes under a heading are checked before the
  void reasons, so `Approved conditionally: F1 must be fixed.` beside a clean
  verdict passes; `on the condition that`, `with the following conditions` and
  `APPROVED, but ...` are not conditions; `APPROVED_WITH_CONDITIONS` and
  `**NOT YET** APPROVED` read as clean; and a marker followed by very long
  whitespace, or a very long heading line, backtracks. They are tracked as
  follow-ups rather than a seventh round; the judged decision-consistency
  dimension still needs an independent reviewer. Evidence:
  `build/review/cq-review-6.json`.

## Decision Log

- Decision: Remove auto-attachment rather than deleting guidance.
  Options Considered: (A) shrink WORKFLOW/GUIDE/Skills; (B) replace links in
  always-on routers with plain code paths and keep the docs; (C) disable
  `chat.includeReferencedInstructions` via settings.
  Chosen: B.
  Rationale: The docs are correct on-demand references; the defect is that they
  load every turn. C is a user setting the extension cannot rely on and would
  also disable legitimate references. A loses content without fixing the cause.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: Stage gates at handoff, reusing the code-quality report pattern.
  Options Considered: (A) extend `score-output.ps1` heuristics; (B) new
  hash-bound stage rubric evaluator with deterministic checks plus independent
  reviewer scores, invoked by `validate` and a `stage-gate` command; (C) add a
  second report requirement to `loop complete`.
  Chosen: B.
  Rationale: A measures form, not fitness. C changes the iterate/complete
  interface across CLI and extension and conflates code and document gates.
  B keeps one report per stage, mirrors the proven code-quality contract, and
  sits at the stage boundary where the gate belongs. Implementation keeps using
  the existing code-quality rubric rather than a competing score.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: Tokenomics = measured ledger plus context budget, not price tables.
  Options Considered: (A) hardcode model prices; (B) record provider-reported
  usage per call and report totals, optionally capped; (C) estimate only.
  Chosen: B plus an always-on context budget.
  Rationale: Prices change and unknown must stay unknown (existing budget.ps1
  contract). Measured usage feeds budget.ps1 for costing.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: Agent trims target duplicated and generic text only.
  Options Considered: rewrite all 26 agents and 134 skills now; trim the largest
  agent bodies and add authoring guidance plus budgets for the rest.
  Chosen: the latter, preserving validator-pinned stubs and role gates.
  Rationale: No live model eval is available in this session; broad rewrites
  without baselines risk behavior regressions. Budgets and guidance make the
  remaining trims incremental and reviewable.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: Stage gates default to advisory in `validate`.
  Options Considered: (A) block handoffs on deterministic checks immediately;
  (B) advisory by default, `stageGates: required` to block, `off` to skip, with
  any existing report always validated; (C) opt-in only.
  Chosen: B.
  Rationale: Some shipped artifacts (for example SPEC-341 with JSON fences) would
  fail at once under A, breaking `ship`. C hides the checks. B surfaces every
  failure, never accepts a stale or failing report, and lets teams opt into
  blocking. Handoff validation uses the installed evaluator and catalog, like
  the code-quality gate, so a workspace copy cannot shadow them.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: The runner ledger exports the `budget.ps1` call shape.
  Options Considered: a new cost format; the existing strict budget contract.
  Chosen: existing contract, so `frontier budget -File` prices a run once rates
  are added. Cache fields are exported only when consistent with input totals.
  Date/Author: 2026-09-22 / Engineering FDE
- Decision: Token budget covers the whole run and is checked before every model call.
  Options Considered: (A) document per-iteration, per-run semantics; (B) store the
  budget on the outermost ledger, sum spend across the active ledger chain, and
  check before agent, compaction, self-review and delegated calls.
  Chosen: B. A spent budget returns the unreviewed response (exitReason
  `token_budget`) instead of calling self-review; compaction falls back to its
  deterministic summary. The call that crosses the budget still completes.
  Rationale: A per-run budget lets each delegated run spend a full budget again,
  which defeats cost control.
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: Gate hashes use UTF-8 text with LF endings; diagnose passes an
  unconfigured context budget only when the workspace has no token policy.
  Options Considered: raw bytes plus `.gitattributes`; normalized hashing. For
  diagnose: fail every unconfigured budget; pass it silently; pass with an
  explicit note only when no policy exists.
  Chosen: normalized hashing (works without repository attributes and for
  consumer repositories), and the explicit-note rule, which keeps zero-copy user
  workspaces healthy while failing a policy that omits `alwaysOn`.
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: Delegation is an explicit runner switch; one distinct verdict per decision.
  Options Considered: infer nesting from an open ledger or pass `-DelegatedRun`;
  wrap the main loop in try/finally or reset the ledger when a top-level run
  starts. For verdicts: any bracket marker or an allowlist; first verdict wins or
  one distinct verdict per decision heading.
  Chosen: `-DelegatedRun` with a reset at top-level start, an `[x]`, `[PASS]`,
  `[FAIL]`, `[WARN]` marker allowlist in which `[PASS]` and `[FAIL]` must agree
  with the verdict, hedges rejected only on the verdict clause, headings that are
  exactly a label, and one distinct verdict per heading block.
  Rationale: an inferred nesting check turns a ledger left open by an exception
  into a false parent; the reset avoids restructuring a long loop. Scoping hedges
  to the verdict clause keeps rationale such as "two LOW items pending" valid.
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: Fix the installer's per-file process launches instead of raising the
  test timeout.
  Options Considered: raise the 600 s limit; rerun until it passes; replace the
  per-file `dirname` and `mkdir` with parameter expansion and an existence check.
  Chosen: the last. `cp --parents` and `install -D` are not portable to macOS.
  Rationale: a ten-minute install is a real defect for Windows users; a larger
  limit or a rerun would hide it.
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: Verdict lines agree on approval; conditions void only unconditional approvals.
  Options Considered: one distinct verdict string per artifact; agreement on the
  catalog's approving/non-approving split. Conditions voiding every verdict, or
  only approvals other than `CONDITIONAL ...`.
  Chosen: approval agreement, and conditions voiding only unconditional approvals.
  Rationale: a certification may state both `PASS` and `GO`, and a definite
  `BLOCKED awaiting security review` is still a decision. None of the 16 review
  and certification artifacts in the repository changed result
  (`build/verdict-survey-before.json`, `build/verdict-survey-after.json`).
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: A void verdict line fails the decision check even beside a clean one.
  Options Considered: ignore void lines when a clean verdict exists; fail on
  any void label line or heading-block line; fail only on label lines.
  Chosen: fail on any void line, reporting its line and reason; conditional
  verdicts come from a catalog `conditional` list instead of a hard-coded prefix.
  Rationale: ignoring void lines let a clean summary hide a conditional formal
  decision. The 16 repository artifacts still keep their results
  (`build/verdict-survey-iter6.json`).
  Date/Author: 2026-09-23 / Engineering FDE
- Decision: Under a decision heading only three narrow shapes are prose, and the
  leading pattern uses atomic groups.
  Options Considered: (A) count a verdict only when punctuation or a spaced dash
  follows it; (B) treat three shapes as prose: a sentence-case compound
  (`Go-live`), a sentence-case two-word label (`Pass rate:`) and a list or table
  tally (`- PASS: 120 tests`, not a date); (C) read only labeled lines under a
  heading.
  Chosen: B. Label lines under a heading are read once, by the label pass.
  Rationale: A ignores negated, hedged and differing verdicts that carry
  rationale, a false pass. C stops reading a bare `**APPROVED**` under
  `## Decision`, which the templates and repository reviews use. Under B a
  verdict in capitals stays a decision, so an unexpected line fails closed.
  Atomic groups make a long emphasis run linear (20,000 characters in about
  1 s including process start). The 16 repository artifacts keep their results
  (`build/verdict-survey-iter7.json`).
  Date/Author: 2026-09-23 / Engineering FDE

## Alternatives Considered

See the Decision Log; each decision lists the rejected options and why.

## Context and Orientation

- Always-on routers: `.github/copilot-instructions.md`, `AGENTS.md`,
  `.github/instructions/{memory,project-conventions}.instructions.md`. The
  extension bundles them under `vscode-extension/.github/frontier/` via
  `vscode-extension/scripts/copy-assets.js` (rewrites are no-ops when absent).
- Validators pin: agent stubs (`validate-frontmatter.ps1`), "Single source of
  truth" and "GUIDE" in AGENTS.md and "RFC 2119" in the router (`tests/test-framework.*`).
- Code-quality gate: `scripts/score-code-quality.ps1`, `evaluation/rubrics/code-quality.md`.
- Handoff validation: `Invoke-ValidateCmd` in `.agentx/agentx-cli.ps1`.
- Runner model funnel: `Invoke-LlmChat` in `.agentx/agentic-runner.ps1`.
- Token budgets: `scripts/token-counter.ps1`, `.token-limits.json`.

## Pre-Conditions

- [x] Issue exists and is classified (work continues under the harness program; no new public issue created without user approval)
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified (token-optimizer, code-review, testing, karpathy-guidelines)
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

1. Defect fixes with regression coverage: WORKFLOW corruption, clone URLs,
   COUNCIL links, diagnose bundle path, `score` resolution, bundled-script
   workspace roots.
2. Always-on diet: replace links in the always-on routers with code paths,
   remove duplicated gate prose between router files, keep pinned phrases.
3. `tokens context`: closure analyzer with a configurable always-on budget in
   `.token-limits.json`; add to diagnose and CI summary.
4. Stage gates: `evaluation/rubrics/stage-gates.json` + `.md`,
   `scripts/score-stage-gate.ps1` (Plan/Validate), `stage-gate` CLI command,
   and `validate` integration for pm/ux/architect/reviewer.
5. Runner usage ledger and optional token cap.
6. Agent/skill authoring guidance for advanced models; trim the heaviest agent
   bodies of duplicated or generic text.
7. Docs, bundle regeneration, scrub, targeted tests, independent review.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Defect fixes + tests | Engineer | Complete | diagnose 78/78; tester CERT, manifest, installers, research state, Bash suite 121/121 |
| 2 | Always-on router diet | Engineer | Complete | ~75K -> ~2.3K tokens per request |
| 3 | tokens context analyzer + budget | Engineer | Complete | token-budget 40/40; CI step; diagnose check |
| 4 | Stage-gate rubric + evaluator + validate wiring | Engineer | Complete | stage-gate 111/111; added to CI regression suite |
| 5 | Runner usage ledger | Engineer | Complete | runner suite 460/460 |
| 6 | Advanced-model authoring guidance + agent trims | Engineer | Complete | engineer 7140 -> ~6260 tokens |
| 7 | Bundle, scrub, tests, independent review | Engineer | Complete | Final review approved at 85 (round 6); 4 LOW follow-ups |

## Concrete Steps

Commands (repo root, PowerShell 7 absolute path `C:\Program Files\PowerShell\7\pwsh.exe`):

- `pwsh -File scripts/token-counter.ps1 -Action context -Json`
- `pwsh -File scripts/score-stage-gate.ps1 Plan -Stage requirements -Path <prd> -Json`
- `pwsh -File tests/token-budget-behavior.ps1`, `tests/stage-gate-behavior.ps1`,
  `tests/diagnose-behavior.ps1`, `tests/agentic-runner-behavior.ps1`,
  `tests/test-framework.ps1`, `scripts/validate-frontmatter.ps1`,
  `scripts/validate-references.ps1`
- `node vscode-extension/scripts/copy-assets.js` then extension unit tests

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No live model eval for instruction changes | Cannot prove behavior improvement | Preserve gates; report as limitation | Open |

## Validation and Acceptance

- [x] `tokens context` reports the consumer always-on closure below its budget and fails when a router links a large doc
- [x] `stage-gate` blocks missing sections, stale hashes, placeholder evidence, sub-floor scores and HIGH/MEDIUM findings; passes a valid report
- [x] `validate <n> pm|ux|architect|reviewer|tester` runs the stage gate, warns (advisory) or blocks (required), and fails on a failing report
- [x] Runner ledger records provider-reported usage per call and totals; unknown usage stays unknown
- [x] Defect regressions covered; frontmatter and reference validators pass
- [x] Independent review approves with zero HIGH/MEDIUM

## Idempotence and Recovery

All edits are local and reversible with git. Generated bundle output is
gitignored and regenerated by `copy-assets.js`. New commands are additive. The
stage gate in `validate` is advisory by default (`stageGates` in
`.frontier/config.json`: `advisory`, `required`, `off`), so existing handoffs keep
working until teams adopt reports; an existing report is always validated.

## Rollback Plan

Revert the commit. No data migrations or remote state changes are involved.

## Artifacts and Notes

- Measurement scripts: `build/measure-always-on.js`, `build/measure-agents.js` (gitignored)

## Outcomes & Retrospective

Achieved:

- Always-on context per Copilot request dropped from about 75,000 tokens of
  auto-attached docs to about 2,300 (3,260 with `CLAUDE.md`, budget 4,000),
  enforced by `tokens context` in CI and `diagnose`.
- Stage gates for requirements, UX, architecture, plan, review and certification
  deliverables, bound to LF-normalized hashes and wired into `validate`.
- A runner usage ledger with a `budget`-compatible export and a run-wide
  `harness.tokenBudget` that stops before any further model call.
- The defects listed in `CHANGELOG.md`, including two found only by end-to-end
  runner tests: clarification never completed an exchange, and direct Anthropic
  runs failed on the call after a text answer.
- The Bash pack installer runs about three times faster under Git Bash, and the
  Bash self-test suite checks current files and real exit statuses (121/121).
- Independent reviews: 65 (changes requested), 79, 88, 85, 85 and a final 85,
  the last four approved with zero HIGH/MEDIUM findings.

Remaining: no live model evaluation of the trimmed instructions; the TypeScript
extension loop has no usage ledger; 100 inherited token-budget overages; further
agent and skill trims stay incremental; the four LOW verdict-parser gaps from the
final review.

Lessons: helper-level unit tests missed failures that only appear when the loop
runs end to end under strict mode, so budget and clarification behavior now have
mocked-provider runs. Each review round found another permissive verdict form;
encode every accepted and rejected form as a fixture, and stop at the first
approved final review because returns diminish. Treat a test timeout as a
possible performance defect before raising the limit.
