---
description: 'Compatibility plan for modernizing AgentX agents, skills, prompts, handoffs, hooks, and quality scoring.'
---

<!-- Inputs: issue 420, AgentX customization modernization, 2026-08-27, GitHub Copilot -->

# Execution Plan: Copilot-Native AgentX Customizations

**Author**: GitHub Copilot
**Date**: 2026-08-27
**Status**: Complete

## Purpose / Big Picture

Use native Copilot customization mechanisms where they provide stronger
enforcement or routing while preserving AgentX public paths, provider-neutral
workflow state, deterministic evidence, and specialist procedures.

## Progress

- [x] Inventory agents, skills, prompts, tools, and hooks
- [x] Create GitHub issue 420
- [x] Define compatibility and validation requirements
- [x] Restore regression tests after external workspace rewrite
- [x] Restore internal invocation, least privilege, handoffs, and hooks
- [x] Restore curated skill visibility
- [x] Add differentiation-aware skill scoring
- [x] Replace mutable model tables with capability-based guidance
- [x] Add and enforce the implementation code-quality rubric
- [x] Run post-fix aggregate and extension validation
- [x] Resolve release licensing review findings
- [x] Resolve final adversarial review findings
- [x] Receive independent 94/100 approval with zero HIGH/MEDIUM

## Surprises & Discoveries

- Observation: All internal agents were hidden from both users and parent agents.
  Evidence: `user-invocable: false` plus `disable-model-invocation: true`.
- Observation: Every agent had edit, command, and broad GitHub tools.
  Evidence: line-based frontmatter inventory.
- Observation: An external process rewrote earlier targets from `HEAD` at
  2026-08-28 18:00:48-49 while validation was running.
  Evidence: file timestamps and `git status`; later rubric/model edits survived.
- Observation: Validating the original review evidence path allowed that JSON to
  be rewritten after approval.
  Evidence: lifecycle regression reproduced the bypass; `loop complete` now
  validates the archived iteration copy and requires re-review after code changes.
- Observation: The first independent rubric review found six compatibility and
  scaffold defects that focused happy-path tests missed.
  Evidence: zero-copy lookup, placeholder identity, generated Python syntax,
  POSIX reads, and .NET setup guidance now have focused regression coverage.
- Observation: The second review found runtime behavior that syntax compilation
  could not detect and additional unresolved identity formats.
  Evidence: generated evaluation execution now asserts a dictionary, and shell,
  Windows, and template interpolation forms are parameterized negative cases.
- Observation: The third review demonstrated that archive paths alone are not
  immutable and that Git read commands can invoke configured helpers.
  Evidence: each iteration now stores an evidence digest that completion rechecks;
  external-diff and text-conversion options are blocked by policy regressions.
- Observation: Baselines and evaluator selection are also trust boundaries.
  Evidence: loop state binds baseline bytes, zero-copy uses the installed scorer,
  all history artifacts are rehashed, and resumed work has an explicit scope flag.
- Observation: Workspace path strings and nominal read commands are not identities.
  Evidence: protected-state hardlink aliases are enumerated, ambient Git terminal
  reads are denied, and standalone packs install the trusted hidden scorer path.
- Observation: Equivalent dot-segment paths also bypass literal state checks.
  Evidence: structured and terminal path candidates are canonicalized against the
  workspace before comparison with protected files and their aliases.
- Observation: VS Code discovered canonical workspace agents and extension-bundled
  contributions as separate native registrations in the AgentX source repository.
  Evidence: one installed extension contributed 26 agents while `.github/agents`
  exposed the same 26 files through the built-in workspace location.

## Alternatives Considered

1. Delete redundant paths immediately. Rejected because it breaks consumers.
2. Keep policy only in prose. Rejected because it is not deterministic.
3. Replace AgentX with the Copilot harness. Rejected because AgentX still owns
   cross-provider state, evidence, governance, and specialist contracts.
4. Add native mechanisms behind compatibility surfaces. Chosen.
5. Run a regex-only code scanner after each edit. Rejected because partial code
  and language-specific patterns create noisy, low-confidence failures.
6. Validate a structured rubric report at loop completion. Chosen because the
  independent reviewer can assess semantics while the CLI enforces freshness,
  exact changed-code scope, scoring floors, and docs-only exclusion.

## Decision Log

- Decision: Preserve every existing agent, skill, and prompt path.
  Options Considered: deletion, aliases, compatibility preservation.
  Chosen: compatibility preservation with curated visibility.
  Rationale: avoid breaking VS Code, CLI pack, and repository consumers.
  Date/Author: 2026-08-27 / GitHub Copilot.
- Decision: Apply least privilege by role capability.
  Options Considered: universal tools, strict read-only, role profiles.
  Chosen: role profiles.
  Rationale: reviewers need verification commands but not source edits.
  Date/Author: 2026-08-27 / GitHub Copilot.
- Decision: Reuse final independent-review evidence for code-quality scoring.
  Options Considered: advisory checklist, per-edit scanner, separate rubric
  review, structured final-review report.
  Chosen: structured final-review report validated by `loop complete`.
  Rationale: avoid duplicate reviews and enforce semantic quality only when
  implementation code changed after the loop baseline.
  Date/Author: 2026-08-29 / GitHub Copilot.
- Decision: Give the installed extension sole ownership of native agent
  registration in the AgentX source workspace.
  Options Considered: dynamic contribution removal, global workspace-agent
  suppression, source-workspace suppression.
  Chosen: set `.github/agents` to `false` in `chat.agentFilesLocations` only in
  this repository.
  Rationale: `contributes.chatAgents` is static, and global suppression could hide
  consumer-owned agents; VS Code settings do not affect Copilot CLI discovery.
  Date/Author: 2026-09-01 / GitHub Copilot.

## Context and Orientation

Canonical customizations live under `.github/agents`, `.github/skills`,
`.github/prompts`, and `.github/hooks`. The extension contributions are generated
by `vscode-extension/scripts/prepare-chat-contributions.js`. Frontmatter and skill
quality are validated by `scripts/validate-frontmatter.ps1` and
`scripts/score-skill.ps1`.

## Plan of Work

Restore behavior from regression tests, validate each slice, regenerate bundled
extension assets from canonical sources, then run repository-wide checks and an
independent review. Add a machine-validated code-quality rubric under
`evaluation/rubrics`, snapshot implementation changes at loop start, and require
the final independent-review evidence to pass that rubric before code-bearing
loops can complete.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Regression contracts | Engineer | Complete | 236/236 modernization checks before final review; distribution, terminal paths, and registration ownership covered |
| 2 | Agents and tools | Engineer | Complete | Hidden, callable, least privilege |
| 3 | Handoffs and hooks | Engineer | Complete | Additive native fields |
| 4 | Skill visibility | Engineer | Complete | All 133 existing paths preserved; no-ai-slop added as skill 134 |
| 5 | Implementation rubric | Engineer/Reviewer | Complete | Ten dimensions explicitly score requirements, design, logic, tests, security, reliability, maintainability, simplicity, performance, and operability |
| 6 | Distribution and review | Engineer/Reviewer | Complete | All installer, release, artifact, and independent-review gates passed |

## Concrete Steps

Run focused PowerShell tests after every slice. Run frontmatter, references,
tokens, inventory parity, packaging, and extension tests before review.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| GitHub MCP issue write returned EMU 403 | No MCP traceability | Created issue 420 with owner-authenticated `gh` | Resolved |
| External process rewrote earlier edits | Prior evidence stale | Restarted loop and restore from tests | Mitigated |
| Public MCP SDK transitively resolved a newly disclosed HIGH `fast-uri` advisory | Repository MCP runtime could not produce a clean HIGH-threshold audit | Pinned patched upstream commit `412e40a` through an HTTPS override; clean install, smoke, and audit pass; release creation now depends on MCP preflight | Resolved in #421 |

## Validation and Acceptance

- [x] Existing 26 agent, 133 skill, and 23 prompt paths remain; one new skill brings the total to 134
- [x] Internal agents are hidden but model-invocable
- [x] Analysis roles cannot edit source or mutate remote state
- [x] Main workflow agents expose native handoffs
- [x] Hook policy and CLI behavior agree
- [x] Background skills no longer compete in the slash menu
- [x] Skill scorer rewards differentiated value
- [x] Model guidance resolves mutable data at runtime
- [x] Source-workspace agents have one native registration owner
- [x] Code-bearing loops require a fresh, exact-scope rubric report
- [x] Docs-only loops skip the code-quality gate
- [x] Requirement fit and design conformance are independent blocking scores
- [x] First independent-review MEDIUM findings have focused regression coverage
- [x] Post-fix aggregate and extension validation pass
- [x] Manual VSIX embeds `jnPiyush.agentx@9.2.0` with required legal and rubric assets
- [x] Post-package framework and extension suites pass
- [x] Final independent review passes after release licensing fixes

## Idempotence and Recovery

Each slice is independently testable. Existing AgentX routing remains the
fallback when native fields are unsupported. Generated extension copies are
recreated from canonical sources.

## Rollback Plan

Restore the affected frontmatter or hook entry and rerun the focused contract.
No public path deletion or data migration is part of this change.

## Artifacts and Notes

- GitHub issue: https://github.com/jnPiyush/AgentX/issues/420
- First rubric review: 0 HIGH, 6 MEDIUM, 0 LOW; all MEDIUM findings resolved.
- Second rubric review: 0 HIGH, 2 MEDIUM, 1 LOW; all findings resolved.
- Third rubric review: 1 HIGH, 1 MEDIUM, 0 LOW; both findings resolved.
- Fourth rubric review: 3 HIGH, 3 MEDIUM, 0 LOW; trust-boundary findings resolved.
- Fifth rubric review: 2 HIGH, 2 MEDIUM, 0 LOW; alias, Git-helper, and pack-runtime findings resolved.
- Sixth rubric review: 1 HIGH, 0 MEDIUM, 0 LOW; canonical-path finding resolved.
- Final review: 0 HIGH, 0 MEDIUM, 0 LOW; implementation rubric 100/100.
- Pre-commit review: 1 HIGH, 1 MEDIUM, 1 LOW; wildcard protected-state,
  current README policy, and learning-count findings fixed; re-review pending.
- Post-fix review: 1 HIGH, 0 MEDIUM, 0 LOW; absolute structured wildcard
  extraction under workspace paths containing spaces fixed; re-review pending.
- Final security review: 1 HIGH, 2 MEDIUM, 0 LOW; ancestor selectors and live
  MCP iteration guidance fixed; re-review pending.
- Adversarial security review: 1 HIGH, 1 MEDIUM, 0 LOW; junction and dynamic
  PowerShell path findings fixed through semantic normalization; re-review pending.
- Final path-policy review: 1 HIGH, 1 MEDIUM, 0 LOW; computed destinations and
  raw-substring false positives fixed through AST path-argument analysis.
- Binding review: 1 HIGH, 2 MEDIUM, 0 LOW; cmdlet aliases, abbreviations,
  switches, destinations, redirections, qualified names, and structured-field
  matching fixed through trusted `CommandMetadata` binding.
- Release review: 1 HIGH, 1 MEDIUM, 2 LOW; active-loop opaque runtime access,
  MCP audit scoping, agent counts, and compiled e2e packaging fixed or bounded.
- Release licensing review: 1 HIGH, 2 MEDIUM, 2 LOW; Windows command-shell
  bypass, primary-installer legal files, and MCP archive licensing fixed and
  regression-tested; re-review pending.
- Final release review: 4 HIGH, 3 MEDIUM, 0 LOW; direct opaque runtime
  execution, completed-loop restart, consumer settings leakage, mixed-version
  upgrades, legal-file collisions, and landing claims fixed and regression-tested;
  re-review pending.
- Release re-review: 3 HIGH, 4 MEDIUM, 2 LOW; wrapped PowerShell execution-mode
  smuggling, workspace-pack legal collisions, preflight ordering, and probe
  compatibility fixed and regression-tested; re-review pending.
- Automated release creation now depends on extension coverage/audit and MCP
  clean-install/smoke/audit preflight, eliminating partial releases caused by
  post-creation validation failures.
- Focused evidence: modernization 236/236, rubric 33/33, scaffold 19/19,
  policy 154 passed with 1 skipped,
  no-ai-slop 41/41, inventory parity 27/27, loop parity 112/112, and
  pre-commit 41/41.
- Manual release candidate: `build/manual-publish/agentx-9.2.0.vsix`.
- VSIX identity: `jnPiyush.agentx@9.2.0`, 1,064 entries, 2,512,735 bytes.
- VSIX SHA-256: `d00d55eea7aad6d6bcbc98b3a220e74d342de1b6053cde1da1a7860d11663035`.
- Post-fix validation: framework 236/236; extension 1,044/1,044;
  coverage 82.45% statements/lines, 80.78% functions, 75.27% branches;
  changed skills 13/13; installer and upgrade behavior 41/41.

## Outcomes & Retrospective

Implementation, packaging, and review are complete. All existing public paths
remain, and the additive no-ai-slop skill brings the inventory to 134. The final
independent review approved the exact 15-file implementation scope at 94/100
with zero HIGH/MEDIUM findings. Commit, push, and remote workflow verification
remain as release disposition steps.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)