#!/bin/bash
# Local Issue Manager for AgentX (Bash version)
# Provides GitHub-like issue management without requiring a repository
# Feature parity with local-issue-manager.ps1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTX_DIR="$(dirname "$SCRIPT_DIR")"
ISSUES_DIR="$AGENTX_DIR/.agentx/issues"
CONFIG_FILE="$AGENTX_DIR/.agentx/config.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m'

# Valid statuses
VALID_STATUSES=("Backlog" "In Progress" "In Review" "Ready" "Done")

# Ensure jq is available
if ! command -v jq &> /dev/null; then
 echo -e "${YELLOW}Error: jq is required but not installed.${NC}"
 echo "Install: sudo apt-get install jq OR brew install jq"
 exit 1
fi

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

# --- Helper Functions ---

get_next_issue_number() {
 local current
 current=$(jq -r '.nextIssueNumber' "$CONFIG_FILE")
 jq --argjson next "$((current + 1))" '.nextIssueNumber = $next' "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
 mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
 echo "$current"
}

validate_status() {
 local status="$1"
 for valid in "${VALID_STATUSES[@]}"; do
 if [ "$valid" = "$status" ]; then
 return 0
 fi
 done
 echo -e "${YELLOW}Error: Invalid status '$status'${NC}"
 echo "Valid statuses: ${VALID_STATUSES[*]}"
 return 1
}

get_issue_file() {
 echo "$ISSUES_DIR/$1.json"
}

issue_exists() {
 local file
 file=$(get_issue_file "$1")
 [ -f "$file" ]
}

status_color() {
 case "$1" in
 "Backlog") echo "$GRAY" ;;
 "In Progress") echo "$YELLOW" ;;
 "In Review") echo "$MAGENTA" ;;
 "Ready") echo "$CYAN" ;;
 "Done") echo "$GREEN" ;;
 *) echo "$NC" ;;
 esac
}

# --- Action Functions ---

create_issue() {
 local title="$1"
 local body="${2:-}"
 local labels="${3:-}"

 if [ -z "$title" ]; then
 echo -e "${YELLOW}Error: Title is required for creating an issue${NC}"
 exit 1
 fi

 local number
 number=$(get_next_issue_number)
 local issue_file
 issue_file=$(get_issue_file "$number")

 # Build labels JSON array
 local labels_json="[]"
 if [ -n "$labels" ]; then
 labels_json=$(echo "$labels" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
 fi

 jq -n \
 --argjson number "$number" \
 --arg title "$title" \
 --arg body "$body" \
 --argjson labels "$labels_json" \
 --arg created "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
 '{
 number: $number,
 title: $title,
 body: $body,
 labels: $labels,
 status: "Backlog",
 state: "open",
 created: $created,
 updated: $created,
 comments: []
 }' > "$issue_file"

 echo -e "${GREEN}Created issue #${number}: $title${NC}"
}

update_issue() {
 local number="$1"
 local title="${2:-}"
 local status="${3:-}"
 local labels="${4:-}"
 local body="${5:-}"

 if [ -z "$number" ]; then
 echo -e "${YELLOW}Error: Issue number is required${NC}"
 exit 1
 fi

 if ! issue_exists "$number"; then
 echo -e "${YELLOW}Error: Issue #${number} not found${NC}"
 exit 1
 fi

 local issue_file
 issue_file=$(get_issue_file "$number")

 # Validate status if provided
 if [ -n "$status" ]; then
 validate_status "$status" || exit 1
 fi

 # Apply updates using temporary file
 local tmp_file="${issue_file}.tmp"
 cp "$issue_file" "$tmp_file"

 if [ -n "$title" ]; then
 jq --arg v "$title" '.title = $v' "$tmp_file" > "${tmp_file}2" && mv "${tmp_file}2" "$tmp_file"
 fi
 if [ -n "$status" ]; then
 jq --arg v "$status" '.status = $v' "$tmp_file" > "${tmp_file}2" && mv "${tmp_file}2" "$tmp_file"
 fi
 if [ -n "$body" ]; then
 jq --arg v "$body" '.body = $v' "$tmp_file" > "${tmp_file}2" && mv "${tmp_file}2" "$tmp_file"
 fi
 if [ -n "$labels" ]; then
 local labels_json
 labels_json=$(echo "$labels" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | jq -R . | jq -s .)
 jq --argjson v "$labels_json" '.labels = $v' "$tmp_file" > "${tmp_file}2" && mv "${tmp_file}2" "$tmp_file"
 fi

 jq --arg v "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '.updated = $v' "$tmp_file" > "${tmp_file}2" && mv "${tmp_file}2" "$tmp_file"
 mv "$tmp_file" "$issue_file"

 echo -e "${GREEN}Updated issue #${number}${NC}"
}

close_issue() {
 local number="$1"

 if [ -z "$number" ]; then
 echo -e "${YELLOW}Error: Issue number is required${NC}"
 exit 1
 fi

 if ! issue_exists "$number"; then
 echo -e "${YELLOW}Error: Issue #${number} not found${NC}"
 exit 1
 fi

 local issue_file
 issue_file=$(get_issue_file "$number")

 jq --arg updated "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
 '.state = "closed" | .status = "Done" | .updated = $updated' \
 "$issue_file" > "${issue_file}.tmp" && mv "${issue_file}.tmp" "$issue_file"

 echo -e "${GREEN}Closed issue #${number}${NC}"
}

get_issue() {
 local number="$1"

 if [ -z "$number" ]; then
 echo -e "${YELLOW}Error: Issue number is required${NC}"
 exit 1
 fi

 if ! issue_exists "$number"; then
 echo -e "${YELLOW}Error: Issue #${number} not found${NC}"
 exit 1
 fi

 local issue_file
 issue_file=$(get_issue_file "$number")
 jq . "$issue_file"
}

add_comment() {
 local number="$1"
 local comment_body="$2"

 if [ -z "$number" ] || [ -z "$comment_body" ]; then
 echo -e "${YELLOW}Error: Issue number and comment are required${NC}"
 exit 1
 fi

 if ! issue_exists "$number"; then
 echo -e "${YELLOW}Error: Issue #${number} not found${NC}"
 exit 1
 fi

 local issue_file
 issue_file=$(get_issue_file "$number")

 jq --arg body "$comment_body" \
 --arg created "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
 '.comments += [{ body: $body, created: $created }] | .updated = $created' \
 "$issue_file" > "${issue_file}.tmp" && mv "${issue_file}.tmp" "$issue_file"

 echo -e "${GREEN}Added comment to issue #${number}${NC}"
}

list_issues() {
 local has_issues=false

 echo ""
 echo -e "${CYAN}Local Issues:${NC}"
 echo "==========================================================="

 for file in "$ISSUES_DIR"/*.json; do
 [ -f "$file" ] || continue
 has_issues=true

 local number title status state labels
 number=$(jq -r '.number' "$file")
 title=$(jq -r '.title' "$file")
 status=$(jq -r '.status' "$file")
 state=$(jq -r '.state' "$file")
 labels=$(jq -r '.labels | if length > 0 then " [" + join(", ") + "]" else "" end' "$file")

 local state_icon="( )"
 [ "$state" = "closed" ] && state_icon="(*)"

 local color
 color=$(status_color "$status")
 echo -e "${state_icon} #${number} ${color}${status}${NC} - ${title}${labels}"
 done

 if [ "$has_issues" = false ]; then
 echo -e "${YELLOW}No issues found${NC}"
 fi

 echo "==========================================================="
}

# --- Usage ---

show_usage() {
 echo ""
 echo "AgentX Local Issue Manager"
 echo ""
 echo "Usage: $0 <action> [options]"
 echo ""
 echo "Actions:"
 echo " create <title> [body] [labels] Create a new issue"
 echo " update <number> [options] Update an issue"
 echo " close <number> Close an issue"
 echo " get <number> Get issue details (JSON)"
 echo " comment <number> <comment> Add a comment"
 echo " list List all issues"
 echo ""
 echo "Update options (positional):"
 echo " update <number> <title> <status> [labels] [body]"
 echo ""
 echo "Valid statuses: Backlog, In Progress, In Review, Ready, Done"
 echo ""
 echo "Examples:"
 echo " $0 create \"[Story] Add login\" \"\" \"type:story\""
 echo " $0 update 1 \"\" \"In Progress\""
 echo " $0 comment 1 \"Started implementation\""
 echo " $0 close 1"
 echo " $0 get 1"
 echo " $0 list"
}

# --- Main ---

ACTION="${1:-list}"
shift 2>/dev/null || true

case "$ACTION" in
 create)
 create_issue "$1" "$2" "$3"
 ;;
 update)
 update_issue "$1" "$2" "$3" "$4" "$5"
 ;;
 close)
 close_issue "$1"
 ;;
 get)
 get_issue "$1"
 ;;
 comment)
 add_comment "$1" "$2"
 ;;
 list)
 list_issues
 ;;
 -h|--help|help)
 show_usage
 ;;
 *)
 echo -e "${YELLOW}Unknown action: $ACTION${NC}"
 show_usage
 exit 1
 ;;
esac
