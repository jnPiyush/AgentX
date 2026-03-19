# LEARNING-234: Publish Plugins As Packages, Keep Packs As Bundles

**Date**: 2026-03-18
**Issue**: #234
**Category**: Architecture
**Status**: Curated

## Context

AgentX already had enough plugin primitives to support a real platform, but the discovery and publication path was still tied to the main repo archive. The key design question was whether to keep that model, move fully to npm-style publication, or define an AgentX-native package and registry contract.

## Learning

The best near-term shape is:

- Keep `agentx-core` as the host/runtime contract
- Publish plugins as independent versioned packages
- Use a registry index plus release artifacts for discovery and download
- Preserve final installation in workspace `.agentx/plugins`
- Keep packs as curated bundles that reference plugin coordinates instead of replacing plugins

## Why It Matters

- It matches the runtime AgentX already has, including PowerShell and Bash plugins
- It adds the missing identity, compatibility, and trust layers without forcing a Node-only model
- It creates a direct path to enterprise mirrors, allowlists, and richer policy later

## Reuse Guidance

- When designing new AgentX extensibility surfaces, prefer deterministic package metadata over AI-mediated or implicit discovery behavior
- Treat compatibility and trust as first-class platform contracts, not optional metadata
- Use bundle abstractions only after the unit package contract is stable and independently manageable

## Supporting Artifacts

- `docs/artifacts/adr/ADR-234.md`
- `docs/artifacts/specs/SPEC-234.md`
- `.agentx/handoffs/handoff-234-architect-to-engineer.json`