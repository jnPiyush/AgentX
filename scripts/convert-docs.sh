#!/bin/bash
# Convert Markdown documents to DOCX using Pandoc
# Usage: ./convert-docs.sh [folders...]

set -e

FOLDERS=("docs/prd" "docs/adr" "docs/specs" "docs/ux" "docs/reviews")
[ $# -gt 0 ] && FOLDERS=("$@")

# Check pandoc
if ! command -v pandoc &> /dev/null; then
 echo "Pandoc not found. Install: brew install pandoc (or apt-get/yum)"
 exit 1
fi

echo "Converting Markdown to DOCX..."

count=0
for folder in "${FOLDERS[@]}"; do
 [ ! -d "$folder" ] && continue

 find "$folder" -maxdepth 1 -name "*.md" -type f | while read -r file; do
 output="${file%.md}.docx"
 if pandoc "$file" -o "$output" --toc 2>/dev/null; then
 echo "[PASS] $(basename "$file")"
 ((count++))
 fi
 done
done

echo -e "\nConverted files"
