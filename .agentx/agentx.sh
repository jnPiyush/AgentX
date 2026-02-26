#!/bin/bash
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: ./.agentx/agentx.sh ready
pwsh "$(dirname "$0")/agentx-cli.ps1" "$@"
