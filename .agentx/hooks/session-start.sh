#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TRACE_DIR="$ROOT/.frontier/state"
TRACE_FILE="$TRACE_DIR/hook-trace.jsonl"

trace() {
  mkdir -p "$TRACE_DIR"
  printf '{"timestamp":"%s","hook":"session-start","status":"%s","detail":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$TRACE_FILE"
}

CLI="$ROOT/.agentx/agentx.sh"
if [ ! -f "$CLI" ]; then
  trace skipped "Frontier CLI wrapper not found."
  exit 0
fi

ISSUE=${FRONTIER_ISSUE:-${HVE_ISSUE:-${AGENTX_ISSUE:-}}}
PROMPT=${FRONTIER_TASK:-${HVE_TASK:-${AGENTX_TASK:-}}}
if [ -z "$ISSUE" ] || [ -z "$PROMPT" ]; then
  trace skipped "FRONTIER_ISSUE or FRONTIER_TASK was not provided."
  exit 0
fi

"$CLI" loop start -p "$PROMPT" -i "$ISSUE"
trace invoked "Started loop for issue $ISSUE."