#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TRACE_DIR="$ROOT/.agentx/state"
TRACE_FILE="$TRACE_DIR/hook-trace.jsonl"

trace() {
  mkdir -p "$TRACE_DIR"
  printf '{"timestamp":"%s","hook":"session-start","status":"%s","detail":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$TRACE_FILE"
}

CLI="$ROOT/.agentx/agentx.sh"
if [ ! -f "$CLI" ]; then
  trace skipped "AgentX CLI wrapper not found."
  exit 0
fi

ISSUE=${AGENTX_ISSUE:-}
PROMPT=${AGENTX_TASK:-}
if [ -z "$ISSUE" ] || [ -z "$PROMPT" ]; then
  trace skipped "AGENTX_ISSUE or AGENTX_TASK was not provided."
  exit 0
fi

"$CLI" loop start -p "$PROMPT" -i "$ISSUE"
trace invoked "Started loop for issue $ISSUE."