---
id: LEARNING-456
title: Native Frontier-HVE Capability Adoption Without Weakening Ownership Boundaries
description: Adopting Frontier-HVE provenance, deliverable templates, budgeted skill loadout, and R0-R7 recovery rules natively while preserving Frontier zero-copy and commit-consent contracts.
confidence: 0.6
observations: 1
status: draft
category: runtime-structure
subcategory: capability-adoption
phases: plan,implementation,verification,review
validation: reviewed
evidence: high
mode: shared
keywords: provenance,templates,recommend-skills,context-load,recovery-rules,frontier-hve
sources: REVIEW-frontier-hve-adapters-1007,EXEC-PLAN-frontier-hve-adoption
---

## Summary

On 2026-10-14, Frontier adopted five capabilities from `muralim-ai2/Frontier-HVE`
(`provenance`, `templates`, `recommend-skills`, `context-load`, and `R0`-`R7`
loop recovery rules plus `ModuleGuard`/`PrototypeGuard` in `scrub.ps1`) natively
in PowerShell and MCP without importing Python runtime copies or unguarded
workspace-export side effects.

## Guidance

- Preserve Frontier's zero-copy runtime and private workspace state (`Get-FrontierStateRoot`)
  when adopting reference harness tools; write session receipts (`provenance`,
  `skills-loadout.json`, `templates-registry.json`) under the resolved state root
  rather than hardcoding `.hve/` or `.frontier/` in the source tree.
- Keep `ModuleGuard` (>500 lines) and `PrototypeGuard` (>20 MB, non-enterprise
  SQLite/FalkorDB/Tesseract/ChromaDB) opt-in on `scripts/scrub.ps1` so existing
  production scrub gates do not break on legitimate large runtime scripts while
  making enterprise architecture checks available on demand.
- Ensure deliverable template initialization (`scripts/templates.ps1`) fails
  closed when either `frontier.templates.json` or the target output document
  already exists, and bind document validation to the exact LF-normalized
  SHA-256 of the source template.
- Update `vscode-extension/scripts/copy-assets.js`, `packs/frontier-core/manifest.json`,
  and `.frontier/runtime/install-manifest.json` together whenever new runtime
  scripts are added under `scripts/`.

## Evidence

- Verified `scripts/provenance.ps1`, `scripts/templates.ps1`, `scripts/recommend-skills.ps1`,
  `scripts/scrub.ps1`, `.frontier/runtime/frontier-cli.ps1`, and `.frontier/runtime/mcp-server/index.js`.
- Verified `loop preflight --json` and `install-manifest.ps1 -Action verify -Strict`.
