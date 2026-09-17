#!/bin/bash
# Frontier CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: ./.agentx/frontier.sh ready
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="${FRONTIER_WORKSPACE_ROOT:-${HVE_WORKSPACE_ROOT:-${AGENTX_WORKSPACE_ROOT:-}}}"
if [ -z "$WORKSPACE_ROOT" ] || [ ! -d "$WORKSPACE_ROOT" ]; then
  WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
export FRONTIER_WORKSPACE_ROOT="$WORKSPACE_ROOT"
export AGENTX_WORKSPACE_ROOT="$WORKSPACE_ROOT"
cd "$WORKSPACE_ROOT" || exit 1
pwsh "$SCRIPT_DIR/agentx-cli.ps1" "$@"