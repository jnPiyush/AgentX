# AgentX Copilot CLI Plugin

> **Standalone plugin** for GitHub Copilot CLI. Separate from the VS Code extension and the core AgentX installation.

## What This Plugin Provides

| Artifact | Count | Description |
|----------|-------|-------------|
| Agents | 21 | 13 external + 8 internal sub-agents |
| Skills | 69 | Production code standards across 10 categories |
| Instructions | 7 | Auto-applied coding guidelines by file pattern |
| Prompts | 20 | Reusable prompt templates |
| Templates | 10 | PRD, ADR, Spec, UX, Review, Security, Progress, Exec Plan, Contract, Evidence Summary |
| CLI Utilities | 4 | Optional `.agentx/` wrappers backed by a bundled hidden runtime |

## Installation

### PowerShell (Windows / macOS / Linux)

```powershell
# Clone AgentX repo
git clone https://github.com/jnpiyush/AgentX.git

# Install into your workspace (current directory)
pwsh AgentX/packs/agentx-copilot-cli/install.ps1

# Install into a specific workspace
pwsh AgentX/packs/agentx-copilot-cli/install.ps1 -Target /path/to/my-project

# Include CLI utilities (workspace wrappers + bundled runtime)
pwsh AgentX/packs/agentx-copilot-cli/install.ps1 -IncludeCli

# Preview without copying
pwsh AgentX/packs/agentx-copilot-cli/install.ps1 -WhatIf

# Force overwrite existing files
pwsh AgentX/packs/agentx-copilot-cli/install.ps1 -Force
```

### Bash (macOS / Linux)

```bash
# Clone AgentX repo
git clone https://github.com/jnpiyush/AgentX.git

# Install into your workspace (current directory)
bash AgentX/packs/agentx-copilot-cli/install.sh

# Install into a specific workspace
bash AgentX/packs/agentx-copilot-cli/install.sh -t /path/to/my-project

# Include CLI utilities (workspace wrappers + bundled runtime)
bash AgentX/packs/agentx-copilot-cli/install.sh -c

# Preview without copying
bash AgentX/packs/agentx-copilot-cli/install.sh -n

# Force overwrite
bash AgentX/packs/agentx-copilot-cli/install.sh -f
```

## What Gets Installed

After installation, your workspace will contain:

```
your-project/
  .github/
    agents/                    # 21 agent definitions
      agent-x.agent.md
      engineer.agent.md
      ...
      internal/
        github-ops.agent.md
        ...
    skills/                    # 69 skills across 10 categories
      architecture/
      development/
      languages/
      ...
    instructions/              # 7 instruction files
      ai.instructions.md
      python.instructions.md
      ...
    prompts/                   # 20 prompt templates
      prd-gen.prompt.md
      code-review.prompt.md
      ...
    templates/                 # 8 document templates
    schemas/                   # Validation schemas
    .agentx-cli-plugin.json   # Version stamp
    agentx/
      .agentx/                 # Hidden bundled CLI runtime (only if --include-cli / -c)
        agentx.ps1
        agentx.sh
        agentx-cli.ps1
        agentic-runner.ps1
        local-issue-manager.ps1
        local-issue-manager.sh
  AGENTS.md                    # Agent routing map
  Skills.md                    # Skills index
  docs/
    WORKFLOW.md                # Workflow reference
  .agentx/                     # Only if --include-cli / -c
    agentx.ps1                 # Workspace wrapper -> bundled runtime
    agentx.sh                  # Workspace wrapper -> bundled runtime
    local-issue-manager.ps1    # Workspace wrapper -> bundled runtime
    local-issue-manager.sh     # Workspace wrapper -> bundled runtime
    config.json                # Local CLI state
    version.json               # Local CLI version stamp
    state/
    digests/
    sessions/
  memories/                    # Starter memory files (only if --include-cli / -c)
```

When you install with `--include-cli` or `-c`, the plugin seeds a complete local runtime shape: workspace state lives under `.agentx/`, while the executable implementation is bundled under `.github/agentx/.agentx/`. The visible `.agentx/*` scripts are stable launchers that set `AGENTX_WORKSPACE_ROOT` and delegate into that bundled runtime.

## Usage with Copilot CLI

Once installed, agent definitions and skills are available in your Copilot CLI sessions:

```bash
# Copilot CLI automatically reads .github/ for context
gh copilot suggest "implement a health endpoint following the engineer agent guidelines"

# Use prompts as templates
gh copilot suggest "review this PR using the code-review prompt template"
```

## How This Differs from the VS Code Extension

| Capability | VS Code Extension | CLI Plugin |
|------------|-------------------|------------|
| Agent orchestration (Mode 1) | Hub-and-spoke via runSubagent | Not available -- agents run standalone |
| Agent sidebar | Tree view with status | Not available |
| Interactive chat | Chat participant (@agentx) | Not available -- use gh copilot |
| Quality loop | Layer 1 (sidebar) + Layer 2 (body) + Layer 3 (CLI) | Layer 2 (body) + Layer 3 (CLI) |
| Skills & Instructions | Auto-loaded by file pattern | Auto-loaded by file pattern |
| Prompt templates | Available in chat | Available as copilot context |
| CLI utilities | Built-in commands | Optional wrappers + bundled runtime (--include-cli) |
| Memory system | Git-backed observation store | Not available |

### Known Limitations (GAP-19)

- **No `runSubagent`**: Copilot CLI does not support agent-to-agent delegation. Agent X acts as a reference document, not an orchestrator.
- **No Mode 1**: The hub-and-spoke pattern only works in VS Code with Copilot Chat's `runSubagent` capability.
- **Standalone agents**: Each agent runs independently. Multi-agent workflows require manual handoffs.

## Updating

To update to a newer version:

```powershell
# PowerShell -- force overwrites existing files
pwsh AgentX/packs/agentx-copilot-cli/install.ps1 -Force

# Bash
bash AgentX/packs/agentx-copilot-cli/install.sh -f
```

## Uninstalling

Remove the installed directories from your workspace:

```bash
rm -rf .github/agents .github/skills .github/instructions .github/prompts
rm -rf .github/templates .github/schemas .github/.agentx-cli-plugin.json
rm -rf .github/agentx
rm -f AGENTS.md Skills.md docs/WORKFLOW.md
rm -rf .agentx  # if CLI utilities were installed
rm -rf memories  # if starter memories were installed with CLI utilities
```

## Version

- Plugin: `agentx-copilot-cli`
- Version: `8.4.24`
- Publisher: jnPiyush
- License: MIT

---

**See Also**: [AGENTS.md](../../AGENTS.md) | [Skills.md](../../Skills.md) | [docs/WORKFLOW.md](../../docs/WORKFLOW.md)
