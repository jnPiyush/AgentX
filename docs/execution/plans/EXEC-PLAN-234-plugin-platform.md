<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: AgentX Plugin Publication Platform

**Issue**: #234
**Author**: AgentX Auto
**Date**: 2026-03-18
**Status**: Complete

---

## Purpose / Big Picture

Define how AgentX can support independently publishable plugins on top of AgentX core without breaking the current local-first workspace model. Success means the repo has an ADR and a technical specification that describe the host, package, registry, compatibility, trust, and rollout model clearly enough for implementation planning.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
	The current plugin surface is more mature than the public story suggests: there is already a plugin schema, the `convert-docs` plugin, and an Add Plugin command.
	Evidence: `.github/schemas/plugin-manifest.schema.json`, `.agentx/plugins/convert-docs/plugin.json`, `vscode-extension/src/commands/pluginsCommandInternals.ts`
- Observation:
	The install path is still tied to the AgentX source archive, so publication and discovery are not independent yet.
	Evidence: `vscode-extension/src/commands/pluginsCommandInternals.ts` downloads `ARCHIVE_URL` and copies from `.agentx/plugins`

## Decision Log

- Decision:
	Treat this work as a feature-level architecture slice instead of a spike-only research note.
	Options Considered:
	- Keep as a spike and stop at research findings
	- Reclassify as architecture work with ADR and spec deliverables
	Chosen:
	Reclassify as architecture work with ADR and spec deliverables
	Rationale:
	The user asked to proceed, and the next useful artifact is a durable architecture contract rather than another transient summary.
	Date/Author:
	2026-03-18 / AgentX Auto

## Context and Orientation

This repo already contains the current plugin primitives. The most relevant files are:

- `.github/schemas/plugin-manifest.schema.json` for the current plugin contract
- `vscode-extension/src/commands/pluginsCommandInternals.ts` for the current Add Plugin workflow
- `.agentx/plugins/convert-docs/plugin.json` as the current first-party plugin package
- `packs/agentx-core/manifest.json` and `packs/agentx-copilot-cli/manifest.json` as existing distribution abstractions

The architect boundary applies here: write only architecture artifacts and do not modify runtime source or tests.

## Pre-Conditions

- [x] Issue exists and is classified
- [ ] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

Note: The local AgentX CLI dependency check does not resolve the newly created GitHub issue in this workspace state, so GitHub issue #234 is treated as the active source of truth.

## Plan of Work

Document the current state first, then evaluate publication options against the repo's actual plugin/runtime model and against proven external plugin ecosystems. Use that evidence to select a phased architecture that preserves local workspace installation while adding independent package identity, compatibility enforcement, trust verification, and bundle-level composition through packs.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Gather repo evidence for current plugin/install behavior | AgentX Auto | Complete | Schema, install command, convert-docs plugin, and pack manifests reviewed |
| 2 | Gather external publication-model evidence | AgentX Auto | Complete | VS Code, npm, Backstage, and Forge references reviewed |
| 3 | Write ADR with 4 options and explicit recommendation | AgentX Auto | Complete | Recommended path is registry index plus release artifacts |
| 4 | Write technical specification for package, registry, install, and trust model | AgentX Auto | Complete | Remained zero-code |
| 5 | Validate docs, capture learning, and close out the loop | AgentX Auto | Complete | Includes memory, handoff, and compound capture |

## Concrete Steps

- Review the current plugin manifest schema and install flow
- Compare current behavior against proven plugin publication ecosystems
- Define option set and decision criteria
- Write ADR and spec with diagrams, tables, and explicit migration path
- Validate markdown structure and capture reusable learning

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Local dependency command does not resolve GitHub issue #234 | Low | Use GitHub issue as source of truth and continue architecture work | Accepted |

## Validation and Acceptance

- [x] ADR exists at `docs/artifacts/adr/ADR-234.md` with 3+ evaluated options
- [x] Spec exists at `docs/artifacts/specs/SPEC-234.md` with explicit selected stack and rollout plan
- [x] Current-state and target-state claims are evidence-based and do not overstate implemented runtime behavior
- [x] Compound capture is resolved with a learning artifact

## Idempotence and Recovery

This work is documentation-only. If validation fails, update the affected markdown artifact and re-run the validation steps. No product runtime state is mutated by these changes.

## Rollback Plan

Remove the newly added architecture artifacts for issue #234 if the decision is rejected or replaced by a newer ADR.

## Artifacts and Notes

- ADR: `docs/artifacts/adr/ADR-234.md`
- Spec: `docs/artifacts/specs/SPEC-234.md`
- Learning capture: `docs/artifacts/learnings/LEARNING-234.md`
- Handoff: `.agentx/handoffs/handoff-234-architect-to-engineer.json`
- Validation:
	- `get_errors` reported no issues in the new docs
	- `scripts/validate-handoff.ps1 -IssueNumber 234 -FromAgent architect -ToAgent engineer` passed
	- `scripts/validate-references.ps1` still fails on pre-existing broken links outside this change set, including archived docs and an older execution plan

## Outcomes & Retrospective

- Completed the architecture slice for publishable plugins on top of AgentX core.
- Chosen direction: registry index plus versioned release artifacts, with workspace-local installation preserved.
- Key contract additions: publisher-qualified identity, `engines.agentx`, permissions, capabilities, and trust metadata.
- Packs remain a bundle layer above plugins rather than the publication mechanism itself.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)