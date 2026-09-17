# Frontier MCP Server

A Model Context Protocol (MCP) stdio server that exposes the Frontier CLI as first-class tools to any MCP host: GitHub Copilot CLI, Claude Desktop, Cursor, VS Code MCP, Continue, etc.

Instead of asking the model to type `pwsh .agentx/agentx-cli.ps1 loop start ...` into a terminal, the host calls `frontier_loop_start({ prompt: "..." })` as a structured tool. This makes the Frontier quality loop, ready queue, workflow phases, and ship pipeline reachable from chat in any compatible client.

## Tools Exposed

The server advertises 19 `frontier_*` tools. The legacy `agentx_*` names below
remain accepted aliases with the same arguments.

| Tool | Wraps | Purpose |
|------|-------|---------|
| `agentx_loop_start` | `loop start -p "<task>" [-i <issue>]` | Open the mandatory quality loop before any edit |
| `agentx_loop_iterate` | `loop iterate -s "..." [-e <evidence>]` | Record an iteration |
| `agentx_loop_complete` | `loop complete -s "..." [-e <evidence>]` | Close the loop (risk-based minimum 1/2/3/5 iterations, final approved reviewer verdict, zero HIGH/MEDIUM) |
| `agentx_loop_status` | `loop status` | Report current loop state |
| `agentx_ready` | `ready` | Priority-sorted ready queue |
| `agentx_state` | `state [-a <agent>] [-s <status>] [-i <issue>]` | Show or update agent state |
| `agentx_deps` | `deps <issue>` | Check blockers |
| `agentx_workflow` | `workflow <agent>` | Print phase list for a role |
| `agentx_validate` | `validate <issue> <role>` | Validate handoff deliverables |
| `agentx_config_show` | `config show` | Show active configuration |
| `agentx_issue` | `issue <action> [args...]` | list / get / create / update / close / comment |
| `agentx_ship` | `ship -Issue <n>` | Invoke the configured delivery pipeline; inspect its actual evidence and outcome |
| `agentx_digest` | `digest` | Generate weekly digest of closed issues |
| `agentx_hook` | `hook <start\|finish> <agent> [issue]` | Record agent lifecycle hook (finish enforces loop gate) |
| `agentx_run` | `run -a <agent> -p "<task>" [-m <model>] [--max <n>] [-i <issue>]` | Run an agent through the agentic loop (LLM + tools) |
| `agentx_backlog_sync` | `backlog-sync [github] [--force]` | Sync local backlog to a remote provider |
| `agentx_config_set` | `config set <key> <value>` | Set an Frontier configuration value |
| `agentx_learn` | `learn [run\|status\|reset]` | Run pattern-discovery pipeline over recent sessions |
| `agentx_promote` | `promote [run\|status]` | Graduate stable discovered patterns into durable artifacts |

## Prerequisites

- Node.js >= 18 (for the MCP SDK)
- PowerShell 7.4+ (`pwsh` on PATH) -- required by Frontier itself
- A Frontier repo checkout selected by `FRONTIER_REPO_ROOT`, `HVE_REPO_ROOT`, `AGENTX_REPO_ROOT`, or auto-discovery. An explicitly set invalid or empty root fails; it does not fall back to an ancestor repository.

## Install

From the Frontier repo root:

```bash
cd .agentx/mcp-server
npm install
```

Verify it starts:

```bash
node index.js
# Expect a ready message on stderr with the repository and 19 tools.
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
pwsh packs/frontier-copilot-cli/install-user.ps1 -RegisterMcp
```

```bash
bash packs/frontier-copilot-cli/install-user.sh --mcp
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

> "Start the Frontier loop for the auth refactor on issue 42."

The model emits `agentx_loop_start({ prompt: "auth refactor", issue: 42 })`, Frontier returns the iteration plan, and the model proceeds with the work knowing the quality gate is open.

> "Show me what's unblocked."

-> `agentx_ready()` -> priority-sorted backlog.

> "Validate the engineer handoff on issue 42."

-> `agentx_validate({ issue: 42, role: 'engineer' })`.

## Design Notes

- **stdio transport**: stdout carries MCP JSON-RPC frames only; logs go to stderr.
- **Serialized execution**: one CLI child runs at a time; concurrent calls are rejected.
- **Lifecycle state**: the server tracks its active child and cancellation. Durable Frontier state remains in the repository.
- **Failure mode**: a non-zero CLI exit returns `isError: true` with the stderr text, so the model can react.
- **Security**: tool inputs are passed as separate argv (never concatenated into a shell string), so shell metacharacters in summaries are safe.

## Limitations

- Commands have a ten-minute deadline and a combined 1 MiB stdout/stderr limit. MCP request cancellation and transport shutdown terminate the owned process tree. Termination waits for child closure with a bounded deadline; failure to confirm closure is an error and prevents another writer from starting. Host deadlines may be shorter.
- `npm test` checks lifecycle behavior and a mocked 19-tool smoke fixture. It does not execute a live model or certify every CLI tool end to end.
- Interactive prompts in `agentx-cli.ps1` are not supported -- only non-interactive subcommands are exposed.
- The MCP server itself does not enforce the Frontier pre-edit gate; that enforcement lives in the hooks and pre-commit, exactly as in CLI-only flows.

## See Also

- [AGENTS.md](../../AGENTS.md) -- agent routing map
- [docs/WORKFLOW.md](../../docs/WORKFLOW.md) -- workflow contract
- [packs/frontier-copilot-cli/](../../packs/frontier-copilot-cli/) -- workspace + user-level pack installers
