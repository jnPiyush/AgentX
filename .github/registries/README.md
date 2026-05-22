# AgentX Machine Registries

Additive JSON sidecars that mirror the structured (non-prose) facts already encoded in
Markdown across the repo. Consumers (CLI, hooks, validators, CI) SHOULD read these
files instead of regex-parsing Markdown.

| File | Source of truth | Generated? | Purpose |
|------|-----------------|------------|---------|
| `skills.json` | `.github/skills/**/SKILL.md` (filesystem) | Yes -- `scripts/generate-registries.ps1` | Skill catalog; enables count validation and structured lookup |
| `templates.json` | `.github/templates/*.md` (filesystem + first-line scan) | Yes -- `scripts/generate-registries.ps1` | Template manifest with declared inputs |
| `routing.json` | `docs/WORKFLOW.md` routing rules | Hand-authored | Issue routing decisions for Agent X |
| `pipelines.json` | `AGENTS.md` Role Pipeline Reference table | Hand-authored | Per-role phase pipelines |

## Determinism Contract

These files are the **machine** representation of facts that ALSO live in Markdown.
The Markdown remains the human/LLM-facing source. JSON exists so:

1. Counts cannot drift (CI compares JSON length to documented counts).
2. Routing logic is testable without parsing prose tables.
3. Pipelines are queryable: `agentx workflow <role>` can return structured JSON.
4. Templates declare inputs mechanically (no more invisible drift).

## Rules

- **Additive only**: nothing in this directory removes or replaces Markdown content.
- **Generated files** MUST be regenerated when the underlying filesystem changes. Run:

  ```powershell
  pwsh -File scripts/generate-registries.ps1
  ```

- **Hand-authored files** (`routing.json`, `pipelines.json`) are updated alongside the
  Markdown they mirror. CI may later validate drift.

## Schema

All files include `$schemaVersion` (currently `1`) and `generated` (ISO timestamp for
generated files; `null` for hand-authored).
