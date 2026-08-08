---
description: 'Execution plan for promoting Power Platform Builder and adding Fabric Engineer as visible core AgentX agents.'
---

<!-- Inputs: 401, domain agents, 2026-08-07, AgentX -->

# Execution Plan: Power Platform Builder and Fabric Engineer

**Author**: AgentX
**Date**: 2026-08-07
**Status**: Complete

## Purpose / Big Picture

Make Power Platform and Microsoft Fabric first-class AgentX delivery domains without creating product-level agent sprawl. Success means two visible core agents are discoverable, routable, executable, bundled, and validated while preserving Power BI Analyst and Data Scientist ownership boundaries.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Canonical agent definitions added
- [x] Runtime, routing, host, and distribution surfaces wired
- [x] Independent review completed; blocking findings remediated
- [x] Final acceptance evidence recorded

## Surprises & Discoveries

- Observation: GitHub issue 401 was previously used by an older CLI runtime initiative.
  Evidence: Existing tracked `ADR-401.md`, `COUNCIL-401.md`, `SPEC-401.md`, and `EXEC-PLAN-401-cli-runtime-migration.md` predate this issue. New artifacts use the `domain-agents` suffix to avoid overwriting history.
- Observation: The Power Platform pack already contains a complete agent contract, but core routing and extension contributions cannot discover it.
  Evidence: `packs/agentx-power-platform-builder/agents/low-code-builder.agent.md` exists while `.github/agents/` and `vscode-extension/package.json` omit it.
- Observation: Fabric has three substantial skills but no role owning Lakehouse, Warehouse, notebook, pipeline, quality, or lineage artifacts.
  Evidence: `.github/skills/data/fabric-*.*/SKILL.md` exist while no `fabric-engineer.agent.md` exists.
- Observation: Prompt constraints do not mechanically prevent tenant-capable `pac` commands.
  Evidence: Independent review found the runner enforced only file boundaries and generic dangerous commands.
- Observation: Generic feature/devops words could outrank Fabric intent, and mixed Fabric work could absorb Power BI or Data Science ownership.
  Evidence: Adversarial classifier probes reproduced all four precedence failures before remediation.

## Decision Log

- Decision: Add exactly two visible agents.
  Options Considered: keep both domains as skills; add one umbrella data/low-code agent; add product-level agents; add Power Platform Builder plus Fabric Engineer.
  Chosen: Power Platform Builder plus Fabric Engineer.
  Rationale: Each has a distinct deliverable, workflow, safety boundary, and handoff contract. Product-level splits would fragment shared artifacts.
  Date/Author: 2026-08-07 / AgentX
- Decision: Keep one canonical Power Platform contract in `.github/agents/` and convert the pack-local agent to a compatibility pointer.
  Options Considered: duplicate full body; remove pack agent; thin wrapper.
  Chosen: thin wrapper.
  Rationale: Preserves pack discovery without creating two sources of truth.
  Date/Author: 2026-08-07 / AgentX
- Decision: Retain `low-code-builder` only as a compatibility phrase while using `power-platform-builder` as the runtime ID.
  Options Considered: preserve old runtime ID; rename all references with no compatibility; canonical new ID plus compatibility metadata.
  Chosen: canonical new ID plus compatibility metadata.
  Rationale: Aligns product naming while keeping existing skill discovery legible.
  Date/Author: 2026-08-07 / AgentX
- Decision: Enforce Power Platform command safety twice: in the AgentX runner and with an agent-scoped `PreToolUse` hook.
  Options Considered: prompt-only rule; global pac denylist; role-aware runner rule; role-aware runner plus agent hook.
  Chosen: role-aware runner plus agent hook.
  Rationale: CLI execution needs deterministic protection, while VS Code/Agents Window execution needs the same role-scoped boundary without blocking DevOps or maker workflows globally.
  Date/Author: 2026-08-07 / AgentX
- Decision: Use canonical runtime IDs in handoff messages.
  Options Considered: short aliases (`fabric`, `power-platform`) or canonical IDs (`fabric-engineer`, `power-platform-builder`).
  Chosen: canonical IDs.
  Rationale: Removes normalization ambiguity and keeps runner, CLI, schema, and tests aligned.
  Date/Author: 2026-08-07 / AgentX

## Alternatives Considered

1. Skills only: rejected because neither domain has end-to-end workflow ownership or routing.
2. Product-level agents: rejected because Power Platform components share one solution manifest and Fabric workloads share one governed data platform.
3. Merge Fabric into Power BI Analyst or Data Scientist: rejected because upstream data engineering is distinct from report authoring and model/evaluation work.

## Context and Orientation

Canonical definitions live under `.github/agents/`. Runtime role recognition lives in `.agentx/agentx-cli.ps1` and `.agentx/agentic-runner.ps1`. Machine-readable role and routing mirrors live under `.github/registries/`. VS Code declarative contributions are generated from bundled agents by `vscode-extension/scripts/prepare-chat-contributions.js`; bundled assets are refreshed by `vscode-extension/scripts/copy-assets.js`. Copilot CLI and core pack manifests enumerate canonical agents. Claude and Cursor use thin command wrappers.

Unrelated existing changes in `.agentx/agentx-cli.ps1`, the infrastructure-governance skill, and `docs/pitch/agentx-features/` must be preserved and excluded from this task's claims.

## Pre-Conditions

- [x] Issue exists and is classified as `type:feature`
- [x] Dependencies checked; no project-status integration is configured
- [x] Required skills loaded: agent customization, token optimizer, multi-agent orchestration, Fabric analytics, solution anatomy, Karpathy, testing, and verification
- [x] Complexity assessed as multi-surface and plan-required
- [x] Model Council recorded in `docs/artifacts/adr/COUNCIL-401-domain-agents.md`

## Plan of Work

First author the two canonical role contracts with narrow file ownership and explicit handoffs. Then wire runtime aliases, routing, pipelines, status tracking, host wrappers, pack manifests, and extension skill links. Update current inventory and workflow documentation without rewriting historical artifacts. Finally sync generated bundles and prove canonical/bundled parity plus focused and full validation.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Add canonical Power Platform Builder contract | AgentX | Done | Role-scoped hook and runner policy preserve no-tenant-mutation boundary |
| 2 | Add canonical Fabric Engineer contract | AgentX | Done | Power BI and Data Scientist boundaries explicit |
| 3 | Add routing, pipeline, CLI, and handoff support | AgentX | Done | New types: `type:lowcode`, `type:fabric`; canonical handoff IDs |
| 4 | Add host wrappers, pack manifests, and extension surfaces | AgentX | Done | Generated chat contributions reach 15 |
| 5 | Update current inventories and regression tests | AgentX | Done | Historical ADR/spec counts remain historical |
| 6 | Sync bundle, scrub, validate, and review | AgentX | Done | Independent final review approved with zero HIGH/MEDIUM findings |

## Concrete Steps

- Run `node vscode-extension/scripts/copy-assets.js` and `node vscode-extension/scripts/prepare-chat-contributions.js` after canonical edits.
- Run `pwsh tests/test-framework.ps1` and targeted agent inventory/routing tests.
- Run `pwsh scripts/validate-frontmatter.ps1`, `pwsh scripts/validate-references.ps1`, and token checks.
- Run extension compile/tests after package and tree-provider changes.
- Run `.agentx/agentx.ps1 scrub -Path <changed-area>` before review.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Historical issue 401 collision | Generic artifact names would overwrite prior work | Use `-domain-agents` suffix | Resolved |
| Existing uncommitted changes | Broad diffs could mix unrelated work | Make anchored edits and verify scoped diff separately | Mitigated |

## Validation and Acceptance

- [x] Both canonical agent definitions pass frontmatter validation and token limits.
- [x] `type:lowcode` and `type:fabric` route correctly from backlog and Ready states.
- [x] Runtime resolves both new agent IDs and the Low-Code Builder compatibility alias.
- [x] Power Platform Builder mechanically blocks tenant-capable `pac` commands in runner and agent-scoped hook paths.
- [x] Fabric Engineer separates platform, Power BI, and AI/ML ownership; adversarial mixed-intent classifier tests cover handoffs.
- [x] VS Code contributes 15 visible agents and bundled agent hashes match canonical source.
- [x] Core and Copilot CLI pack manifests include the complete 26-agent inventory.
- [x] Routing, classifier evaluation, frontmatter, token, PSScriptAnalyzer, parity, extension compile/tests, installer regression, and final re-review pass; framework/reference caveats are unrelated pre-existing failures recorded below.

## Idempotence and Recovery

Generated assets are rebuilt from canonical root files, so rerunning copy and contribution scripts is safe. If validation fails, fix only the canonical source or generator input, rerun generation, and compare hashes. Do not hand-edit bundled copies.

## Rollback Plan

Remove the two canonical agents, their thin host wrappers, routing/pipeline/runtime entries, manifest entries, and current inventory changes; rerun extension asset generation to remove bundled outputs. Do not touch the unrelated pre-existing workspace modifications.

## Artifacts and Notes

- Council: `docs/artifacts/adr/COUNCIL-401-domain-agents.md`
- Issue: `https://github.com/jnPiyush/AgentX/issues/401`
- Existing historical 401 artifacts are unrelated and remain unchanged.
- Final focused behavior: 114/114 at approval review, expanded to 114+ adversarial assertions after strict end-anchor and handoff evidence fixes.
- Classifier evaluation: 23/23, correctness 1.0, task completion 1.0.
- Extension: compile passed; 1013 tests passed.
- Frontmatter: 623/623; token budgets pass; PSScriptAnalyzer security gate pass; skill/install parity 16/16.
- Installer regression: 138/138 assertions passed during independent review and was rerun for final evidence.
- Known unrelated caveats: `tests/test-framework.ps1` remains 141/142 because `tests/provider-behavior.ps1` expects evidence move semantics that conflict with the current copy semantics; reference validation reports 14 pre-existing broken links under generated `evaluation/skillopt/**` runs.

## Outcomes & Retrospective

Implemented exactly two visible agents with canonical routing, host wrappers, runtime aliases, distribution manifests, extension contributions, and ownership boundaries. Independent review drove the Power Platform terminal boundary from prompt-only guidance to a fail-closed fixed-command policy in both AgentX runner and agent-scoped hook paths, with Claude Code terminal access removed for the role. Mixed-domain routing and concrete handoff evidence are covered by adversarial executable tests. No product-level agents were added.

---

**Template**: `.github/templates/EXEC-PLAN-TEMPLATE.md`