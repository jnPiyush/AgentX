#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TRACE_DIR="$ROOT/.frontier/state"
TRACE_FILE="$TRACE_DIR/hook-trace.jsonl"

trace() {
  mkdir -p "$TRACE_DIR"
  printf '{"timestamp":"%s","hook":"session-end","status":"%s","detail":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$TRACE_FILE"
}

SUMMARY=${FRONTIER_FINAL_SUMMARY:-${HVE_FINAL_SUMMARY:-${AGENTX_FINAL_SUMMARY:-}}}
EVIDENCE=${FRONTIER_EVIDENCE:-${HVE_EVIDENCE:-${AGENTX_EVIDENCE:-}}}
PASSING=${FRONTIER_PASSING_TESTS:-${HVE_PASSING_TESTS:-${AGENTX_PASSING_TESTS:-}}}
if [ -z "$SUMMARY" ] || [ -z "$EVIDENCE" ]; then
  trace skipped "Final summary or evidence was not provided."
  exit 0
fi

CLI="$ROOT/.agentx/agentx.sh"
if [ ! -f "$CLI" ]; then
  trace skipped "Frontier CLI wrapper not found."
  exit 0
fi

if [ -n "$PASSING" ]; then
  "$CLI" loop complete -s "$SUMMARY" -e "$EVIDENCE" --passing "$PASSING"
else
  "$CLI" loop complete -s "$SUMMARY" -e "$EVIDENCE"
fi
trace invoked "Completed loop."