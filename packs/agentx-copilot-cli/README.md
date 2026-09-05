# AgentX Copilot CLI Pack

> **Standalone distribution** for GitHub Copilot CLI. Separate from the VS Code extension and the core AgentX installation.

## What This Pack Provides

| Artifact | Count | Description |
|----------|-------|-------------|
| Agents | 26 | 15 external + 11 internal sub-agents |
| Skills | 134 | Complete production code standards across 14 categories |
| Instructions | 15 | Auto-applied coding guidelines by file pattern (7 top-level + 8 nested ADO) |
| Prompts | 23 | Reusable prompt templates |
| Templates | 15 | PRD, ADR, Spec, UX, Review, Arch Review, Security Plan, Progress, Roadmap, Exec Plan, Contract, Evidence Summary, Backlog, Design System, Learning |
| Schemas | 7 | Frontmatter, handoff, pack and plugin manifest schemas |
| Hooks | 1 | Copilot CLI lifecycle hook configuration plus its handler |
| CLI Utilities | 4 | Optional `.agentx/` wrappers backed by a bundled hidden runtime |

## Installation Options

AgentX supports two Copilot CLI installation paths.

### Option 1 -- Native Copilot CLI plugin (recommended)

The repository root ships a `plugin.json`, so Copilot CLI can install AgentX's
agents, skills and hooks directly:

```bash
copilot plugin install jnPiyush/AgentX
copilot plugin list
```

This registers all 26 agents and 134 skills for every session without copying
anything into your workspace.

> Direct repository, URL and local-path installs are deprecated by GitHub in
> favour of marketplace installs. Use Option 2 for a workspace-local copy.

### Option 2 -- Workspace install script

Use this when you want AgentX committed to (or vendored in) a specific
workspace.

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
    agents/                    # 26 agent definitions
      agent-x.agent.md
      engineer.agent.md
      ...
      internal/
        github-ops.agent.md
        ...
    skills/                    # 134 skills across 14 categories
      architecture/
      development/
      languages/
      ...
    instructions/              # 7 instruction files
      ai.instructions.md
      python.instructions.md
      ...
    prompts/                   # 23 prompt templates
      prd-gen.prompt.md
      code-review.prompt.md
      ...
    templates/                 # 15 document templates
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
# Run a specific AgentX agent
copilot --agent engineer -p "Implement a health endpoint following the engineer guidelines"

# Pick an agent interactively
copilot
/agent

# List the skills Copilot discovered
copilot
/skills list
```

## How This Differs from the VS Code Extension

| Capability | VS Code Extension | Copilot CLI |
|------------|-------------------|-------------|
| Agent orchestration | Hub-and-spoke via subagents | Supported via Copilot CLI subagents (`/agent`, delegation) |
| Agent sidebar | Tree view with status | Not available |
| Interactive chat | Chat participant (`@agentx`) | Not available -- use `copilot` sessions |
| Quality loop | Layer 1 (sidebar) + Layer 2 (body) + Layer 3 (CLI) | Layer 2 (body) + Layer 3 (CLI) + lifecycle hooks |
| Skills & Instructions | Auto-loaded by file pattern | Auto-loaded by file pattern |
| Prompt templates | Available in chat | Not executed by Copilot CLI -- use skills or agents |
| CLI utilities | Built-in commands | Optional wrappers + bundled runtime (--include-cli) |
| Memory system | Git-backed observation store | Not available |

### Known Limitations

- **No sidebar or tree views**: those surfaces are VS Code only.
- **Prompt files are not executed**: Copilot CLI has no prompt-file mechanism.
  The prompts are installed as reference templates; use agents or skills when
  you need executable behaviour.
- **Layer 1 enforcement differs**: the CLI relies on lifecycle hooks
  (`.github/hooks/copilot-hooks.json`) plus the loop CLI gate rather than
  sidebar prompts.

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
- Version: `9.2.0`
- Publisher: jnPiyush
- License: Apache-2.0
- Third-party notices: See `NOTICE`, including the MIT-licensed
  `petergyang/no-ai-slop` adaptation.
- User-level installs place AgentX legal files under
  `~/.copilot/agentx-legal` so they do not replace unrelated legal files.

---

**See Also**: [AGENTS.md](../../AGENTS.md) | [Skills.md](../../Skills.md) | [docs/WORKFLOW.md](../../docs/WORKFLOW.md)
