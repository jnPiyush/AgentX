---
description: 'Execution plan: workflow hardening - mandatory Karpathy, mandatory scrub, default agent-browser testing, agent-instruction optimization.'
---

# Execution Plan: Workflow Hardening

**Author**: AgentX Auto
**Date**: 2026-05-22
**Status**: Complete

---

## Purpose / Big Picture

Harden the AgentX execution contract so five user requirements hold for every run:

1. No "ATV" code/terminology anywhere (code, docs, PRs).
2. Agent-browser (Playwright MCP) is the DEFAULT testing surface.
3. Karpathy guidelines are MANDATORY in every execution, not optional.
4. Scrub (deslop) runs on EVERY AgentX run, not opt-in.
5. Agent instructions optimized without losing: compound engineering, harness,
   looping iterations, self-review, agent-to-agent communication, brainstorm,
   sub-agent calls, strict workflow, memory management, context compaction.

Success = the three cross-cutting mandates (Karpathy, scrub, browser-default
testing) live in ONE always-on source of truth (DRY, not duplicated across 21
agent files), and the mechanical wiring (`ship.ps1`, tester agent, skills)
enforces them.

## Progress

- [x] Request #1: ATV reconnaissance - `git grep -w atv` = zero matches; no ATV
      files; prior artifacts use neutral "harness-design-adoption" naming. No
      action required.
- [x] Request #3 + #4 + #2 policy layer: centralize mandates in always-on rules.
- [x] Request #4 mechanics: scrub non-skippable in `ship.ps1`.
- [x] Request #2 mechanics: agent-browser default in tester agent + skills + ship.
- [x] Request #3 mechanics: karpathy mandatory marker in skill + engineer/agent-x.
- [x] Request #5: centralization IS the optimization (no per-file duplication);
      canonical workflow phrase updated to include `scrub`.

## Surprises & Discoveries

- Observation: Request #1 was already satisfied before this session began.
  Evidence: `git grep -nIw -e ATV -e atv` exits 1 (no matches) across tracked files.
- Observation: `ship.ps1` already had a `scrub` step but it was skippable via
  `-SkipScrub`; making scrub mandatory only required neutralizing that switch.

## Decision Log

- Decision: Centralize Karpathy/scrub/browser mandates in
  `.github/instructions/project-conventions.instructions.md` (applyTo `**`)
  rather than copy them into each of 21 agent files.
  Rationale: DRY + Karpathy "Simplicity First"; one source of truth is the
  optimization Request #5 asks for, and it applies to every run automatically.
- Decision: Keep `-SkipScrub` as a recognized switch but warn + ignore it, so
  existing callers do not break while scrub becomes mandatory.

## Plan of Work

1. Always-on rules: add Karpathy-mandatory, Scrub-mandatory, Browser-default
   testing bullets.
2. `ship.ps1`: scrub always runs; test step defaults to agent-browser smoke.
3. Tester agent + testing skill: agent-browser is the default test surface.
4. Karpathy + scrub skills: mark mandatory-in-AgentX.
5. Verify: ship dry-run, scrub still runs, ASCII clean, no ATV.

## Validation and Acceptance

- [x] `git grep -w atv` stays empty (exit 1, no matches).
- [x] `ship.ps1 -SkipScrub` warns and still runs scrub (switch neutralized).
- [x] Always-on rules list Karpathy + scrub + browser-default mandates.
- [x] Tester agent declares agent-browser as default.
- [x] No non-ASCII introduced (0 non-ascii bytes across 8 edited files).
- [x] Quality loop completed (3/20, with a Subagent Review iteration).

## Idempotence and Recovery

All edits are additive to markdown/ps1. Re-running edits is safe; rollback via
`git checkout -- <file>`.

## Outcomes & Retrospective

**Delivered**:

- #1 (No ATV): verified zero ATV references in tracked files; no action needed.
- #2 (Agent-browser default): centralized as an always-on rule; enforced in
  `ship.ps1` test step, `tester.agent.md` constraint, `browser-automation`
  SKILL.md (DEFAULT test surface block), and the Agent X self-review checklist.
- #3 (Karpathy mandatory): always-on rule + `karpathy-guidelines/SKILL.md`
  MANDATORY block (trivial-change exemption only) + engineer + Agent X gates.
- #4 (Scrub mandatory): always-on rule + `ship.ps1` (scrub unconditional,
  `-SkipScrub` deprecated/ignored) + `scrub/SKILL.md` MANDATORY block + engineer
  pre-handoff gate + Agent X self-review.
- #5 (Optimize without losing features): mandates centralized in the always-on
  instruction file (DRY) rather than duplicated across 21 agent files; all
  preserved features (compound engineering, harness loop, looping iterations,
  self-review, agent-to-agent comms, brainstorm, sub-agent calls, strict
  workflow, memory management, context compaction) left intact and verified by
  the subagent review iteration.

**Files individually edited**: `project-conventions.instructions.md`,
`scripts/ship.ps1`, `tester.agent.md`, `engineer.agent.md`, `agent-x.agent.md`,
`karpathy-guidelines/SKILL.md`, `scrub/SKILL.md`, `browser-automation/SKILL.md`.
All other agents inherit the mandates through the always-on instruction file.

**Verification**: ATV grep empty; ASCII clean; scrub findings all pre-existing
(none introduced by these edits); quality loop complete (3/20).

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
