#!/bin/bash
# AgentX Plugin: convert-docs
# Convert Markdown documents to Microsoft Word (DOCX) using Pandoc.
#
# Usage:
#   ./.agentx/plugins/convert-docs/convert-docs.sh [folders] [--template path]
#
# Examples:
#   ./.agentx/plugins/convert-docs/convert-docs.sh
#   ./.agentx/plugins/convert-docs/convert-docs.sh "docs/prd,docs/specs"
#   ./.agentx/plugins/convert-docs/convert-docs.sh --template templates/style.docx

set -e

FOLDERS="${1:-docs/prd,docs/adr,docs/specs,docs/ux,docs/reviews}"
TEMPLATE=""
OUTPUT_DIR=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --template) TEMPLATE="$2"; shift 2 ;;
    --output)   OUTPUT_DIR="$2"; shift 2 ;;
    *)          FOLDERS="$1"; shift ;;
  esac
done

# Check pandoc
if ! command -v pandoc &> /dev/null; then
  echo "[FAIL] Pandoc not found."
  echo "  Install: brew install pandoc (macOS)"
  echo "  Or: sudo apt-get install pandoc (Ubuntu/Debian)"
  echo "  Or: https://pandoc.org/installing.html"
  exit 1
fi

echo "[convert-docs] Pandoc: $(pandoc --version | head -1)"

IFS=',' read -ra FOLDER_LIST <<< "$FOLDERS"

total=0
errors=0

for folder in "${FOLDER_LIST[@]}"; do
  folder=$(echo "$folder" | xargs) # trim whitespace
  [ ! -d "$folder" ] && echo "[SKIP] $folder (not found)" && continue

  files=$(find "$folder" -maxdepth 1 -name "*.md" -type f 2>/dev/null)
  [ -z "$files" ] && echo "[SKIP] $folder (no .md files)" && continue

  count=$(echo "$files" | wc -l | xargs)
  echo ""
  echo "  $folder ($count files)"

  echo "$files" | while read -r file; do
    basename_noext=$(basename "$file" .md)
    out_dir="${OUTPUT_DIR:-$(dirname "$file")}"
    mkdir -p "$out_dir"
    output="$out_dir/${basename_noext}.docx"

    pandoc_args=("$file" "-o" "$output" "--toc" "--standalone")
    [ -n "$TEMPLATE" ] && [ -f "$TEMPLATE" ] && pandoc_args+=("--reference-doc" "$TEMPLATE")

    if pandoc "${pandoc_args[@]}" 2>/dev/null; then
      size=$(du -k "$output" | cut -f1)
      echo "  [PASS] $(basename "$file") -> ${basename_noext}.docx (${size} KB)"
      ((total++)) || true
    else
      echo "  [FAIL] $(basename "$file")"
      ((errors++)) || true
    fi
  done
done

echo ""
[ "$total" -gt 0 ] && echo "[convert-docs] Converted $total files"
[ "$errors" -gt 0 ] && echo "[convert-docs] $errors errors"
[ "$total" -eq 0 ] && [ "$errors" -eq 0 ] && echo "[convert-docs] No Markdown files found"
