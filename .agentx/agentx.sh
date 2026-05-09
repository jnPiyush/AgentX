#!/bin/bash
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: ./.agentx/agentx.sh ready
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "$AGENTX_WORKSPACE_ROOT" ] || [ ! -d "$AGENTX_WORKSPACE_ROOT" ]; then
  export AGENTX_WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$AGENTX_WORKSPACE_ROOT" || exit 1
pwsh "$SCRIPT_DIR/agentx-cli.ps1" "$@"
