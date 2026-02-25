#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to Node.js
# Usage: .\.agentx\agentx.ps1 ready
node "$PSScriptRoot/cli.mjs" @args
