#!/usr/bin/env bash
# scan-secrets.sh - Scan repository for hardcoded secrets
#
# Usage: ./scan-secrets.sh [--path ./src] [--format table|json]

set -euo pipefail

PATH_TO_SCAN="."
FORMAT="table"

while [[ $# -gt 0 ]]; do
 case $1 in
 --path) PATH_TO_SCAN="$2"; shift 2 ;;
 --format) FORMAT="$2"; shift 2 ;;
 *) echo "Unknown option: $1"; exit 1 ;;
 esac
done

header() { echo -e "\n\033[36m=== $1 ===\033[0m"; }
pass_msg(){ echo -e " \033[32mPASS: $1\033[0m"; }
fail_msg(){ echo -e " \033[31mFAIL: $1\033[0m"; }

PATTERNS=(
 "CRITICAL|AWS Access Key|AKIA[0-9A-Z]{16}"
 "CRITICAL|GitHub Token|gh[pousr]_[A-Za-z0-9_]{36,}"
 "CRITICAL|Private Key|-----BEGIN (RSA |EC )?PRIVATE KEY-----"
 "CRITICAL|Stripe Key|(sk|pk)_(live|test)_[A-Za-z0-9]{24,}"
 "CRITICAL|Slack Token|xox[bpors]-[0-9]{10,}-[A-Za-z0-9]{10,}"
 "HIGH|Azure Connection|AccountKey=[A-Za-z0-9+/=]{44,}"
 "HIGH|Generic API Key|(api[_-]?key|apikey)\s*[=:]\s*['\"][A-Za-z0-9]{16,}['\"]"
 "HIGH|Generic Secret|(secret|password|passwd|pwd)\s*[=:]\s*['\"][^'\"]{8,}['\"]"
 "HIGH|JWT Token|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"
 "HIGH|Google API Key|AIza[0-9A-Za-z\-_]{35}"
)

EXCLUDE_DIRS="node_modules|\.git|bin|obj|__pycache__|\.venv|venv|dist|build"
EXTENSIONS="cs|py|js|ts|jsx|tsx|json|xml|yaml|yml|toml|ini|env|config|sh|ps1|md|html|razor|tf|hcl"

header "Secret Scanner"
echo " Scanning: $PATH_TO_SCAN"
echo " Patterns: ${#PATTERNS[@]} rules"

FINDINGS=0
CRITICAL=0

for entry in "${PATTERNS[@]}"; do
 IFS='|' read -r severity name pattern <<< "$entry"

 matches=$(grep -rn --include="*.{$EXTENSIONS}" -E "$pattern" "$PATH_TO_SCAN" \
 2>/dev/null | grep -vE "$EXCLUDE_DIRS" || true)

 if [[ -n "$matches" ]]; then
 count=$(echo "$matches" | wc -l)
 FINDINGS=$((FINDINGS + count))
 [[ "$severity" == "CRITICAL" ]] && CRITICAL=$((CRITICAL + count))

 if [[ "$FORMAT" == "table" ]]; then
 echo -e " \033[31m[$severity] $name ($count matches)\033[0m"
 echo "$matches" | head -5 | while read -r line; do
 truncated="${line:0:120}"
 echo " $truncated"
 done
 [[ $count -gt 5 ]] && echo " ... and $((count - 5)) more"
 fi
 fi
done

echo ""
if [[ $FINDINGS -eq 0 ]]; then
 pass_msg "No secrets detected"
 exit 0
else
 fail_msg "$FINDINGS potential secrets found (CRITICAL: $CRITICAL)"
 exit 1
fi
