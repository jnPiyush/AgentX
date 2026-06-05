#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TRACE_DIR="$ROOT/.agentx/state"
TRACE_FILE="$TRACE_DIR/hook-trace.jsonl"

trace() {
  mkdir -p "$TRACE_DIR"
  printf '{"timestamp":"%s","hook":"post-tool","status":"%s","detail":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$TRACE_FILE"
}

SUMMARY=${AGENTX_ITERATION_SUMMARY:-}
EVIDENCE=${AGENTX_EVIDENCE:-}
PASSING=${AGENTX_PASSING_TESTS:-}
if [ -z "$SUMMARY" ] || [ -z "$EVIDENCE" ]; then
  trace skipped "Iteration summary or evidence was not provided."
  exit 0
fi

CLI="$ROOT/.agentx/agentx.sh"
if [ ! -f "$CLI" ]; then
  trace skipped "AgentX CLI wrapper not found."
  exit 0
fi

if [ -n "$PASSING" ]; then
  "$CLI" loop iterate -s "$SUMMARY" -e "$EVIDENCE" --passing "$PASSING"
else
  "$CLI" loop iterate -s "$SUMMARY" -e "$EVIDENCE"
fi
trace invoked "Recorded loop iteration."