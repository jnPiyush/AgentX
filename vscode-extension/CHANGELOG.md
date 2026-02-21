# Changelog

## 5.3.0 - 2026-02-21

### Added

- Customer Coach agent for consulting research
- UX Methodology instructions for structured design phases
- Auto-release workflow with semantic versioning
- Copilot Coding Agent setup workflow
- Shared PowerShell modules (CIHelpers, SecurityHelpers)
- Agent Delegation protocol
- Pack Bundle System for modular artifact distribution

## 5.2.6 - 2026-02-19

## 5.2.5 - 2026-02-18

- **Fix**: Cross-platform CLI argument formatting -- bash receives positional args, PowerShell receives named params
- **Fix**: `/workflow` and `/deps` slash commands now work on macOS/Linux (bash)
- **Add**: `run` subcommand in `agentx.sh` for feature parity with `agentx.ps1`

## 5.2.0 - 2026-02-18

- **Nested folder support**: auto-detect AgentX root up to 2 levels deep in subfolders
- **Multi-root workspace**: searches all workspace folders, not just the first
- **New settings**: `agentx.rootPath` (explicit override), `agentx.searchDepth` (0-5)
- **FileSystemWatcher**: auto-discovers AgentX when `AGENTS.md` appears in subfolders
- **Initialize**: folder picker for multi-root workspaces
- **Refresh**: invalidates root cache and re-checks initialization state
- **Activation events**: `workspaceContains:**/AGENTS.md` for nested detection

## 5.1.0 -- Initial Release

- **Initialize Project** command with 5 install profiles
- **Agent Status** sidebar view with all 8 agents
- **Ready Queue** sidebar with priority-sorted work
- **Workflows** sidebar with 7 TOML workflow templates
- **Run Workflow** command for pipeline execution
- **Check Dependencies** command for issue validation
- **Generate Digest** command for weekly summaries
- GitHub Mode and Local Mode support
- Status bar integration
- Full settings configuration
