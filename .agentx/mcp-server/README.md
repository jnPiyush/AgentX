# AgentX MCP Server

A Model Context Protocol (MCP) stdio server that exposes the AgentX CLI as first-class tools to any MCP host: GitHub Copilot CLI, Claude Desktop, Cursor, VS Code MCP, Continue, etc.

Instead of asking the model to type `pwsh .agentx/agentx-cli.ps1 loop start ...` into a terminal, the host calls `agentx_loop_start({ prompt: "..." })` as a structured tool. This makes the AgentX quality loop, ready queue, workflow phases, and ship pipeline reachable from chat in any compatible client.

## Tools Exposed

| Tool | Wraps | Purpose |
|------|-------|---------|
| `agentx_loop_start` | `loop start -p "<task>" [-i <issue>]` | Open the mandatory quality loop before any edit |
| `agentx_loop_iterate` | `loop iterate -s "..." [-e <evidence>]` | Record an iteration |
| `agentx_loop_complete` | `loop complete -s "..." [-e <evidence>]` | Close the loop (>=5 iterations + review pass) |
| `agentx_loop_status` | `loop status` | Report current loop state |
| `agentx_ready` | `ready` | Priority-sorted ready queue |
| `agentx_state` | `state [-a <agent>] [-s <status>] [-i <issue>]` | Show or update agent state |
| `agentx_deps` | `deps <issue>` | Check blockers |
| `agentx_workflow` | `workflow <agent>` | Print phase list for a role |
| `agentx_validate` | `validate <issue> <role>` | Validate handoff deliverables |
| `agentx_config_show` | `config show` | Show active configuration |
| `agentx_issue` | `issue <action> [args...]` | list / get / create / update / close / comment |
| `agentx_ship` | `ship -Issue <n>` | Autonomous fast-path for a single issue |
| `agentx_digest` | `digest` | Generate weekly digest of closed issues |
| `agentx_hook` | `hook <start\|finish> <agent> [issue]` | Record agent lifecycle hook (finish enforces loop gate) |
| `agentx_run` | `run -a <agent> -p "<task>" [-m <model>] [--max <n>] [-i <issue>]` | Run an agent through the agentic loop (LLM + tools) |
| `agentx_backlog_sync` | `backlog-sync [github] [--force]` | Sync local backlog to a remote provider |
| `agentx_config_set` | `config set <key> <value>` | Set an AgentX configuration value |
| `agentx_learn` | `learn [run\|status\|reset]` | Run pattern-discovery pipeline over recent sessions |
| `agentx_promote` | `promote [run\|status]` | Graduate stable discovered patterns into durable artifacts |

## Prerequisites

- Node.js >= 18 (for the MCP SDK)
- PowerShell 7.4+ (`pwsh` on PATH) -- required by AgentX itself
- An AgentX repo checkout (this server points at it via `AGENTX_REPO_ROOT` or auto-discovery)

## Install

From the AgentX repo root:

```bash
cd .agentx/mcp-server
npm install
```

Verify it starts:

```bash
node .agentx/mcp-server/index.js
# Expect on stderr: [agentx-mcp] ready (repo=<path>, tools=19)
# Then it blocks waiting for MCP requests on stdin. Ctrl+C to exit.
```

## Register with GitHub Copilot CLI

Add or merge into `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "agentx": {
      "command": "node",
      "args": ["<ABSOLUTE-PATH-TO-AGENTX>/.agentx/mcp-server/index.js"],
      "env": {
        "AGENTX_REPO_ROOT": "<ABSOLUTE-PATH-TO-AGENTX>"
      }
    }
  }
}
```

The Path 2 user-level installer can do this automatically:

```powershell
pwsh packs/agentx-copilot-cli/install-user.ps1 -RegisterMcp
```

```bash
bash packs/agentx-copilot-cli/install-user.sh --mcp
```

## Register with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agentx": {
      "command": "node",
      "args": ["<ABSOLUTE-PATH>/.agentx/mcp-server/index.js"],
      "env": { "AGENTX_REPO_ROOT": "<ABSOLUTE-PATH>" }
    }
  }
}
```

## Register with VS Code MCP

In workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "agentx": {
      "command": "node",
      "args": ["${workspaceFolder}/.agentx/mcp-server/index.js"],
      "env": { "AGENTX_REPO_ROOT": "${workspaceFolder}" }
    }
  }
}
```

## Usage From Chat

Once registered, the host's model can call tools directly:

> "Start the AgentX loop for the auth refactor on issue 42."

The model emits `agentx_loop_start({ prompt: "auth refactor", issue: 42 })`, AgentX returns the iteration plan, and the model proceeds with the work knowing the quality gate is open.

> "Show me what's unblocked."

-> `agentx_ready()` -> priority-sorted backlog.

> "Validate the engineer handoff on issue 42."

-> `agentx_validate({ issue: 42, role: 'engineer' })`.

## Design Notes

- **stdio transport**: stdout carries MCP JSON-RPC frames only; logs go to stderr.
- **Single process per host**: AgentX CLI invocations are spawned per tool call, so each call is hermetic.
- **No state leakage**: the server holds no mutable state -- AgentX's own `.agentx/state/` is the source of truth.
- **Failure mode**: a non-zero CLI exit returns `isError: true` with the stderr text, so the model can react.
- **Security**: tool inputs are passed as separate argv (never concatenated into a shell string), so shell metacharacters in summaries are safe.

## Limitations

- Long-running commands (e.g. `agentx_ship`) block the tool call until the CLI returns; hosts with short tool timeouts may cut them off. Prefer `agentx_loop_*` for fine-grained control.
- Interactive prompts in `agentx-cli.ps1` are not supported -- only non-interactive subcommands are exposed.
- The MCP server itself does not enforce the AgentX pre-edit gate; that enforcement lives in the hooks and pre-commit, exactly as in CLI-only flows.

## See Also

- [AGENTS.md](../../AGENTS.md) -- agent routing map
- [docs/WORKFLOW.md](../../docs/WORKFLOW.md) -- workflow contract
- [packs/agentx-copilot-cli/](../../packs/agentx-copilot-cli/) -- workspace + user-level pack installers
