---
description: 'Cross-Cutting Agent Protocol -- the single source of truth for the rules every AgentX agent shares (quality loop, subagent review, per-iteration reporting, Karpathy, Model Council, Scrub, Brainstorm, Plan, Research).'
applyTo: '**'
---

# Cross-Cutting Agent Protocol (Single Source of Truth)

> This file is the ONE canonical home for the cross-cutting concerns that apply to
> EVERY AgentX agent. Agent definition files (`.github/agents/*.agent.md`) MUST NOT
> re-document these rules in full. They keep only the two front-loaded stubs the
> empirical pitfall log requires (Pre-edit gate + Honesty rule) and point here.
>
> **Why this exists**: Duplicating these rules across agent files caused drift
> between documentation and runtime behavior. The discipline is
> now carried by two common layers that need ZERO per-agent text:
>
> 1. **Mechanical enforcement** -- the loop CLI, the agentic runner, the VS Code
>    extension runtime, and the pre-commit hook enforce the minimum-iteration and
>    subagent-review gates for every task class.
> 2. **This protocol doc** -- referenced from `copilot-instructions.md`,
>    `AGENTS.md`, `CLAUDE.md`, and `project-conventions.instructions.md`, all of
>    which load on `applyTo: '**'`.

---

## 1. Iterative Quality Loop (MANDATORY, NO SKIP)

### 1.1 Pre-Edit Gate (NON-SKIPPABLE)

Run `.agentx/agentx.ps1 loop start -p "<task>" -i <issue>` as the ABSOLUTE FIRST
tool call BEFORE editing, creating, or deleting any file. Reading the task and the
artifacts the active role is required to read is allowed; mutating the workspace
before `loop start` succeeds is a contract violation.

### 1.2 Honesty Rule

If asked whether the loop ran, run `.agentx/agentx.ps1 loop status` and report the
actual state verbatim. Never claim completion unless
`.agentx/agentx.ps1 loop complete` succeeded in the current session.

### 1.3 Risk-Based Minimum Iterations

The loop scales its minimum to the task's blast radius. This is enforced
mechanically, not by per-agent prose:

| Task class | Min iterations | Enforced in |
|------------|----------------|-------------|
| standard (simple bug/docs/review/research/coaching) | 1 | `agentx-cli.ps1`, `loopState.ts`, pre-commit hook |
| auto-fix-review | 2 | same |
| complex-delivery | 3 | same |
| agent-x | 3 | same |
| high-risk (security, auth, secrets, payments, migrations, production, release, infrastructure, compliance, privacy) | 5 | same |

The inferred minimum is a floor, not the finish line. A stored higher minimum is
never lowered. The loop is done only when
`loop complete` succeeds AND the subagent review pass was recorded as a
structured reviewer verdict on the FINAL iteration:

```
.agentx/agentx.ps1 loop iterate -s "Subagent Review: <outcome>" -e <evidence> \
  --verdict approved --reviewer <reviewer-id> --high 0 --medium 0 --low <n>
```

`--verdict`, `--reviewer`, `--high`, and `--medium` are all required together.
`loop complete` fails when the latest verdict is not `approved`, when HIGH or
MEDIUM is non-zero, or when further iterations were recorded after the approval
(the approval must cover the final state of the work).

There is no free-text fallback. An earlier design let loops predating the gate
satisfy it with a summary containing the word "review", keyed on a `reviewGate`
marker inside `loop-state.json` -- but that file is workspace-writable, so
deleting one property restored the weaker contract. A loop that predates the gate
simply records one reviewer verdict before completing.

### 1.4 Loop Steps

1. **Run verification** -- execute the checks relevant to this role.
2. **Evaluate** -- on any failure, find the root cause.
3. **Fix** -- address the failure.
4. **Re-verify** -- confirm the fix.
5. **Documentation drift (MANDATORY)** -- for every feature, user story and bug,
   including config/workflow-only changes, run `agentx doc-drift check` after
   validation. Reconcile public behavior, examples, configuration, operational
   guidance, counts and links; update docs or document no impact. The final
   quality report requires `documentationReview` with rationale and current
   reviewed-document hashes. Structural checks do not replace semantic review.
6. **Subagent review** -- once checks pass, spawn a same-role reviewer sub-agent
   that sees only the deliverable (diff / artifact / spec), not the author's
   rationale. It returns structured findings: HIGH / MEDIUM / LOW.
   - APPROVED = true only when zero HIGH and zero MEDIUM remain.
  - When implementation code changed, the evidence MUST follow
    [`evaluation/rubrics/code-quality.md`](../evaluation/rubrics/code-quality.md).
    Run `pwsh scripts/score-code-quality.ps1 -Mode Scope -Json` after the final
    code edit, score all ten dimensions, and use that JSON report as the
    final review iteration evidence.
7. **Address findings** -- fix all HIGH/MEDIUM, then re-run from Step 1.
8. **Repeat** until APPROVED, all Done Criteria pass, and the risk-based minimum is met.

The per-iteration focus table is printed by `loop start` and the current focus is
shown by `loop status`. The canonical tiers are:

| Tier | Focus |
|------|-------|
| standard | Deliver, verify, and independently review in one bounded pass |
| auto-fix | Review/fix with focused checks, then independent decision with final evidence |
| complex / AgentX | Implement, validate changed surfaces, then independent review with final evidence |
| high-risk | Implement, harden, run security and applicable adversarial checks, then independently review |

### 1.5 Per-Iteration Reporting + Final Summary (MANDATORY)

- **Report each iteration as it happens**: call
  `.agentx/agentx.ps1 loop iterate -s "<what changed + verification result>" -e <evidence>`
  after every fix/verify cycle. State the iteration number, focus, what you did,
  and the gate result.
- **Summarize at the end**: before handoff, print the role's Delivery Report table
  (a one-line outcome plus the per-row results) and run
  `.agentx/agentx.ps1 loop complete -s "<summary>" -e <fresh-evidence>`.

### 1.6 Hard Gate

The pre-commit hook blocks commits unless: status = complete, loopConsumed = false,
iteration >= the effective class minimum, and the latest recorded reviewer verdict is
`approved` with zero HIGH and zero MEDIUM findings, attributed to a reviewer id,
and recorded on the final work iteration. There is no skip token for the
iteration gate.

For code-bearing loops, `loop start` snapshots pre-existing dirty implementation
files and `loop complete` runs `scripts/score-code-quality.ps1`. Completion is
blocked unless the final review report scores at least 80, meets every blocking
floor, has no HIGH/MEDIUM findings, and matches the final file SHA-256 values.
The baseline and every archived iteration artifact are digest-bound. After a
stale-session reset, use `--include-existing-changes` only when the dirty code
belongs to the resumed task. Docs-only and test-only loops skip this gate.

---

## 2. Karpathy Guidelines (MANDATORY, NO SKIP)

Every coding, refactor, review, and pipeline phase MUST apply the four guidelines
and complete the "Self-Check Before Handoff" checklist, even for trivial changes.
Load and follow `.github/skills/development/karpathy-guidelines/SKILL.md`.

1. **Think Before Coding** -- restate the goal and surface assumptions first.
2. **Simplicity First** -- prefer the smallest design that meets the goal.
3. **Surgical Changes** -- touch only what the task requires.
4. **Goal-Driven Execution** -- define verifiable success criteria up front.

---

## 3. Model Council (MANDATORY for ADR/PRD/Eval -- NO SKIP)

When a role stages a new `docs/artifacts/adr/ADR-*.md`, it MUST also stage a
matching `docs/artifacts/adr/COUNCIL-*.md` capturing 3 diverse-model perspectives
plus a Synthesis section. The pre-commit hook hard-fails when the COUNCIL file is
missing; there is no skip token. Mandatory for Product Manager (prd-scope),
Architect (adr-options), and any complex task; also Data Scientist (ai-design),
Reviewer (code-review), and Consulting Research. Findings/decision MUST reflect the
council Synthesis (or document an override rationale).

Council execution:

- Give three independently invoked, diverse models the same questions and bounded
  evidence, with role-specific lenses. Use host-native agents or authorized model
  calls; record requested and resolved identities, source, failures and responses.
  Model names in role tables are preferences, not proof of execution.
- `agentx council -Topic <slug> -Question <question> -Context <evidence>` creates
  a brief; use `-Questions` for several decisions, `-Purpose` for the role's pack
  and `-OutputDir` for its artifact directory. Brief generation is not a completed
  council. Optional `-AutoInvoke` uses configured GitHub Models access; it does
  not grant new credentials, spending authority or permission to install tools.
- Replace `[AGENT-TODO]` only with actual attributed responses, then synthesize
  consensus, disagreements, risks and resulting changes. Do not have one model
  impersonate all members or claim independent consensus from role-play.
- Missing models, failed calls or a host's role-only fallback remain incomplete
  evidence for the diverse-model gate. Report the limitation rather than invent
  results. The agent coordinates this work; the user need not copy/paste prompts.

---

## 4. Scrub / Deslop (MANDATORY, NO SKIP)

Every run that changes files MUST pass a deslop scrub before review/handoff:
`pwsh .agentx/agentx.ps1 scrub -Path <changed-area>`. Run scrub through the agentx
CLI (not a literal `scripts/scrub.ps1` path) so it resolves the bundled scanner in
zero-copy workspaces. Apply safe fixes; behavior MUST NOT change. The pre-commit
hook hard-fails on HIGH-severity scrub findings in staged files; there is no skip
token. `ship.ps1` runs scrub unconditionally.

---

## 5. Brainstorm (Engineer pre-Plan gate)

For non-trivial work the `Research -> Brainstorm -> Plan -> Design -> Implement ->
Test -> Review` pipeline is mandatory. The Brainstorm step is satisfied by a
`brainstorm` entry in the clarification ledger OR an `## Alternatives Considered`
block in the execution plan, recorded BEFORE Plan is written. Reviewers verify this
during review; there is no missing-file hook gate.

---

## 6. Plan (Execution Plan for complex work)

Complex or multi-phase work MUST create and maintain a living execution plan from
`.github/templates/EXEC-PLAN-TEMPLATE.md` under `docs/execution/plans/` before
implementation. Any commit changing >= 8 code files MUST stage a matching
`EXEC-PLAN-*.md` or tag the commit `[skip-plan]`. Plans are living documents and
MUST be updated, not only authored.

---

## 7. Research (artifacts first)

Before asking any agent or the user for help, read the relevant repo-local
artifacts (`docs/artifacts/prd/`, `docs/artifacts/adr/`, `docs/artifacts/specs/`,
`docs/ux/`). Prefer retrieval-led reasoning: `read_file` the relevant SKILL.md,
instruction, or spec before generating. Limit clarification loops to 3 exchanges per
topic, then escalate to the user.

### Model-adaptive, cost-aware execution

- Load the active phase's artifact sections and skills; keep pointers to the
  rest. Do not weaken requirements or review gates to save context.
- Resolve model, tool and context/output capabilities through the active host.
  Model names and reasoning settings are advisory until the host confirms them.
- Use [token-optimizer](skills/development/token-optimizer/SKILL.md) for file
  budgets and offline tokenomics. Unknown prices or usage are not zero.
- Bound delegation, retries and output. Choose quality-qualified models first;
  urgency alone MUST NOT lower the tier for high-risk work.
- Include failed attempts and delegated work in economics. Cost per verified
  success is undefined if there are no verified successes.
- Evidence MUST describe the actual executed checks and final state. Never
  retimestamp, copy or relabel an old report to satisfy freshness. Regenerate
  evidence through execution; independent reviewers own their scores.

---

## 8. How Agents Reference This Protocol

Each `.github/agents/*.agent.md` keeps ONLY:

1. A front-loaded **Pre-edit gate (NON-SKIPPABLE)** clause (Section 1.1 above).
2. A front-loaded **Honesty rule** clause (Section 1.2 above).
3. The role-specific Done Criteria, focus rows, and Delivery Report table that are
   unique to that role.
4. A pointer: "Cross-cutting rules (loop minimums, subagent review, per-iteration
   reporting, Karpathy, Model Council, Scrub, Brainstorm, Plan, Research) are
   defined once in [.github/AGENT-PROTOCOL.md](AGENT-PROTOCOL.md)."

Agents MUST NOT restate the full cross-cutting prose. Keeping the front-loaded
stubs (1 and 2) in body prose is required because models routinely skip rules that
live only in deeper docs.

---

## 9. Plugins (Optional Capabilities)

Agents MAY invoke workspace plugins from `.agentx/plugins/` when the active phase
needs a capability beyond core tooling. Plugins are inspected via
[.agentx/plugins/registry.json](../.agentx/plugins/registry.json). Always prefer
canonical Markdown deliverables as the source of truth and use plugins only as
conversion bridges -- inbound (binary -> Markdown so the agent can review and cite
text) or outbound (Markdown -> binary when the user explicitly asks for a `.docx`
or `.pptx`).

| Plugin | Direction | Capability | When to use |
|--------|-----------|------------|-------------|
| [convert-docs](../.agentx/plugins/convert-docs/) | Out | Markdown -> Microsoft Word (`.docx`) via Pandoc | User explicitly asks for a `.docx` of a PRD, ADR, spec, brief, or review |
| [convert-slides](../.agentx/plugins/convert-slides/) | Out | Markdown -> Microsoft PowerPoint (`.pptx`) via Pandoc | User explicitly asks for a `.pptx` of a storyboard, presentation, or pitch deck |
| [read-docs](../.agentx/plugins/read-docs/) | In | Word / OpenDocument / RTF / HTML / EPUB -> Markdown via Pandoc | User attaches or references `.docx`/`.odt`/`.rtf`/`.html`/`.epub` for review, ingestion, or citation |
| [read-slides](../.agentx/plugins/read-slides/) | In | PowerPoint (`.pptx`) -> Markdown via python-pptx | User attaches or references a `.pptx` deck and the agent needs to cite slide content |
| [read-pdf](../.agentx/plugins/read-pdf/) | In | PDF -> Markdown with per-page anchors via pdftotext or pypdf | User attaches or references a `.pdf` and the agent needs to cite by `p.N` |

Plugin invocation rules:

- Confirm the dependency declared in `plugin.json` (`requires`) is on `PATH` before invoking; if missing, surface the install link from the plugin and stop.
- Pass user inputs through plugin parameters; never concatenate paths into shell strings.
- For inbound plugins: persist the generated `.md` under `docs/extracted/` (or a phase-specific folder) and cite findings against the extracted Markdown so they remain reviewable.
- For outbound plugins: report the generated artifact path and size after a successful run; never edit generated binaries directly -- regenerate from the Markdown source if changes are needed.

---

**See Also**: [AGENTS.md](../AGENTS.md) | [docs/WORKFLOW.md](../docs/WORKFLOW.md) |
[copilot-instructions.md](copilot-instructions.md) |
[project-conventions.instructions.md](instructions/project-conventions.instructions.md)
