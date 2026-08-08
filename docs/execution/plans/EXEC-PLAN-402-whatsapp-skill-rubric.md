---
description: 'Execution plan for WhatsApp companion hardening and skill-quality rubric implementation.'
---

<!-- Inputs: 402, WhatsApp companion and skill rubric, 2026-08-07, GitHub Copilot -->

# Execution Plan: WhatsApp Companion and Skill Rubric

**Author**: GitHub Copilot
**Date**: 2026-08-07
**Status**: Complete

## Purpose / Big Picture

Make the WhatsApp companion safe and reliable enough to control AgentX remotely, and replace the legacy structural skill score with an explicit, explainable quality rubric. Success is observable through security-focused companion tests, clean production dependency audit, full command-policy coverage, and rubric validation across all 130 skills.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] WhatsApp hardening implemented
- [x] Skill rubric implemented
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: Self-chat messages emit `message_create`, not the current `message` handler.
  Evidence: Installed `whatsapp-web.js` client source and independent review.
- Observation: Current loop mutation routes omit mandatory evidence and can report false success because CLI validation failures return exit code 0.
  Evidence: Current command router versus `.agentx/agentx-cli.ps1` evidence gates.
- Observation: WhatsApp production dependencies contain two HIGH advisories.
  Evidence: `npm audit --omit=dev --omit=optional --audit-level=high`.
- Observation: Current skill scoring mixes structural checks and subjective heuristics into 40 points; all-skills baseline fails with an average 31.1/40 and lacks blocking floors.
  Evidence: `scripts/score-skill.ps1 -All`.
- Observation: This long-lived branch already changed 15 skills before the rubric existed; 14 score below the new target.
  Evidence: Merge-base changed-skill scoring against `origin/master`.

## Decision Log

- Decision: Use read-only-by-default commands with explicit capability flags and nonce confirmation for mutating commands.
  Options Considered: Keep unrestricted allowlisted operator; disable all mutations; capability-and-confirmation model.
  Chosen: Capability-and-confirmation model.
  Rationale: Preserves useful remote control while limiting account compromise, replay, transcription, and accidental-execution risk.
  Date/Author: 2026-08-07 / GitHub Copilot
- Decision: Voice defaults to transcript-only and can never bypass mutation confirmation.
  Options Considered: Continue auto-execution; disable voice; transcript-first with optional read-only auto-execution.
  Chosen: Transcript-first with optional read-only auto-execution.
  Rationale: Voice recognition is probabilistic and cannot safely authorize repository mutations.
  Date/Author: 2026-08-07 / GitHub Copilot
- Decision: Replace the 40-point skill score with a 100-point weighted rubric plus blocking floors.
  Options Considered: Patch current section checks; add only LLM-based judging; deterministic weighted rubric with optional future judge dimensions.
  Chosen: Deterministic 100-point rubric with JSON evidence and blocking criteria.
  Rationale: CI needs reproducible scoring; subjective optimization can remain a separate SkillOpt/evaluation layer.
  Date/Author: 2026-08-07 / GitHub Copilot
- Decision: Compare changed skills directly with the trusted target revision.
  Options Considered: Fail the branch on all historical changes; ignore the full branch delta; store a mutable exception file; score the immutable base revision.
  Chosen: Base-revision score and blocker comparison, with a 70-point floor for newly added skills.
  Rationale: New skills meet 70 immediately while historical branch debt cannot worsen or authorize its own exceptions.
  Date/Author: 2026-08-08 / GitHub Copilot

## Context and Orientation

WhatsApp code lives under `companions/whatsapp/`. The current bot directly initializes `whatsapp-web.js`, routes commands through `commandRouter.js`, and invokes `.agentx/agentx.ps1` via `agentxRunner.js`. Skill scoring lives in `scripts/score-skill.ps1`; validation delegates to it through `scripts/validate-skill.ps1`. Skill conventions are defined by `.github/skills/development/skill-creator/SKILL.md` and the agentskills.io frontmatter contract.

## Pre-Conditions

- [x] Issue #402 exists and is In Progress
- [x] Dependencies checked
- [x] Required review, testing, skill-creator, AI-evaluation, Karpathy, and verification skills loaded
- [x] Task confirmed complex and execution plan created before implementation

## Plan of Work

1. Refactor the WhatsApp event handler behind dependency injection, implement replay protection, command queueing, capability policy, nonce confirmation, and safe lifecycle shutdown.
2. Validate configuration at startup, remove secret-file support, sanitize child environments and output, bound voice transcription, and make loop notifications resilient to partial writes and watcher errors.
3. Upgrade vulnerable dependencies without weakening the runtime contract; add tests for self-chat, policy, confirmations, runner limits, watcher recovery, transcription, and shutdown.
4. Implement a deterministic skill rubric with weighted dimensions, blocking criteria, tiers, JSON output, batch summaries, and validation integration.
5. Add rubric fixtures/tests and update documentation; run full companion, skill, framework, security, scrub, and independent review gates.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | WhatsApp policy and lifecycle refactor | GitHub Copilot | Complete | Read-only default, nonce confirmation |
| 2 | WhatsApp security and reliability hardening | GitHub Copilot | Complete | Config, runner, voice, watcher |
| 3 | WhatsApp tests and dependency remediation | GitHub Copilot | Complete | 23/23; lines 90.65%, branches 71.92%, functions 78.26%; audit clean |
| 4 | Skill rubric and validator integration | GitHub Copilot | Complete | 100-point deterministic rubric |
| 5 | Full validation and review | AgentX Reviewer | Complete | APPROVED with 0 HIGH and 0 MEDIUM; sole LOW corrected |

## Concrete Steps

- Run `npm test` and production audit in `companions/whatsapp` after each slice.
- Run `pwsh scripts/score-skill.ps1 -All -Json` and rubric behavior tests.
- Run `pwsh scripts/validate-skill.ps1`, framework tests, PSScriptAnalyzer, scrub, and `git diff --check`.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| WhatsApp Web is an unofficial automation surface | Session stability and support risk | Keep local-only, explicit documentation, fail closed, dedicated account recommendation | Mitigated |

## Validation and Acceptance

- [x] Self-chat native-device command executes exactly once via `message_create`
- [x] Default policy exposes read-only commands only; every mutation requires an unexpired nonce
- [x] Raw passthrough disabled by default; voice cannot authorize mutation
- [x] Browser sandbox is enabled by default
- [x] Config validation fails closed and notification targets are authorized
- [x] Runner bounds output, serializes commands, redacts secrets, detects CLI failure text, and supports shutdown
- [x] Watcher survives partial writes and watcher errors
- [x] Production dependency audit reports 0 HIGH/CRITICAL
- [x] WhatsApp tests meet at least 80% line coverage and cover security paths
- [x] Skill rubric emits dimension-level evidence, blocking findings, 0-100 score, tier, and JSON
- [x] All 130 skills are scored; validation enforces explicit minimums/floors without hidden parsing

## Idempotence and Recovery

All configuration migrations are backward-compatible except intentionally safer defaults. Tests use temporary directories and fake clients. If a slice fails, revert only that slice; no external WhatsApp login or live repository mutation is used during automated validation.

## Rollback Plan

Revert issue #402 commits. The existing companion remains isolated under `companions/whatsapp`; no persistent migration is required. Rubric validation can revert to the prior scorer without changing skill content.

## Artifacts and Notes

- Baseline WhatsApp tests: 7/7, but production audit fails with 2 HIGH advisories.
- Baseline skill scorer: 130 skills, average 31.1/40, exit 1.
- Independent WhatsApp review: CHANGES REQUESTED with 5 HIGH, 8 MEDIUM, 2 LOW findings.
- Hardened WhatsApp suite: 23/23 tests; lines 90.65%, branches 71.92%, functions 78.26%; 0 audit vulnerabilities.
- Skill rubric suite: 28/28 behavior assertions; all 130 skills score; 70.5 average; 0 universal blockers; 55 below the target remain visible as debt.
- Model Council: `docs/artifacts/adr/COUNCIL-skill-rubric-402.md` fixed weights, blockers, and rollout semantics.
- Review remediation: minimal child environment, strict real YAML parsing, agentskills.io name constraints, stocktake JSON migration, queued-job cancellation, timeout settlement, nonce collision handling, WebM filename correction, GitHub/Azure CI wiring, and bundled validator/rubric/YAML runtime.
- Final focused evidence: WhatsApp 23/23 with 90.65% lines, 71.92% branches, 78.26% functions, and zero audit findings; rubric 28/28; all-skill validation 130/130; trusted-base changed-skill comparison 15/15; framework and frontmatter clean; extension 1,013 tests with 82.40% statements, 75.25% branches, 80.86% functions, and 82.40% lines; Windows installed scorer and changed-skill gate pass; named 8.7.0 VSIX regenerated.

## Outcomes & Retrospective

The implementation replaced a permissive remote-control bot with a read-only-by-default, confirmation-gated companion and replaced the legacy 40-point scorer with a deterministic 100-point rubric. Multiple adversarial review rounds exposed distribution, YAML, CI, and lifecycle gaps; each was converted into executable regression coverage. Existing skill debt remains visible without making the current 130-skill inventory unshippable.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)
