---
name: 'Doc Gardener'
description: 'Check documentation drift, reconcile current claims and links, and consolidate superseded material without erasing useful history.'
agent: 'AgentX Auto'
---

# Doc Gardener

## Mandatory trigger

Run after implementing every feature, user story or bug, including config-only
changes, and before independent review. Also run before releases and after
changing agents, skills, instructions, templates or prompts.

## Workflow

1. Run `.agentx/agentx.ps1 doc-drift check -Json`. Use the same deterministic
   checker as CI; do not maintain a second count script. Instructions are counted
   recursively, including nested domain rules.
2. Review the change against owning README/API/CLI/configuration/operations docs,
   examples, inventories, navigation and plan/progress status.
3. Update affected docs or explain why no reader-facing contract changed.
   Passing counts and links does not prove semantic correctness.
4. Classify stale documents before removal: current guidance, durable decisions,
   completed execution state, generated mirrors or accidental runtime snapshots.
   Preserve historical ADR/PRD/spec/review evidence. Remove transient duplicates
   only after checking incoming links and packaging/test dependencies.
5. Regenerate extension mirrors from their sources and re-run the checker.
6. Include `documentationReview` in the existing quality report: updated/no-impact
   status, specific rationale and current hashes of the documents reviewed.

## Output

- Structural check result and actual count/version mismatches
- Documentation-impact decision with file/section evidence
- Exact updated, retained and removed paths with retention rationale
- Unresolved drift or unavailable checks, never a fabricated PASS

Follow [documentation maintenance](../../docs/guides/DOCUMENTATION-MAINTENANCE.md).
