#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TRACE_DIR="$ROOT/.agentx/state"
TRACE_FILE="$TRACE_DIR/hook-trace.jsonl"

trace() {
  mkdir -p "$TRACE_DIR"
  printf '{"timestamp":"%s","hook":"pre-tool","status":"%s","detail":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$TRACE_FILE"
}

TARGET=${AGENTX_CHANGED_PATH:-}
if [ -z "$TARGET" ]; then
  trace skipped "AGENTX_CHANGED_PATH was not provided."
  exit 0
fi

SCRUB="$ROOT/scripts/scrub.ps1"
if [ -f "$SCRUB" ]; then
  pwsh "$SCRUB" -Path "$TARGET"
  trace invoked "Scrub passed for $TARGET."
  exit 0
fi

# Zero-copy runtime: the workspace has no scripts/ tree. Delegate to the agentx
# CLI launcher, which resolves the bundled scrub.ps1 from the installed extension.
CLI="$ROOT/.agentx/agentx.sh"
if [ -f "$CLI" ]; then
  sh "$CLI" scrub -Path "$TARGET"
  trace invoked "Scrub passed for $TARGET (via agentx CLI)."
  exit 0
fi

trace skipped "scrub.ps1 not found (no workspace copy or agentx CLI launcher)."
exit 0