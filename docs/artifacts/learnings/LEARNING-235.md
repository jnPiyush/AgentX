# LEARNING-235: Keep AI Evaluation As An AgentX Evidence Layer, Not A Product Identity Swap

**Date**: 2026-03-20
**Issue**: #235
**Category**: Architecture
**Status**: Curated

## Context

AgentX already had strong AI-evaluation ideas scattered across skills, Data Scientist and Engineer role contracts, hidden evaluation-specialist guidance, and workflow-quality extension surfaces. The open question was how to absorb the strongest parts of promptfoo without making AgentX merely a wrapper around promptfoo.

## Learning

The best near-term shape is:

- Keep AgentX as the workflow and evidence host
- Introduce one repo-local AI evaluation contract for `needs:ai` work
- Normalize reports so different runners can feed one reviewer and Quality-surface experience
- Support promptfoo-compatible and Azure AI Evaluation-compatible execution paths behind that contract
- Keep workflow maturity scoring and AI quality scoring as adjacent but distinct signals

## Why It Matters

- It preserves AgentX's role-aware workflow model instead of outsourcing product identity to one tool
- It makes Data Scientist, Engineer, and Reviewer ownership explicit and operational
- It keeps local-first, CI-based, and Azure-native evaluation paths open at the same time

## Reuse Guidance

- When importing strong ideas from an external AI tool, adopt the durable contract and evidence pattern, not the product identity wholesale
- Keep evaluation manifests and normalized reports owned by AgentX even when execution is delegated to external runners
- Separate workflow maturity evidence from AI response-quality evidence so review decisions remain legible

## Supporting Artifacts

- `docs/artifacts/adr/ADR-235.md`
- `docs/artifacts/specs/SPEC-235.md`
- Retired architecture execution detail:
  `git show 7fd090a4:docs/execution/plans/EXEC-PLAN-235-ai-eval-architecture.md`