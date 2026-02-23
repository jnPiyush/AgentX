# AgentX Packs

Packs are distributable bundles of AgentX artifacts (agents, instructions, skills, templates, workflows) that can be selectively installed into any project.

## What is a Pack?

A pack is a `manifest.json` file that declares which artifacts belong together. Packs enable:

- **Modular distribution** -- install only what you need
- **Versioned bundles** -- track which version of each pack is installed
- **Dependency management** -- packs can depend on other packs
- **Selective updates** -- update one pack without affecting others

## Pack Structure

```
packs/
  agentx-core/
    manifest.json     # Core SDLC agents + instructions + workflows
  agentx-ai/
    manifest.json     # AI/ML specific agents + skills (future)
  agentx-cloud/
    manifest.json     # Cloud infrastructure skills (future)
```

## Manifest Schema

Each pack has a `manifest.json` validated against `.github/schemas/pack-manifest.schema.json`.

```json
{
  "name": "agentx-core",
  "version": "5.4.0",
  "description": "Core SDLC agents and workflow engine.",
  "maturity": "stable",
  "tags": ["sdlc", "orchestration"],
  "artifacts": {
    "agents": [".github/agents/agent-x.agent.md", "..."],
    "instructions": [".github/instructions/ai.instructions.md", "..."],
    "templates": [".github/templates/PRD-TEMPLATE.md", "..."],
    "workflows": [".agentx/workflows/epic.toml", "..."],
    "scripts": [".agentx/agentx.ps1", "..."]
  },
  "dependencies": []
}
```

## Maturity Levels

| Level | Meaning |
|-------|---------|
| `stable` | Production-ready, fully tested |
| `preview` | Feature-complete, undergoing validation |
| `experimental` | Early development, may change |
| `deprecated` | Scheduled for removal |

## Available Packs

| Pack | Description | Maturity |
|------|-------------|----------|
| `agentx-core` | Full SDLC agents, workflow engine, instructions | stable |

## Future Packs (Planned)

| Pack | Description | Status |
|------|-------------|--------|
| `agentx-ai` | AI agent development, RAG, evaluation skills | Planned |
| `agentx-cloud` | Azure/AWS/GCP infrastructure skills | Planned |
| `agentx-security` | Security scanning and compliance skills | Planned |
| `agentx-data` | Data pipeline and analytics skills | Planned |
