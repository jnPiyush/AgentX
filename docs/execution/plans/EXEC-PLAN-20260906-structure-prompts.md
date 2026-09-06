# Execution Plan: Structure and Prompt Optimization

**Author**: AgentX
**Date**: 2026-09-06
**Status**: Complete (implementation and validation; CLI closeout tracked separately)

## Purpose / Big Picture

Improve responsibility boundaries and prompt efficiency without changing public
behavior, agent permissions, user-file ownership or quality requirements.
Inventory coverage is repository-wide; semantic inspection and edits concentrate
on evidenced hotspots, not a claim that every source line has been reviewed.

## Alternatives Considered

Recorded before implementation and the plan of work:

- A: Add parity and contract tests only. Lowest risk, but leaves the demonstrated
  registry parsing defect and high-impact duplication.
- B: Extract cohesive initialization concerns, repair registry metadata parsing,
  compact repeated agent guidance and disclose long skill references on demand.
  Selected provisionally; preserves public contracts and makes benefits measurable.
- C: Rewrite the CLI/scorer and all skills. Rejected: large unproven blast radius,
  safety-sensitive churn and no evidence that every file needs rewriting.

Three independent audit models evaluate the same bounded proposal before design
is finalized. Their actual conclusions, disagreements and synthesis will be
recorded here; distinct audit topics alone do not constitute consensus.

## Context and Orientation

- The existing documentation-drift changes are a completed, uncommitted task.
  Preserve them, including the audited deletions and generated mirrors.
- Baseline: 183 prompts (26 agents, 134 skills, 23 reusable prompts), recorded
  before this task's edits in `.agentx/state/structure-prompt-baseline.json`.
- Repository budget report: 576 Markdown files scanned, 450 covered, 101
  inherited violations. Estimated tokens are LF-normalized characters / 4,
  rounded up, not provider tokens or measured billing.
- All 134 skills and 153 references were inventoried; eight high-impact skills
  received deep inspection. Ninety-three skill roots exceed their 1,500 budget.
- Initialization currently mixes workspace selection, seeding/symlinks,
  wrappers, downloads and archive extraction. Registry discovery's simplistic
  YAML reader emits the literal `>-` for the Azure Foundry description.
- Keep the CLI monolith and quality-evaluator path policy out of this refactor.

## Pre-Conditions

- [x] User request classified as bounded structural/prompt optimization.
- [x] Active quality loop and pre-existing dirty work recorded.
- [x] Code-optimization, prompt-engineering and Karpathy guidance loaded.
- [x] Separate code, agent and skill audits completed.
- [x] Common-proposal model council synthesized.

## Plan of Work

Slice 1 covers code and registry behavior; verify it before editing prompts.
Slice 2 covers prompt/skill content, followed by distribution and final review.
Keep the original prompt baseline unchanged and capture a separate structural
slice checkpoint so failures remain attributable.

1. Preserve exports while separating initializer workspace, runtime and download
   responsibilities. Retain error behavior, pinned networking, symlink lifecycle
   and never-overwrite rules. Reuse actual shared discovery where justified;
   do not introduce a speculative cross-language catalog framework.
2. Repair registry frontmatter parsing using the existing supported parser.
   Test real multiline, quoted and empty metadata and source/catalog parity.
3. Compact PM/Consulting council mechanics and Engineer duplicated guidance.
   Preserve all frontmatter and role-specific lenses, output paths, phases and
   escalation rules through canonical references. Surface documentation drift
   in the five other shipping roles.
4. Optimize six skill roots: AI-agent-development, model-drift-management,
   data-drift-strategy, iterative-loop, release-management and production-readiness.
   Keep core rules, decisions, safety, errors and acceptance in the root; retain
   useful long examples/checklists in explicitly routed references. Repair the
   model-change reference without inventing equivalence to unrelated scripts.
5. Align reusable code-review, refactor and bug-triage prompts with evidence,
   risk and task scope rather than arbitrary finding quotas, size thresholds
   or assumed service commitments.
6. Regenerate derived registries/assets only after canonical edits finish.
   Verify parity, budgets, targeted behavior, documentation and final review.

## Steps / Progress

| Step | Owner | Status |
|------|-------|--------|
| Inventory and alternatives | Parent + three read-only auditors | Complete |
| Common design council | Same three audit models | Complete |
| Initialization extraction | Implementation agent | Complete: 39 declarations identical, 56 tests |
| Registry metadata and reusable prompts | Parent | Complete: parser and prompt contracts validated |
| Agent contracts and compact guidance | Prompt implementation agent + parent | Complete: metadata preserved, shared council corrected |
| AI and delivery skill disclosure | Two disjoint implementation agents + parent | Complete: targeted validators pass; AI semantic review approved |
| Distribution, regression and metrics | Parent | Complete: 675 PowerShell checks, 104 extension tests, compile |
| Independent review and fresh completion | Independent reviewer + parent | Approval received; final evidence and CLI closeout are machine-tracked |

## Validation and Acceptance

- [x] Initializer public exports, security checks and user-owned files preserved.
- [x] Targeted initialization, download, plugin and adapter tests pass.
- [x] Registry metadata reflects source YAML semantics, including block scalars.
- [x] Agent frontmatter/routing/handoffs preserved; mandatory body gates present.
- [x] Changed skill roots <=1,500 and references <=2,000 estimated tokens;
      no raised budgets and no new/growing overages.
- [x] Changed skills score >=80 on the existing skill rubric.
- [x] Before/after measures use the immutable task baseline, not an older commit.
- [x] Canonical sources, bundle, seed and installed references remain consistent.
- [x] Scrub signals triaged: two inherited directory/symlink patterns, no new declarations.
- [x] Mandatory doc drift passes; final independent semantic review remains below.
- [x] Independent v2.1 review approved the implementation with zero High/Medium findings.
- Runtime closeout MUST record the final hash-bound verdict at iteration three
  or later and complete successfully. The authoritative status is
  `.agentx/state/loop-state.json`, not a manually maintained checkbox.

## Concrete Steps

Use existing targeted extension tests and PowerShell behavioral suites, followed
by token checks, skill validation, asset regeneration, installed-boundary checks
and `agentx doc-drift check`. Record exact executed commands/results below when
the final scope is known. Avoid the previously stalled broad framework run.

## Idempotence and Recovery

Asset generation is repeatable from canonical sources. Test fixtures must be
isolated and cleaned up. Preserve prior work; revert only this task's failing
transformation if a contract cannot be preserved. No commit or push is requested.

## Decision Log / Model Council

- **GPT-5.4 / structure-audit**: Revise B to use separately verified structural
  and content slices; preserve export compatibility and test symlink/SSRF paths.
- **Claude Sonnet 5 / agent-prompts-audit**: Approve with contract, parser-edge
  and role-lens preservation conditions; require meaningful evidence rather than
  replacing arbitrary quotas with an empty quality bar.
- **Gemini 3.7 Flash / skill-prompts-audit**: Approve with compatibility exports,
  existing parser dependencies and local reference/parity validation.
- **Synthesis**: Select B and adopt all material conditions. Stage structural
  verification before content edits; freeze interfaces/frontmatter; retain
  role-specific council composition and safety/error contracts; validate actual
  registry output and extracted references. These are three real model responses,
  not three perspectives inferred from one model's summary.
- Deferred wholesale CLI/scorer extraction and bulk rewriting of uninspected
  domain skills. File size alone is not evidence of a defect.

## Surprises & Discoveries

- Much shared agent protocol prose was already centralized; the residual
  duplication is localized rather than a reason to rewrite every role.
- Prompt efficiency includes correct packaging and metadata retrieval, not
  just reducing Markdown length.
- Invoking the shared Node parser once per skill introduced excessive process
  overhead (full generation was stopped after exceeding 120 seconds). Added a
  batch path-input mode instead; the actual 134-skill generation then took
  3.55 seconds. This is not a benchmark against the original simplistic parser.
- Registry generation also collapsed singleton collections to JSON objects or
  strings. Zero/one/many collections now retain their schema's array shape.
- Structural parser validation: 42 registry checks and 33 existing skill-rubric
  checks passed. Both original stdin YAML and dependency-free batch mode are
  covered, including malformed input and failure preservation of valid output.
- The reusable-prompt check exposed missing policy coverage for all 23 files.
  Added a 1,500-token policy entry (no existing limit increased) and boundary
  regression coverage. Three prompt contracts now have 38 passing structural
  assertions; these do not substitute for live-model efficacy evaluations.
- The initial initializer extraction included formatting/expression rewrites.
  Restored original declaration text, then verified all 39 declarations match
  the pre-task source exactly after LF normalization; 56 targeted tests pass.
- Independent AI-domain review found three High and five Medium semantic losses
  despite high rubric scores. Restored model-selection evidence, actual helper
  schemas/limitations, provider diversity, proactive monitoring, recovery and
  price provenance. Re-review approved with no High/Medium; optional clarifications
  were also incorporated.
- Role compaction exposed contradictory council guidance: a brief asked one
  model to impersonate three members. Shared protocol, PM/Consulting prompts and
  generated briefs now require actual independent responses, preserve pending
  status and disclose limited diversity. Existing VS Code council tests pass
  (48); no provider execution was added.
- Standalone parser validation found underscored keys and embedded quotes in
  canonical metadata. Corrected those supported forms; all 134 skill names and
  descriptions match between native-YAML and dependency-free parsing.
- Targeted ESLint reports ten existing errors in three old files. HEAD comparison
  confirms all ten predate this work; the three extracted modules and compatibility
  barrel are lint-clean. No unrelated lint suppression or fixes were added.

## Blockers

None currently. Live model/provider evaluations are not part of this offline
structural change; do not infer model-quality or monetary savings from file size.

## Outcomes & Retrospective

Implementation, distribution and targeted checks are complete; independent review
approved the bounded implementation with zero High/Medium findings. Final review
hashes and CLI closeout are recorded in local machine evidence. The 17 edited root prompts
measure 60,474 -> 43,738 estimated tokens (27.67% reduction); all 183 frozen
frontmatter blocks match. Six skill roots measure 25,153 -> 8,203 (67.39%).
Root scores are 95, 93, 93, 96, 100 and 92 in the plan's skill order.
New reference text is separate from root savings; no billing or live-model
quality claim follows from these estimates.

Final matrix: distribution 43, customization 236, domain routing 204, registry 44,
skill rubric 33, prompt contracts 67, council brief 23 and token budgets 25
PowerShell checks passed (675 total); TypeScript compiled and 104 selected
extension tests passed. An actual generated council brief also passed five
assertions through the VS Code parser. The manifest verified 306 entries.
Documentation checked 12 claims with zero broken references. Budget coverage is
483 of 586 scanned files: 94 inherited violations remain, with zero regressions.
The broad framework suite was not rerun because of its known pre-existing
pre-commit-test stall; no full-suite or production certification is claimed.
The reviewer additionally observed a timeout in an unchanged setupWizard test
outside the scoped 104-test set. A suspected malformed documentation example was
checked with the TypeScript parser: zero syntax errors; redacted display text is
not a reliable basis for a source-syntax finding.
