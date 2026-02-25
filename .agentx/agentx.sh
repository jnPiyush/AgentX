#!/bin/bash
# AgentX CLI launcher - delegates to Node.js
# Usage: ./.agentx/agentx.sh ready
node "$(dirname "$0")/cli.mjs" "$@"
