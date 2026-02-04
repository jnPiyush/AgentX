#!/bin/bash
# Local Issue Manager for AgentX (Bash version)
# Provides GitHub-like issue management without requiring a repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTX_DIR="$(dirname "$SCRIPT_DIR")"
ISSUES_DIR="$AGENTX_DIR/.agentx/issues"
CONFIG_FILE="$AGENTX_DIR/.agentx/config.json"

# Ensure directories exist
mkdir -p "$ISSUES_DIR"

# Initialize config if not exists
if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" <<EOF
{
  "mode": "local",
  "nextIssueNumber": 1,
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
fi

get_next_issue_number() {
    local current=$(jq -r '.nextIssueNumber' "$CONFIG_FILE")
    jq --arg next "$((current + 1))" '.nextIssueNumber = ($next | tonumber)' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
    mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    echo "$current"
}

create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"
    
    local number=$(get_next_issue_number)
    local issue_file="$ISSUES_DIR/$number.json"
    
    cat > "$issue_file" <<EOF
{
  "number": $number,
  "title": "$title",
  "body": "$body",
  "labels": [$labels],
  "status": "Backlog",
  "state": "open",
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "comments": []
}
EOF
    
    echo "Created issue #$number: $title"
}

list_issues() {
    echo -e "\nLocal Issues:"
    echo "═══════════════════════════════════════════════════════════"
    
    for file in "$ISSUES_DIR"/*.json; do
        [ -f "$file" ] || continue
        
        local number=$(jq -r '.number' "$file")
        local title=$(jq -r '.title' "$file")
        local status=$(jq -r '.status' "$file")
        local state=$(jq -r '.state' "$file")
        local labels=$(jq -r '.labels | join(", ")' "$file")
        
        local state_icon="○"
        [ "$state" = "closed" ] && state_icon="●"
        
        echo "$state_icon #$number $status - $title"
        [ -n "$labels" ] && [ "$labels" != "" ] && echo "  Labels: $labels"
    done
    
    echo "═══════════════════════════════════════════════════════════"
}

# Parse arguments
ACTION="${1:-list}"
shift || true

case "$ACTION" in
    create)
        TITLE="$1"
        BODY="${2:-}"
        LABELS="${3:-}"
        create_issue "$TITLE" "$BODY" "$LABELS"
        ;;
    list)
        list_issues
        ;;
    *)
        echo "Usage: $0 {create|list} [args...]"
        exit 1
        ;;
esac
