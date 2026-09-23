# Quality-first coding harness

Frontier separates three questions: did the task succeed, does the context fit,
and what does the supplied usage cost? A low token count does not answer the
first question. A static file estimate does not answer the last.

## Working sequence

1. Read the requirement, current code and applicable contracts. Record missing
   evidence and reusable helpers before planning.
2. Define observable acceptance checks and retain a baseline. Keep the plan,
   open defects and relevant file paths available across compaction.
3. Discover active host capabilities. Select a quality-qualified tier; do not
   assume a frontmatter model name is the model that actually runs.
4. Budget context and all attempts, including independent review. Use stable
   prefixes if caching is supported, but do not assume a hit.
5. Implement a bounded change, test it, inspect slop/duplicate candidates, then
   verify the real integration boundary.
6. Have an independent reviewer score the exact final implementation. New code
   invalidates prior hashes. Unavailable checks remain unavailable, not passed.

## Local commands

```powershell
pwsh .agentx/frontier.ps1 route -Task "quick authentication fix" -Json
pwsh .agentx/frontier.ps1 tokens report -Json
pwsh .agentx/frontier.ps1 tokens check -Path .github/instructions
pwsh .agentx/frontier.ps1 tokens context -Json
pwsh .agentx/frontier.ps1 budget -File request.json -Json
pwsh .agentx/frontier.ps1 stage-gate plan -Stage requirements -Path docs/artifacts/prd/PRD-42.md
pwsh .agentx/frontier.ps1 scrub -Path src -Json
pwsh scripts/score-code-quality.ps1 -Mode Scope -Json
pwsh scripts/score-code-quality.ps1 -Mode Validate -ReportPath review.json
```

`route` is advisory; adapters select and execute actual models. `budget` is an
offline preflight, not automatic provider enforcement. It reads only the
caller-supplied request and rates and performs no paid call.

## Token budgets

`.token-limits.json` governs per-file budgets. Counts are LF-normalized
`ceil(characters / 4)` approximations; use provider usage for billing.
The report includes all covered/uncovered files and violations.

Full `tokens check` fails on any overage. For inherited debt, an explicit
`tokens check -BaselineRef <commit>` fails new or growing overages while
retaining all debt in its report. PR checks compare against the PR base with
the same current policy. No-regression is not equivalent to debt-free.

The repaired glob matcher exposes previously invisible overages in older
skills and reference documents. Resolve them through reviewed progressive
disclosure; do not inflate limits simply to turn the gate green.

## Always-on context

Every request pays for the router files (`.github/copilot-instructions.md`,
`AGENTS.md`, `CLAUDE.md`), every `applyTo: '**'` instruction, and each file
those instructions link to, because hosts attach Markdown-linked instruction
files. `tokens context` measures that closure (deduplicated, links in code
ignored, Claude `@imports` followed) plus the skill and agent metadata tier,
and fails when `alwaysOn` limits in `.token-limits.json` are exceeded.

Keep always-on files link-free: name deeper documents as plain paths the agent
reads when the task needs them. Replacing links with paths cut the always-on
context of a Copilot Chat request from about 75,000 to about 2,300 tokens;
`tokens context` also counts `CLAUDE.md` for Claude Code, so it reports about
3,300. `frontier diagnose` reports the current figure.

## Tokenomics

Use the [request contract](../../.github/skills/development/token-optimizer/references/tokenomics.md)
and [synthetic examples](../../.github/skills/development/token-optimizer/references/tokenomics-examples.md).
No example rate is a production price.

- Supply actual context/output limits and complete prompt-token estimates.
- Reserve response tokens and margin; a missing limit cannot prove fit.
- Normalize cache reads/writes as disjoint subsets of total input.
- Do not add reasoning output again if the provider already includes it.
- Record retries/delegations as separate calls with unique identifiers.
- Include rate source/date; totals are estimates, not invoices.
- Keep host credits distinct from USD. Unknown total cost remains null even
  when a known subtotal exists.
- Compare total attempt cost per verified success; no successes means the
  denominator is undefined.

The CLI runner meters its own calls. Each run records provider-reported usage
per call (agent, self-review, compaction and delegated clarification runs),
prints the totals, and writes `.frontier/sessions/<session>.usage.json` in the
`budget` call format; add `rates` and `rateId` values to price it. A delegated
clarification run writes no file of its own: its calls are in the requesting
run's file.
OpenAI-compatible usage has no cache-write category, so those calls record zero
cache writes; a call whose provider omits the cached-input count stays unpriced.
Calls with no reported usage stay unknown, making the totals a lower bound. Set
`harness.tokenBudget` in `.frontier/config.json` to stop a run before its next
model call, including self-review, compaction summaries and delegated
clarification runs, once reported usage reaches the budget
(`exitReason: token_budget`). The call that crosses the budget completes; a stop
before or during self-review returns the unreviewed response, and a stop inside
a clarification ends the requesting run too.

## Review and anti-slop

Use the existing [implementation rubric](../../evaluation/rubrics/code-quality.md),
not a second competing quality score. High/Medium findings and blocking floors
cannot be offset by better style, less code or fewer tokens. Non-code stage
deliverables (PRD, UX, ADR and spec, plan, review, certification) use the
[stage-gate rubric](../../evaluation/rubrics/stage-gates.md): deterministic
structure checks plus an independent, hash-bound reviewer report.

Scrub flags observable patterns. It cannot identify AI authorship or prove
runtime equivalence. Similar blocks need semantic review before extraction:
different ownership, error contracts or performance needs may justify separation.
Review code across callers and installed boundaries, not only within a diff.

Do not force a finding quota or choose a judge solely by model size. Measure
reviewer precision and disagreement against labelled cases.

## Instructions for capable models

Current models already apply general engineering practice. Instructions earn
their tokens only when they carry what the model cannot infer:

- Project facts: paths, commands, conventions, decisions and known pitfalls.
- Hard boundaries, each with its reason; a model generalizes from the why.
- The verification that proves the work, preferably as a gate that runs.

Drop restated best practice (write tests, handle errors, follow SOLID), repeated
phase narration and all-caps warnings. Strong emphasis makes capable models
overtrigger and crowds out task context. Reserve MUST for invariants that a
gate enforces, and state each rule once in the file that owns it.

## Evidence boundaries

Deterministic fixture tests establish arithmetic, routing and gate behavior.
They do not establish production savings or latest-model task performance.
Those need representative held-out tasks, authorized provider runs, measured
usage and explicit uncertainty. Never relabel old evidence or modify its
timestamp to satisfy freshness checks.

See [research and council](HARNESS-RESEARCH-20260905.md).
