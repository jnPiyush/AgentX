---
title: Frontier-HVE Structural Adoption and Capability Parity
description: Adopt Frontier-HVE provenance verification, configured deliverable templates, budgeted skill loadout, context-load diagnostics, and deterministic R0-R7 loop recovery rules while preserving Frontier zero-copy and security contracts.
---

# Execution Plan: Frontier-HVE Structural Adoption and Capability Parity

**Author**: Frontier Engineering FDE
**Date**: 2026-10-14
**Issue**: #456
**Status**: In Progress

---

## Purpose / Big Picture

The user requested adopting the architectural approach, structure, and missing capabilities from `muralim-ai2/Frontier-HVE` into Frontier (`AgentX`) while optimizing code and repository structure.

After this work:
1. **Session Provenance Verification (`frontier provenance` / `scripts/provenance.ps1`)**: Operators and CI can inspect which declared harness components (`loop`, `context`, `skills`, `templates`, `stage-gates`, `hooks`) left verifiable evidence for a session or workspace, persist `<state>/provenance/<session>.provenance.json`, and fail closed when `--require <components>` is not satisfied.
2. **Configured Deliverable Templates (`frontier templates` / `scripts/templates.ps1`)**: Teams can run `frontier templates configure` to create a non-overwriting `frontier.templates.json`, `frontier templates init <type> --slug <slug>` to initialize PRD, ADR, Tech Spec, or Test Strategy deliverables with exact-byte SHA-256 template provenance (`<!-- frontier-template: ... -->`, `<!-- frontier-document: ... -->`), and `frontier templates validate` / `check` to verify provenance, required sections, and unfilled placeholders before handoff.
3. **Budgeted Skill Loadout & Context-Load Guardrail (`frontier recommend-skills` / `scripts/recommend-skills.ps1` and `frontier tokens context-load`)**: Prompts can rank skills from `.github/registries/skills.json` and `scripts/score-skill.ps1` within a strict 10-skill / 2,000-token loadout budget, and inspect full request context-load share, top contributors, duplicate skills, and unmeasured skills.
4. **Module-Size (`>500` LOC) & Prototype Enterprise Guardrails (`scripts/scrub.ps1`)**: Scrub surfaces `module-size` advisories for code files exceeding 500 lines and `prototype-guardrail` advisories when a prototype/codebase exceeds 5,000 LOC or references non-enterprise local components (SQLite, FalkorDB, Tesseract, ChromaDB) that need licensed Azure/enterprise equivalents.
5. **Deterministic Attempt-Ledger Recovery Rules (`R0`-`R7`)**: Failed loop iterations classify the failure into rules `R0` through `R7` (new error, repeated error with same files, repeated error twice, repeated tool failure, retrieval misses, baseline-identical failure, environment error, second rule firing) and display deterministic recovery guidance.
6. **Offering Plugin Architecture (`frontier plugin` / `scripts/plugins.ps1` + `.github/schemas/frontier-plugin.schema.json`)**:
   - **Data-Only Offering Contract**: Accepts `frontier-plugin.json` and `hve-plugin.json` (`apiVersion: 1`); enforces Markdown/JSON/license-only content (rejects hooks, scripts, symlinks, case collisions, undeclared assets, and agent tools outside manifest `tools`).
   - **Global Store & Lifecycle**: Manages `<FRONTIER_PLUGIN_HOME>/plugins/<id>/<version>/` and atomic `plugins.json` with exclusive locking (`validate`, `inspect`, `install --confirm <sha256>`, `list`, `enable`, `disable`, `uninstall`, `reconcile`, `pack` into reproducible `.frontierplugin` archives with `SHA256SUMS`, `init` author kit, `test` routing suite, `resolve` prompt router, and `requirements` workspace check).
   - **Core Skill & Template Integration**: `scripts/recommend-skills.ps1` routes prompts across enabled plugins (`core-only`, `selected`, `select-plugin` multi-match gate, or `missing-plugin` stop) and merges selected plugin skills into the loadout budget; `scripts/templates.ps1` resolves `plugin:<plugin>/<kind>@<version>` and `<plugin>:<kind>` deliverables.

## Progress

- [x] Reviewed `muralim-ai2/Frontier-HVE` repository structure, wiki docs (`Install.md`, `Agents.md`, `Templates.md`, `Evaluation.md`, `Skills.md`, `Adapters.md`), and local `REVIEW-frontier-hve-adapters-1007.md`
- [x] Started quality loop (`#456`) and drafted execution plan
- [x] Implement `scripts/provenance.ps1`
- [x] Implement `scripts/templates.ps1`
- [x] Implement `scripts/recommend-skills.ps1` and `context-load` action
- [x] Extend `scripts/scrub.ps1` and `.frontier/runtime/frontier-cli.ps1` (`R0`-`R7` recovery + CLI subcommands)
- [x] Wire MCP tools, `copy-assets.js`, pack manifests, and regression tests
- [x] Run non-test preflight, independent review, and complete quality loop
- [x] Reviewed `feature/plugin-architecture` (PR #8 on `muralim-ai2/Frontier-HVE`)
- [x] Implement `.github/schemas/frontier-plugin.schema.json` and `scripts/plugins.ps1`
- [x] Integrate plugin routing and plugin templates into `scripts/recommend-skills.ps1` and `scripts/templates.ps1`
- [x] Create `examples/plugins/oracle-offering` reference plugin package and `tests/plugin-architecture.test.cjs`

## Decision Log

- **Decision**: Preserve Frontier's zero-copy runtime, private workspace state binding, and explicit commit consent instead of importing Frontier-HVE's `.hve/runtime/` copy model or `git add -A` auto-commits.
  - **Options Considered**:
    1. Wholesale copy of Frontier-HVE Python scripts and `.hve/runtime/` workspace copies.
    2. Native PowerShell/Node modules under `scripts/` and `.frontier/runtime/` exposed via `frontier-cli.ps1` and MCP tools, respecting `REVIEW-frontier-hve-adapters-1007.md` security findings.
    3. Documentation-only comparison without executable tools.
  - **Chosen**: Option 2.
  - **Rationale**: `REVIEW-frontier-hve-adapters-1007.md` identified two HIGH findings and one MEDIUM finding in Frontier-HVE's raw exporter/loop scripts (overwriting user files, unprotected `.hve/runtime` guards, and `git add -A` staging unrelated user work). Option 2 delivers all high-value Frontier-HVE features natively inside Frontier's governed runtime with zero new external dependencies.

## Validation

- Syntax and static verification: `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 loop preflight --json`
- Provenance check: `pwsh -NoProfile -File scripts/provenance.ps1 -Json`
- Template lifecycle check: `pwsh -NoProfile -File scripts/templates.ps1 -Action list -Json`
- Skill recommendation & context load: `pwsh -NoProfile -File scripts/recommend-skills.ps1 -Prompt "implement API and review code" -Json`
- Scrub module-size & prototype guardrails: `pwsh -NoProfile -File scripts/scrub.ps1 -Path vscode-extension/scripts/copy-assets.js`
- Asset bundle and manifest parity: `node vscode-extension/scripts/copy-assets.js` and `pwsh -NoProfile -File scripts/install-manifest.ps1 -Action verify -Strict`

## Idempotence and Recovery

- All new commands (`provenance`, `templates`, `recommend-skills`) are safe to re-run and never overwrite user-authored files (`templates configure` and `templates init` fail closed if the target file already exists).
- If any check fails during verification, fix the target script, re-sync `copy-assets.js` and `install-manifest.ps1`, and re-run `loop preflight --json`.
- **R0-R7 Recovery Escape Hatch**:
  - `R0` (New error): Fix the reported failure directly; if a second attempt fails on the same files (`R1`) or `R0` actions do not resolve an unclassified failure, pause autonomous retries and ask the user for clarification.
  - `R1` / `R5` / `R7` (Circular retry on same files, baseline-identical failure, or any recovery rule firing a second time) or 5+ failed attempts: Mandatory escalation boundary (`escalate = true`); stop retrying and ask the human before continuing.
  - `R2` (Same error twice across different edits): Delegate to a fresh sub-agent or evaluate parallel options.
  - `R3` (3+ tool/command failures): Switch tool approach or inspect CLI flags.
  - `R4` (2+ retrieval misses): Query the repository code graph (`frontier context`) and supply exact file paths.
  - `R6` (Environment/dependency error): Apply the documented environment remedy in `AGENTS.md` or escalate to the user.

