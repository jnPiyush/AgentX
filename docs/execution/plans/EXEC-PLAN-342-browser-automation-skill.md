<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: Browser Automation as a First-Class Skill

**Issue**: #342
**Author**: AgentX Auto
**Date**: 2026-05-08
**Status**: Draft

---

## Purpose / Big Picture

AgentX agents currently have no native way to drive a browser. UX prototype validation, accessibility audits, web research, and verification of HTML deliverables all require the user to open a browser manually. This plan adds browser automation as a shared skill consumed by existing roles (UX Designer, Consulting Research, Reviewer when validating prototypes), wired through the existing MCP plumbing rather than a new bespoke tool layer.

Success means a durable, validated `browser-automation` skill exists, the UX Designer agent uses it in its WCAG 2.1 AA validation step, and Skills.md surfaces it in the Quick Reference. No new long-running services are introduced.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [ ] Repo context and dependencies reviewed
- [ ] Validation approach defined
- [ ] Implementation started
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
	Evidence:

## Decision Log

- Decision:
	Treat browser automation as a shared skill, not a new agent role.
	Options Considered:
	- Add a new `browser-agent` role
	- Add a shared skill consumed by existing roles
	Chosen:
	Add a shared skill consumed by existing roles
	Rationale:
	Browser actions are a means to an end (validate UX prototype, gather research evidence), not a standalone agent identity. AgentX already has 21 roles - adding another increases routing complexity without clear ownership benefit.
	Date/Author:
	2026-05-08 / AgentX Auto

## Context and Orientation

Relevant existing primitives:

- `.github/skills/` is the canonical skill home. Pattern: `{category}/{skill-name}/SKILL.md`, <5K tokens, optional `scripts/` and `references/`.
- `Skills.md` is the index agents consult. New skills must be added to the pipe-delimited directory and at least one Quick Reference row.
- `.github/agents/ux-designer.agent.md` defines the WCAG 2.1 AA validation step that currently has no automation hook.
- MCP servers are wired via `.vscode/mcp.json` and the per-workspace MCP config; Playwright MCP is the natural transport.
- `scripts/validate-skill.ps1` enforces frontmatter, token budget, scoring, structure, and references.

Architect/skill-creator boundary applies: write the skill, ADR, and supporting docs only. Do not modify runtime source or add new MCP server bindings without a separate spec slice.

## Pre-Conditions

- [x] Issue exists and is classified (#342, type:feature)
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified (skill-creator, ux-ui, security)
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

1. Inventory existing UX validation steps and identify the exact handoff point where browser automation belongs (UX Designer prototype validation; optionally Reviewer when reviewing UX deliverables).
2. Decide tool transport via a short ADR. Options:
	 - **Option A**: Playwright MCP server (Microsoft-maintained) wired via `.vscode/mcp.json`.
	 - **Option B**: Bundled Playwright Node script invoked via `run_in_terminal`.
	 - **Option C**: BrowserBase / hosted browser service (rejected as not local-first).
	 Recommend Option A for separation of concerns and MCP tool reuse.
3. Author `.github/skills/development/browser-automation/SKILL.md` covering:
	 - When to load the skill (prototype validation, web research, HTML verification).
	 - Required prerequisite (Playwright MCP server installed; install command listed).
	 - Tool surface summary (navigate, click, fill, screenshot, extract text, run axe a11y audit).
	 - Anti-patterns (do not browse arbitrary URLs in `restricted` security profile; do not store credentials in scripts; do not screenshot pages containing secrets).
	 - Cross-references to ux-ui, security, and prototype-craft skills.
4. Add a `references/wcag-validation.md` covering how to drive an axe-core audit through the MCP browser tools.
5. Update `Skills.md`:
	 - Add directory entry under `dev|browser-automation|.github/skills/development/browser-automation/SKILL.md|...`.
	 - Add Quick Reference rows for `UX Prototype Validation` and `Web Research` that load the new skill.
6. Update `.github/agents/ux-designer.agent.md` so the prototype validation step explicitly references the new skill (read-first, retrieval-led).
7. Run `scripts/validate-skill.ps1` and `scripts/validate-references.ps1`.
8. Self-review against the skill-creator + architect contracts.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Map existing UX validation handoff points | AgentX Auto | Not Started | Cite ux-designer.agent.md sections |
| 2 | ADR: tool transport choice (Playwright MCP vs alternatives) | AgentX Auto | Not Started | docs/artifacts/adr/ADR-342.md |
| 3 | Author SKILL.md (<5K tokens) | AgentX Auto | Not Started | .github/skills/development/browser-automation/SKILL.md |
| 4 | Add references/wcag-validation.md | AgentX Auto | Not Started | axe-core via Playwright MCP |
| 5 | Update Skills.md directory + Quick Reference | AgentX Auto | Not Started | Two new rows minimum |
| 6 | Update UX Designer agent to consume the skill | AgentX Auto | Not Started | Retrieval-led reference |
| 7 | Run validate-skill.ps1 + validate-references.ps1 | AgentX Auto | Not Started | Both must pass |
| 8 | Self-review + close loop | AgentX Auto | Not Started | Subagent review pass required |

## Concrete Steps

```powershell
# Validate the new skill structure
.\scripts\validate-skill.ps1 -SkillPath '.github/skills/development/browser-automation/SKILL.md'

# Validate cross-references
.\scripts\validate-references.ps1

# Token budget check
.\scripts\token-counter.ps1 -Path '.github/skills/development/browser-automation/SKILL.md'

# Loop progression
.\.agentx\agentx.ps1 loop iterate -s "Skill drafted; ADR drafted; references added"
```

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Playwright MCP server not yet listed in workspace MCP config | UX Designer cannot exercise the skill end-to-end during validation | Document install steps in the skill; defer wiring to a follow-up DevOps issue | Open |

## Validation and Acceptance

- [ ] `.github/skills/development/browser-automation/SKILL.md` exists, <5K tokens, valid frontmatter.
- [ ] `scripts/validate-skill.ps1` passes for the new skill.
- [ ] `scripts/validate-references.ps1` passes for the workspace.
- [ ] ADR at `docs/artifacts/adr/ADR-342.md` documents 3+ tool-transport options with explicit recommendation.
- [ ] `Skills.md` directory + at least two Quick Reference rows updated.
- [ ] UX Designer agent definition references the new skill in the prototype validation step.
- [ ] Anti-patterns include security-profile guidance (no arbitrary URLs in `restricted`).
- [ ] No new runtime code or tool bindings introduced (skill + docs only).

## Idempotence and Recovery

Skill files and docs are write-once per refinement cycle. Re-running the validation scripts is safe and idempotent. If the chosen tool transport changes (e.g., Playwright MCP gets superseded), supersede ADR-342 with a new ADR and update the skill's prerequisite section.

## Rollback Plan

Documentation/skill-only change. Rollback = `git revert` of the skill, ADR, Skills.md, and ux-designer agent edits.

## Artifacts and Notes

- Issue: `.agentx/issues/342.json`
- Skill (planned): `.github/skills/development/browser-automation/SKILL.md`
- ADR (planned): `docs/artifacts/adr/ADR-342.md`
- References (planned): `.github/skills/development/browser-automation/references/wcag-validation.md`

## Outcomes & Retrospective

<!-- Fill at completion: tool-transport choice, skill score, deferred MCP wiring work. -->

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
