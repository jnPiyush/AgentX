# Changelog
## 6.5.1 - 2026-02-25

### Fixed

- Agent sidebar empty on Windows: frontmatter regex now handles CRLF line endings so all 9 agents appear
- Upgrade/reinstall not updating framework files: `copyDirRecursive` now overwrites existing files during upgrade
- Version tracking preserves original `installedAt` timestamp on upgrade instead of resetting it
- Runtime `version.json` now writes the correct extension version (was stuck at 5.5.0)
## 5.5.0 - 2026-02-23

### Fixed

- Reliable VS Code extension detection using `vscode.extensions.getExtension()` API instead of unreliable `code --list-extensions` CLI
- Dependency install polling -- terminal-based installs now wait for tools to become available before proceeding

### Changed

- Extension checker falls back to CLI only when API is unavailable
- External tool install flow shows cancellable progress notification while polling

## 6.5.0 - 2026-02-25

### Added

- Plugin system: manifest schema, PluginManager, VS Code commands (List/Run/Create Plugin)
- First plugin: convert-docs (Markdown to DOCX via Pandoc, now Node.js)
- Auto-merge AgentX entries into user .gitignore during initialization
- Unified Node.js CLI (cli.mjs) replacing PowerShell + Bash dual scripts

### Changed

- CLI migrated from PowerShell/Bash to single Node.js file (-4,530 lines)
- Plugin scaffold generates .mjs entry points instead of PS1/SH
- PluginManager prefers Node.js entry, falls back to shell
- Numbered agent names (0-8) for ordered dropdown display

### Testing

- 208 unit tests passing (18 new plugin tests)

## 6.1.0 - 2026-02-24

### Added

- Typed Event Bus with 11 event types for centralized agent activity notifications
- Structured Thinking Log writing to VS Code Output Channel with queryable entries
- Context Compaction with token budget tracking and conversation summarization
- Channel Abstraction with Router for multi-surface message routing (vsc, cli, gh)
- Cron Task Scheduler with zero-dependency cron parser and disk persistence
- New commands: Show Thinking Log, Show Context Budget, List Scheduled Tasks

### Changed

- AgentXContext accepts optional eventBus, thinkingLog, and contextCompactor services
- Extension activation initializes all new services with proper disposal on deactivate
- VS Code mock expanded with clear(), append(), hide() on output channels

### Testing

- 60 new unit tests across all 5 features (190 total, 0 failing)

## 6.0.0 - 2026-02-22

### Added

- Critical pre-check with auto-install for missing required dependencies
- PowerShell shell fallback (`pwsh` -> `powershell.exe`) for Windows compatibility
- Pre-flight Copilot extension check before initialization
- Modal blocking dialog for dependency install during initialization
- Re-check flow after dependency installation
- 12 new unit tests for pre-check scenarios
- Expanded VS Code mock with `withProgress`, `createTerminal`, `extensions` stubs

### Changed

- Startup check auto-offers install instead of dismissable warning
- `execShell()` uses auto-detected shell instead of hardcoded `pwsh`

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
