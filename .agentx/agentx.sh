#!/bin/bash
# Deprecated compatibility launcher. Use ./.agentx/frontier.sh.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/frontier.sh" "$@"
