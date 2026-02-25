#!/usr/bin/env bash
# AgentX CLI - Lightweight task orchestration utilities
# Subcommands: ready, state, deps, digest, workflow, run, hook, version, upgrade
#
# Usage:
# ./.agentx/agentx.sh ready # Show unblocked work
# ./.agentx/agentx.sh state # Show agent states
# ./.agentx/agentx.sh state engineer working 42 # Set agent state
# ./.agentx/agentx.sh deps 42 # Check dependencies
# ./.agentx/agentx.sh digest # Generate weekly digest
# ./.agentx/agentx.sh workflow feature # Show workflow steps
# ./.agentx/agentx.sh run feature 42 # Execute workflow for issue
# ./.agentx/agentx.sh version # Show version info
# ./.agentx/agentx.sh upgrade # Smart upgrade

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTX_ROOT="$(dirname "$SCRIPT_DIR")"
AGENTX_DIR="$AGENTX_ROOT/.agentx"
STATE_FILE="$AGENTX_DIR/state/agent-status.json"
ISSUES_DIR="$AGENTX_DIR/issues"
WORKFLOWS_DIR="$AGENTX_DIR/workflows"
DIGESTS_DIR="$AGENTX_DIR/digests"
CONFIG_FILE="$AGENTX_DIR/config.json"

# Detect mode
MODE="local"
if [[ -f "$CONFIG_FILE" ]] && command -v jq &>/dev/null; then
 MODE=$(jq -r '.mode // "local"' "$CONFIG_FILE")
fi

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; GRAY='\033[0;90m'; WHITE='\033[1;37m'
NC='\033[0m'

# --- Helpers ----------------------------------------------------------

ensure_dir() { mkdir -p "$1" 2>/dev/null; }

check_jq() {
 if ! command -v jq &>/dev/null; then
 echo -e "${RED}Error: jq is required. Install: brew install jq / apt install jq${NC}"
 exit 1
 fi
}

get_priority() {
 local file="$1"
 local labels
 labels=$(jq -r '.labels[]? // empty' "$file" 2>/dev/null | grep 'priority:p' | head -1)
 if [[ "$labels" =~ priority:p([0-9]) ]]; then
 echo "${BASH_REMATCH[1]}"
 else
 echo "9"
 fi
}

get_type() {
 local file="$1"
 local labels
 labels=$(jq -r '.labels[]? // empty' "$file" 2>/dev/null | grep 'type:' | head -1)
 if [[ "$labels" =~ type:(.+) ]]; then
 echo "${BASH_REMATCH[1]}"
 else
 echo "story"
 fi
}

# --- READY: Show unblocked work --------------------------------------

cmd_ready() {
 check_jq

 local ready_items=()

 if [[ "$MODE" == "github" ]]; then
 # GitHub mode: fetch issues via gh CLI
 local gh_issues
 gh_issues=$(gh issue list --state open --json number,title,labels,body --limit 200 2>/dev/null) || {
 echo -e "${YELLOW}Warning: gh CLI failed - falling back to local issues${NC}"
 MODE="local"
 }
 if [[ "$MODE" == "github" ]]; then
 local count
 count=$(echo "$gh_issues" | jq 'length')
 for i in $(seq 0 $((count - 1))); do
 local num title body
 num=$(echo "$gh_issues" | jq -r ".[$i].number")
 title=$(echo "$gh_issues" | jq -r ".[$i].title")
 body=$(echo "$gh_issues" | jq -r ".[$i].body // \"\"")

 # Check blockers
 local blocked=false
 local blocked_by
 blocked_by=$(echo "$body" | grep -oP '(?<=Blocked[- ]by:\s).*' || true)
 if [[ -n "$blocked_by" ]]; then
 for bid in $(echo "$blocked_by" | grep -oP '#\d+' | tr -d '#'); do
 local bstate
 bstate=$(gh issue view "$bid" --json state -q '.state' 2>/dev/null || echo "open")
 if [[ "$bstate" != "CLOSED" && "$bstate" != "closed" ]]; then
 blocked=true; break
 fi
 done
 fi

 if [[ "$blocked" == "false" ]]; then
 local pri="9" type="story"
 local label_list
 label_list=$(echo "$gh_issues" | jq -r ".[$i].labels[].name" 2>/dev/null || true)
 for lbl in $label_list; do
 [[ "$lbl" =~ priority:p([0-9]) ]] && pri="${BASH_REMATCH[1]}"
 [[ "$lbl" =~ type:(.+) ]] && type="${BASH_REMATCH[1]}"
 done
 ready_items+=("$pri|$num|$type|$title")
 fi
 done
 fi
 fi

 if [[ "$MODE" == "local" ]]; then
 if [[ ! -d "$ISSUES_DIR" ]]; then
 echo -e "${YELLOW}No issues found.${NC}"
 return
 fi

 for file in "$ISSUES_DIR"/*.json; do
 [[ -f "$file" ]] || continue
 local state status
 state=$(jq -r '.state // "open"' "$file")
 status=$(jq -r '.status // ""' "$file")

 if [[ "$state" == "open" && "$status" == "Ready" ]]; then
 local blocked=false
 local blockers
 blockers=$(jq -r '.body // ""' "$file" | grep -oP '(?<=Blocked[- ]by:\s).*' || true)
 if [[ -n "$blockers" ]]; then
 for bid in $(echo "$blockers" | grep -oP '#\d+' | tr -d '#'); do
 local blocker_file="$ISSUES_DIR/$bid.json"
 if [[ -f "$blocker_file" ]]; then
 local bstate
 bstate=$(jq -r '.state // "open"' "$blocker_file")
 if [[ "$bstate" == "open" ]]; then
 blocked=true; break
 fi
 fi
 done
 fi

 if [[ "$blocked" == "false" ]]; then
 local pri num title type
 pri=$(get_priority "$file")
 num=$(jq -r '.number' "$file")
 title=$(jq -r '.title' "$file")
 type=$(get_type "$file")
 ready_items+=("$pri|$num|$type|$title")
 fi
 fi
 done
 fi

 if [[ ${#ready_items[@]} -eq 0 ]]; then
 echo -e "${YELLOW}No ready work found.${NC}"
 return
 fi

 # Sort by priority
 IFS=$'\n' sorted=($(sort <<<"${ready_items[*]}")); unset IFS

 echo -e "\n ${CYAN}Ready Work (unblocked, sorted by priority):${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 for item in "${sorted[@]}"; do
 IFS='|' read -r pri num type title <<< "$item"
 local pri_label="P$pri"
 [[ "$pri" == "9" ]] && pri_label=" "
 local color=$WHITE
 case $pri in 0) color=$RED;; 1) color=$YELLOW;; esac
 echo -e " ${color}[$pri_label]${NC} ${CYAN}#$num${NC} ${GRAY}($type)${NC} $title"
 done
 echo ""
}

# --- STATE: Agent status tracking -------------------------------------

cmd_state() {
 check_jq
 ensure_dir "$(dirname "$STATE_FILE")"

 local agent="${1:-}"
 local new_state="${2:-}"
 local issue="${3:-}"

 if [[ -n "$agent" && -n "$new_state" ]]; then
 # Update state
 local ts
 ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
 local issue_val="null"
 [[ -n "$issue" ]] && issue_val="$issue"

 if [[ ! -f "$STATE_FILE" ]]; then
 echo '{}' > "$STATE_FILE"
 fi

 jq --arg a "$agent" --arg s "$new_state" --arg t "$ts" --argjson i "$issue_val" \
 '.[$a] = { status: $s, issue: $i, lastActivity: $t }' \
 "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

 echo -e " ${GREEN}Agent '$agent' -> $new_state${NC}"
 [[ -n "$issue" ]] && echo -e " ${GRAY}Working on: #$issue${NC}"
 return
 fi

 # Display states
 echo -e "\n ${CYAN}Agent Status:${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 if [[ ! -f "$STATE_FILE" ]]; then
 echo -e " ${GRAY}No state data yet.${NC}"
 return
 fi

 for a in product-manager ux-designer architect engineer reviewer devops-engineer; do
 local status issue_ref last
 status=$(jq -r --arg a "$a" '.[$a].status // "idle"' "$STATE_FILE")
 issue_ref=$(jq -r --arg a "$a" '.[$a].issue // empty' "$STATE_FILE")
 last=$(jq -r --arg a "$a" '.[$a].lastActivity // empty' "$STATE_FILE")

 local color=$GRAY
 case $status in working) color=$YELLOW;; reviewing) color='\033[0;35m';; stuck) color=$RED;; done) color=$GREEN;; esac

 local extra=""
 [[ -n "$issue_ref" && "$issue_ref" != "null" ]] && extra=" -> #$issue_ref"
 [[ -n "$last" && "$last" != "null" ]] && extra="$extra (${last:0:10})"

 echo -e " ${WHITE}$a${NC} ${color}[$status]${NC}${GRAY}$extra${NC}"
 done
 echo ""
}

# --- DEPS: Dependency validation --------------------------------------

cmd_deps() {
 check_jq
 local num="${1:-}"

 if [[ -z "$num" ]]; then
 echo -e "${RED}Usage: agentx deps <issue_number>${NC}"
 return 1
 fi

 local title="" body=""

 if [[ "$MODE" == "github" ]]; then
 local gh_data
 gh_data=$(gh issue view "$num" --json title,body,state 2>/dev/null) || {
 echo -e "${RED}Issue #$num not found on GitHub${NC}"
 return 1
 }
 title=$(echo "$gh_data" | jq -r '.title')
 body=$(echo "$gh_data" | jq -r '.body // ""')
 else
 local file="$ISSUES_DIR/$num.json"
 if [[ ! -f "$file" ]]; then
 echo -e "${RED}Issue #$num not found${NC}"
 return 1
 fi
 title=$(jq -r '.title' "$file")
 body=$(jq -r '.body // ""' "$file")
 fi

 echo -e "\n ${CYAN}Dependency Check: #$num - $title${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 local blocked_by
 blocked_by=$(echo "$body" | grep -oP '(?<=Blocked[- ]by:\s).*' || true)
 local blocks
 blocks=$(echo "$body" | grep -oP '(?<=Blocks:\s).*' || true)

 local has_issues=false

 if [[ -n "$blocked_by" ]]; then
 echo -e " ${YELLOW}Blocked by:${NC}"
 for bid in $(echo "$blocked_by" | grep -oP '#\d+' | tr -d '#'); do
 local bstate="" btitle=""
 if [[ "$MODE" == "github" ]]; then
 local bd
 bd=$(gh issue view "$bid" --json state,title 2>/dev/null) || true
 if [[ -n "$bd" ]]; then
 bstate=$(echo "$bd" | jq -r '.state')
 btitle=$(echo "$bd" | jq -r '.title')
 fi
 else
 local bf="$ISSUES_DIR/$bid.json"
 if [[ -f "$bf" ]]; then
 bstate=$(jq -r '.state' "$bf")
 btitle=$(jq -r '.title' "$bf")
 fi
 fi

 if [[ -n "$bstate" ]]; then
 if [[ "$bstate" == "closed" || "$bstate" == "CLOSED" ]]; then
 echo -e " ${GREEN}[PASS] #$bid - $btitle [closed]${NC}"
 else
 echo -e " ${RED}[FAIL] #$bid - $btitle [open]${NC}"
 has_issues=true
 fi
 else
 echo -e " ${YELLOW}? #$bid - (not found)${NC}"
 fi
 done
 else
 echo -e " ${GREEN}No blockers - ready to start.${NC}"
 fi

 if [[ -n "$blocks" ]]; then
 echo -e " ${GRAY}Blocks:${NC}"
 for bid in $(echo "$blocks" | grep -oP '#\d+' | tr -d '#'); do
 local btitle="(not found)"
 if [[ "$MODE" == "github" ]]; then
 btitle=$(gh issue view "$bid" --json title -q '.title' 2>/dev/null || echo "(not found)")
 else
 local bf="$ISSUES_DIR/$bid.json"
 [[ -f "$bf" ]] && btitle=$(jq -r '.title' "$bf")
 fi
 echo -e " ${GRAY}-> #$bid - $btitle${NC}"
 done
 fi

 if [[ "$has_issues" == "true" ]]; then
 echo -e "\n ${RED}[WARN] BLOCKED - resolve open blockers first.${NC}"
 else
 echo -e "\n ${GREEN}[PASS] All clear - issue is unblocked.${NC}"
 fi
 echo ""
}

# --- DIGEST: Summarize closed issues ---------------------------------

cmd_digest() {
 check_jq
 ensure_dir "$DIGESTS_DIR"

 local week_num
 week_num=$(date +"%Y-W%V")
 local digest_file="$DIGESTS_DIR/DIGEST-$week_num.md"
 local count=0

 {
 echo "# Weekly Digest - $week_num"
 echo ""
 echo "> Auto-generated on $(date +"%Y-%m-%d %H:%M")"
 echo ""
 echo "## Completed Issues"
 echo ""
 echo "| # | Type | Title | Closed |"
 echo "|---|------|-------|--------|"

 if [[ "$MODE" == "github" ]]; then
 local gh_closed
 gh_closed=$(gh issue list --state closed --json number,title,labels,updatedAt --limit 200 2>/dev/null || echo "[]")
 local ccount
 ccount=$(echo "$gh_closed" | jq 'length')
 for i in $(seq 0 $((ccount - 1))); do
 local num title updated type="story"
 num=$(echo "$gh_closed" | jq -r ".[$i].number")
 title=$(echo "$gh_closed" | jq -r ".[$i].title")
 updated=$(echo "$gh_closed" | jq -r ".[$i].updatedAt // \"-\"" | cut -c1-10)
 local label_list
 label_list=$(echo "$gh_closed" | jq -r ".[$i].labels[].name" 2>/dev/null || true)
 for lbl in $label_list; do
 [[ "$lbl" =~ type:(.+) ]] && type="${BASH_REMATCH[1]}"
 done
 echo "| #$num | $type | $title | $updated |"
 count=$((count + 1))
 done
 else
 if [[ -d "$ISSUES_DIR" ]]; then
 for file in "$ISSUES_DIR"/*.json; do
 [[ -f "$file" ]] || continue
 local state
 state=$(jq -r '.state // "open"' "$file")
 if [[ "$state" == "closed" ]]; then
 local num title updated type
 num=$(jq -r '.number' "$file")
 title=$(jq -r '.title' "$file")
 updated=$(jq -r '.updated // "-"' "$file" | cut -c1-10)
 type=$(get_type "$file")
 echo "| #$num | $type | $title | $updated |"
 count=$((count + 1))
 fi
 done
 fi
 fi

 echo ""
 echo "## Key Decisions"
 echo ""
 echo "_Review closed issues above and note key technical decisions made._"
 echo ""
 echo "## Outcomes"
 echo ""
 echo "- **Issues closed**: $count"
 echo "- **Generated**: $(date +"%Y-%m-%d")"
 echo ""
 } > "$digest_file"

 if [[ "$count" -eq 0 ]]; then
 rm -f "$digest_file"
 echo -e "${YELLOW}No closed issues to digest.${NC}"
 return
 fi

 echo -e " ${GREEN}Digest generated: $digest_file${NC}"
 echo -e " ${GRAY}Closed issues: $count${NC}"
}

# --- WORKFLOW: Show workflow steps ------------------------------------

cmd_workflow() {
 local type="${1:-}"

 if [[ -z "$type" ]]; then
 echo -e "\n ${CYAN}Available Workflows:${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 for f in "$WORKFLOWS_DIR"/*.toml; do
 [[ -f "$f" ]] || continue
 local name desc
 name=$(basename "$f" .toml)
 desc=$(grep -oP '(?<=^description\s=\s").*(?=")' "$f" | head -1)
 echo -e " ${WHITE}$name${NC} ${GRAY}- $desc${NC}"
 done
 echo ""
 echo -e " ${GRAY}Usage: agentx workflow <name>${NC}"
 echo ""
 return
 fi

 local wf_file="$WORKFLOWS_DIR/$type.toml"
 if [[ ! -f "$wf_file" ]]; then
 echo -e "${RED}Workflow '$type' not found at $wf_file${NC}"
 return 1
 fi

 echo -e "\n ${CYAN}Workflow: $type${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 local step_num=0
 local id="" title="" agent="" needs=""

 while IFS= read -r line; do
 if [[ "$line" =~ ^\[\[steps\]\] ]]; then
 if [[ -n "$id" ]]; then
 step_num=$((step_num + 1))
 local needs_str=""
 [[ -n "$needs" ]] && needs_str=" (after: $needs)"
 echo -e " ${CYAN}$step_num.${NC} ${WHITE}$id${NC} ${YELLOW}-> $agent${NC}${GRAY}$needs_str${NC}"
 echo -e " ${GRAY}$title${NC}"
 fi
 id=""; title=""; agent=""; needs=""
 fi
 [[ "$line" =~ ^id\ =\ \"(.+)\" ]] && id="${BASH_REMATCH[1]}"
 [[ "$line" =~ ^title\ =\ \"(.+)\" ]] && title="${BASH_REMATCH[1]}"
 [[ "$line" =~ ^agent\ =\ \"(.+)\" ]] && agent="${BASH_REMATCH[1]}"
 [[ "$line" =~ ^needs\ =\ \[(.+)\] ]] && needs=$(echo "${BASH_REMATCH[1]}" | tr -d '"')
 done < "$wf_file"

 # Last step
 if [[ -n "$id" ]]; then
 step_num=$((step_num + 1))
 local needs_str=""
 [[ -n "$needs" ]] && needs_str=" (after: $needs)"
 echo -e " ${CYAN}$step_num.${NC} ${WHITE}$id${NC} ${YELLOW}-> $agent${NC}${GRAY}$needs_str${NC}"
 echo -e " ${GRAY}$title${NC}"
 fi
 echo ""
}

# --- HOOK: Lifecycle hooks for agents ---------------------------------

cmd_hook() {
 check_jq
 local phase="${1:-}"
 local agent="${2:-}"
 local issue="${3:-}"

 if [[ -z "$phase" || -z "$agent" ]]; then
 echo -e "${RED}Usage: agentx hook start|finish <agent> [issue]${NC}"
 return 1
 fi

 ensure_dir "$(dirname "$STATE_FILE")"

 case "$phase" in
 start)
 echo -e "\n ${CYAN}Agent Hook: START${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 # 1. Check dependencies
 if [[ -n "$issue" ]]; then
 echo -e " ${GRAY}Checking dependencies for #$issue...${NC}"
 local body=""
 if [[ "$MODE" == "github" ]]; then
 body=$(gh issue view "$issue" --json body -q '.body // ""' 2>/dev/null || true)
 else
 local issue_file="$ISSUES_DIR/$issue.json"
 [[ -f "$issue_file" ]] && body=$(jq -r '.body // ""' "$issue_file")
 fi

 if [[ -n "$body" ]]; then
 local blocked_by
 blocked_by=$(echo "$body" | grep -oP '(?<=Blocked[- ]by:\s).*' || true)
 if [[ -n "$blocked_by" ]]; then
 for bid in $(echo "$blocked_by" | grep -oP '#\d+' | tr -d '#'); do
 local bstate="" btitle=""
 if [[ "$MODE" == "github" ]]; then
 local bd
 bd=$(gh issue view "$bid" --json state,title 2>/dev/null) || true
 if [[ -n "$bd" ]]; then
 bstate=$(echo "$bd" | jq -r '.state')
 btitle=$(echo "$bd" | jq -r '.title')
 fi
 else
 local bf="$ISSUES_DIR/$bid.json"
 if [[ -f "$bf" ]]; then
 bstate=$(jq -r '.state // "open"' "$bf")
 btitle=$(jq -r '.title' "$bf")
 fi
 fi
 if [[ -n "$bstate" && "$bstate" != "closed" && "$bstate" != "CLOSED" ]]; then
 echo -e " ${RED}[FAIL] BLOCKED by #$bid - $btitle [open]${NC}"
 echo -e "\n ${RED}[X] Cannot start - resolve blockers first.${NC}"
 return 1
 fi
 done
 fi
 fi
 echo -e " ${GREEN}[PASS] No blockers${NC}"
 fi

 # 2. Update agent state
 local status="working"
 [[ "$agent" == "reviewer" ]] && status="reviewing"
 local ts
 ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
 local issue_val="null"
 [[ -n "$issue" ]] && issue_val="$issue"

 if [[ ! -f "$STATE_FILE" ]]; then
 echo '{}' > "$STATE_FILE"
 fi

 jq --arg a "$agent" --arg s "$status" --arg t "$ts" --argjson i "$issue_val" \
 '.[$a] = { status: $s, issue: $i, lastActivity: $t }' \
 "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

 echo -e " ${GREEN}[PASS] $agent -> $status (issue #$issue)${NC}"
 echo ""
 ;;
 finish)
 echo -e "\n ${CYAN}Agent Hook: FINISH${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 local ts
 ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
 local issue_val="null"
 [[ -n "$issue" ]] && issue_val="$issue"

 if [[ ! -f "$STATE_FILE" ]]; then
 echo '{}' > "$STATE_FILE"
 fi

 jq --arg a "$agent" --arg t "$ts" --argjson i "$issue_val" \
 '.[$a] = { status: "done", issue: $i, lastActivity: $t }' \
 "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

 echo -e " ${GREEN}[PASS] $agent -> done (issue #$issue)${NC}"
 echo ""
 ;;
 *)
 echo -e "${RED}Unknown phase: $phase (use start|finish)${NC}"
 return 1
 ;;
 esac
}

# --- VERSION ----------------------------------------------------------

cmd_version() {
 local version_file="$AGENTX_DIR/version.json"
 if [[ -f "$version_file" ]]; then
 check_jq
 local ver profile mode installed updated
 ver=$(jq -r '.version // "unknown"' "$version_file")
 profile=$(jq -r '.profile // "full"' "$version_file")
 mode=$(jq -r '.mode // "local"' "$version_file")
 installed=$(jq -r '.installedAt // "unknown"' "$version_file")
 updated=$(jq -r '.updatedAt // "unknown"' "$version_file")

 echo ""
 echo -e " ${CYAN}AgentX Version Information:${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo -e " Version: ${WHITE}${ver}${NC}"
 echo -e " Profile: ${WHITE}${profile}${NC}"
 echo -e " Mode: ${WHITE}${mode}${NC}"
 echo -e " Installed: ${GRAY}${installed}${NC}"
 echo -e " Updated: ${GRAY}${updated}${NC}"
 echo ""
 else
 echo -e " ${YELLOW}AgentX version unknown (no version.json - installed before v4.0)${NC}"
 echo -e " ${GRAY}Re-run the installer to generate version tracking.${NC}"
 fi
}

# --- UPGRADE ----------------------------------------------------------

cmd_upgrade() {
 local REPO="https://github.com/jnPiyush/AgentX.git"
 local TMP=".agentx-upgrade-tmp"
 local version_file="$AGENTX_DIR/version.json"
 local current_version="unknown"

 echo ""
 echo -e " ${CYAN}AgentX Upgrade${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"

 # Show current version
 if [[ -f "$version_file" ]] && command -v jq &>/dev/null; then
 current_version=$(jq -r '.version // "unknown"' "$version_file")
 echo -e " Current version: ${WHITE}${current_version}${NC}"
 fi

 # Clone latest
 echo -e " ${GRAY}Fetching latest AgentX...${NC}"
 rm -rf "$TMP"
 if ! git clone --depth 1 --quiet "$REPO" "$TMP" 2>/dev/null; then
 echo -e " ${RED}[FAIL] Clone failed. Check network connection.${NC}"
 return 1
 fi
 if [[ ! -f "$TMP/AGENTS.md" ]]; then
 echo -e " ${RED}[FAIL] Clone incomplete. Try again.${NC}"
 rm -rf "$TMP"
 return 1
 fi
 rm -rf "$TMP/.git"
 rm -f "$TMP/install.ps1" "$TMP/install.sh"

 # Framework paths to upgrade (never touch user content)
 local framework_paths=(
 ".github/agents" ".github/templates" ".github/hooks" ".github/scripts"
 ".github/workflows" ".github/instructions" ".github/prompts"
 ".github/copilot-instructions.md" ".github/SCENARIOS.md"
 ".agentx/agentx.ps1" ".agentx/agentx.sh"
 ".agentx/local-issue-manager.ps1" ".agentx/local-issue-manager.sh"
 ".agentx/workflows"
 "AGENTS.md" "Skills.md" "CONTRIBUTING.md" "README.md" "CHANGELOG.md"
 )

 local updated=0 added=0 skipped=0

 for fw_path in "${framework_paths[@]}"; do
 local src_path="$TMP/$fw_path"
 [[ ! -e "$src_path" ]] && continue

 if [[ -d "$src_path" ]]; then
 while IFS= read -r -d '' src_file; do
 local rel="${src_file#$TMP/}"
 local dest="./$rel"
 local dest_dir
 dest_dir=$(dirname "$dest")
 mkdir -p "$dest_dir" 2>/dev/null

 if [[ -f "$dest" ]]; then
 local src_hash dest_hash
 src_hash=$(md5sum "$src_file" | awk '{print $1}')
 dest_hash=$(md5sum "$dest" | awk '{print $1}')
 if [[ "$src_hash" != "$dest_hash" ]]; then
 cp "$src_file" "$dest"
 ((updated++))
 else
 ((skipped++))
 fi
 else
 cp "$src_file" "$dest"
 ((added++))
 fi
 done < <(find "$src_path" -type f -print0)
 else
 local dest="./$fw_path"
 if [[ -f "$dest" ]]; then
 local src_hash dest_hash
 src_hash=$(md5sum "$src_path" | awk '{print $1}')
 dest_hash=$(md5sum "$dest" | awk '{print $1}')
 if [[ "$src_hash" != "$dest_hash" ]]; then
 cp "$src_path" "$dest"
 ((updated++))
 else
 ((skipped++))
 fi
 else
 cp "$src_path" "$dest"
 ((added++))
 fi
 fi
 done

 # Update version file
 local new_ver="4.0.0"
 local new_version_file="$TMP/.agentx/version.json"
 if [[ -f "$new_version_file" ]] && command -v jq &>/dev/null; then
 new_ver=$(jq -r '.version // "4.0.0"' "$new_version_file")
 fi

 local profile="full"
 local inst_date
 inst_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
 if [[ -f "$version_file" ]] && command -v jq &>/dev/null; then
 profile=$(jq -r '.profile // "full"' "$version_file")
 local old_inst
 old_inst=$(jq -r '.installedAt // ""' "$version_file")
 [[ -n "$old_inst" ]] && inst_date="$old_inst"
 fi

 cat > "$version_file" <<EOF
{
 "version": "$new_ver",
 "profile": "$profile",
 "mode": "$MODE",
 "installedAt": "$inst_date",
 "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

 # Cleanup
 rm -rf "$TMP"

 echo ""
 echo -e " ${GREEN}[PASS] Upgrade complete: ${current_version} -> ${new_ver}${NC}"
 echo -e " Updated: ${WHITE}${updated}${NC} files"
 echo -e " Added: ${WHITE}${added}${NC} new files"
 echo -e " Skipped: ${GRAY}${skipped}${NC} unchanged files"
 echo ""
 echo -e " ${GRAY}User content preserved: docs/prd/, docs/adr/, src/, .agentx/issues/${NC}"
 echo ""
}

# --- RUN: Execute workflow steps for an issue -------------------------

cmd_run() {
 check_jq
 local type="${1:-}"
 local issue_number="${2:-}"

 if [[ -z "$type" ]]; then
 echo -e "${RED}[FAIL] Type required (feature|epic|story|bug|spike|devops|docs)${NC}"
 return 1
 fi
 if [[ -z "$issue_number" ]]; then
 echo -e "${RED}[FAIL] Issue number required${NC}"
 return 1
 fi

 local wf_file="$WORKFLOWS_DIR/$type.toml"
 if [[ ! -f "$wf_file" ]]; then
 echo -e "${RED}[FAIL] Workflow not found: $wf_file${NC}"
 return 1
 fi

 # Parse TOML steps
 local steps=()
 local step_ids=() step_titles=() step_agents=() step_needs=()
 local step_optionals=() step_conditions=()
 local step_status_starts=() step_status_completes=()
 local step_outputs=() step_templates=()
 local step_iterates=() step_max_iters=() step_criteria=()
 local idx=-1
 local id="" title="" agent="" needs="" optional="false" condition=""
 local status_start="" status_complete="" output="" template=""
 local iterate="false" max_iter="10" criteria=""

 while IFS= read -r line; do
  line=$(echo "$line" | sed 's/^[[:space:]]*//')
  if [[ "$line" =~ ^\[\[steps\]\] ]]; then
   if [[ $idx -ge 0 ]]; then
    step_ids[$idx]="$id"; step_titles[$idx]="$title"
    step_agents[$idx]="$agent"; step_needs[$idx]="$needs"
    step_optionals[$idx]="$optional"; step_conditions[$idx]="$condition"
    step_status_starts[$idx]="$status_start"
    step_status_completes[$idx]="$status_complete"
    step_outputs[$idx]="$output"; step_templates[$idx]="$template"
    step_iterates[$idx]="$iterate"; step_max_iters[$idx]="$max_iter"
    step_criteria[$idx]="$criteria"
   fi
   idx=$((idx + 1))
   id=""; title=""; agent=""; needs=""; optional="false"; condition=""
   status_start=""; status_complete=""; output=""; template=""
   iterate="false"; max_iter="10"; criteria=""
  fi
  [[ "$line" =~ ^id\ =\ \"(.+)\" ]] && id="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^title\ =\ \"(.+)\" ]] && title="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^agent\ =\ \"(.+)\" ]] && agent="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^needs\ =\ \[(.+)\] ]] && needs=$(echo "${BASH_REMATCH[1]}" | tr -d '"' | tr -d ' ')
  [[ "$line" =~ ^optional\ =\ true ]] && optional="true"
  [[ "$line" =~ ^iterate\ =\ true ]] && iterate="true"
  [[ "$line" =~ ^maxIterations\ =\ ([0-9]+) ]] && max_iter="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^completion_criteria\ =\ \"(.+)\" ]] && criteria="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^condition\ =\ \"(.+)\" ]] && condition="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^status_on_start\ =\ \"(.+)\" ]] && status_start="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^status_on_complete\ =\ \"(.+)\" ]] && status_complete="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^output\ =\ \"(.+)\" ]] && output="${BASH_REMATCH[1]}"
  [[ "$line" =~ ^template\ =\ \"(.+)\" ]] && template="${BASH_REMATCH[1]}"
 done < "$wf_file"

 # Save last step
 if [[ $idx -ge 0 ]]; then
  step_ids[$idx]="$id"; step_titles[$idx]="$title"
  step_agents[$idx]="$agent"; step_needs[$idx]="$needs"
  step_optionals[$idx]="$optional"; step_conditions[$idx]="$condition"
  step_status_starts[$idx]="$status_start"
  step_status_completes[$idx]="$status_complete"
  step_outputs[$idx]="$output"; step_templates[$idx]="$template"
  step_iterates[$idx]="$iterate"; step_max_iters[$idx]="$max_iter"
  step_criteria[$idx]="$criteria"
 fi

 local total=$((idx + 1))

 # Interpolate variables
 echo ""
 echo -e " ${CYAN}* Workflow: $type (Issue #$issue_number)${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo ""

 local completed_steps=()
 local completed_count=0

 for i in $(seq 0 $((total - 1))); do
  local sid="${step_ids[$i]}"
  # Interpolate {{issue_number}} in title
  local stitle="${step_titles[$i]//\{\{issue_number\}\}/$issue_number}"
  stitle="${stitle//\{\{feature_name\}\}/Issue-$issue_number}"
  local sagent="${step_agents[$i]}"
  local sneeds="${step_needs[$i]}"
  local soptional="${step_optionals[$i]}"
  local scondition="${step_conditions[$i]}"
  local sstatus_start="${step_status_starts[$i]}"
  local sstatus_complete="${step_status_completes[$i]}"
  local soutput="${step_outputs[$i]}"
  local stemplate="${step_templates[$i]}"

  # Check dependencies
  local blocked=false
  if [[ -n "$sneeds" ]]; then
   IFS=',' read -ra dep_arr <<< "$sneeds"
   for dep in "${dep_arr[@]}"; do
    local found=false
    for c in "${completed_steps[@]}"; do
     [[ "$c" == "$dep" ]] && found=true && break
    done
    if [[ "$found" == "false" ]]; then
     blocked=true
     break
    fi
   done
  fi

  # Check condition (e.g., "has_label:needs:ux")
  local condition_met=true
  if [[ -n "$scondition" && "$scondition" =~ ^has_label:(.+)$ ]]; then
   local required_label="${BASH_REMATCH[1]}"
   if [[ "$MODE" == "github" ]]; then
    local label_check
    label_check=$(gh issue view "$issue_number" --json labels --jq '.labels[].name' 2>/dev/null || true)
    if ! echo "$label_check" | grep -q "^${required_label}$"; then
     condition_met=false
    fi
   else
    local issue_file="$ISSUES_DIR/ISSUE-${issue_number}.json"
    if [[ -f "$issue_file" ]]; then
     if ! jq -e --arg l "$required_label" '.labels[] | select(. == $l)' "$issue_file" &>/dev/null; then
      condition_met=false
     fi
    else
     condition_met=false
    fi
   fi
  fi

  if [[ "$soptional" == "true" && "$condition_met" == "false" ]]; then
   echo -e " ${GRAY}( ) ${sid}: $stitle [$sagent] - skipped (optional, condition not met)${NC}"
   completed_steps+=("$sid")
   completed_count=$((completed_count + 1))
   continue
  fi

  if [[ "$blocked" == "true" ]]; then
   echo -e " ${YELLOW}[WAIT] ${sid}: $stitle [$sagent] - blocked (needs: $sneeds)${NC}"
   continue
  fi

  # Update status
  if [[ -n "$sstatus_start" && "$MODE" == "local" ]]; then
   local issue_file="$ISSUES_DIR/ISSUE-${issue_number}.json"
   if [[ -f "$issue_file" ]]; then
    jq --arg s "$sstatus_start" '.status = $s' "$issue_file" > "${issue_file}.tmp" \
     && mv "${issue_file}.tmp" "$issue_file"
   fi
  fi

  # Copy template if output and template defined
  if [[ -n "$soutput" && -n "$stemplate" ]]; then
   local out_path="${soutput//\{\{issue_number\}\}/$issue_number}"
   out_path="${out_path//\{\{feature_name\}\}/Issue-$issue_number}"
   if [[ ! -f "$out_path" ]]; then
    local out_dir
    out_dir=$(dirname "$out_path")
    [[ -n "$out_dir" ]] && mkdir -p "$out_dir" 2>/dev/null
    if [[ -f "$stemplate" ]]; then
     cp "$stemplate" "$out_path"
     echo -e "    ${GRAY}>> Created: $out_path (from template)${NC}"
    fi
   fi
  fi

  echo -e " ${WHITE}> ${sid}: $stitle${NC}"
  echo -e "    ${GRAY}Agent: @$sagent | Status: $sstatus_start -> $sstatus_complete${NC}"

  # Auto-start iterative loop for iterate steps
  local siterate="${step_iterates[$i]:-false}"
  if [[ "$siterate" == "true" ]]; then
   local smax="${step_max_iters[$i]:-10}"
   local scriteria="${step_criteria[$i]:-All acceptance criteria met, tests pass}"
   echo -e "    ${MAGENTA}[LOOP] Iterative refinement enabled (max $smax iterations)${NC}"
   echo -e "    ${GRAY}Criteria: $scriteria${NC}"
   # Auto-initialize loop state
   mkdir -p "$(dirname "$LOOP_STATE_FILE")" 2>/dev/null
   if command -v jq &>/dev/null; then
    jq -n \
     --arg status "active" \
     --arg prompt "$stitle" \
     --argjson max "$smax" \
     --arg criteria "$scriteria" \
     --arg started "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     --arg issue "$issue_number" \
     --arg step "$sid" \
     '{active:true,status:$status,prompt:$prompt,maxIterations:$max,iteration:0,completionCriteria:$criteria,startedAt:$started,issue:$issue,workflow_step:$step,history:[]}' \
     > "$LOOP_STATE_FILE"
    echo -e "    ${GRAY}[LOOP] State initialized at $LOOP_STATE_FILE${NC}"
   fi
  fi

  completed_steps+=("$sid")
  completed_count=$((completed_count + 1))
 done

 echo ""
 echo -e " ${GREEN}Steps prepared: ${completed_count}/${total}${NC}"
 echo -e " ${GRAY}Next: Invoke each agent with '@agent-name' in Copilot Chat${NC}"
 echo ""
}

add_issue_comment() {
    local issue_num="$1"
    local body="$2"
    if [[ -z "$issue_num" || "$issue_num" == "null" ]]; then return; fi
    
    if [[ "$MODE" == "github" ]]; then
        gh issue comment "$issue_num" --body "$body" &>/dev/null || true
    else
        local local_mgr="$SCRIPT_DIR/local-issue-manager.sh"
        if [[ -f "$local_mgr" ]]; then
            bash "$local_mgr" comment "$issue_num" "$body" &>/dev/null || true
        fi
    fi
}

# --- LOOP: Iterative refinement (Ralph Loop) --------------------------

LOOP_STATE_FILE="$AGENTX_DIR/state/loop-state.json"

cmd_loop() {
 local action="${1:-status}"
 shift 2>/dev/null || true

 case "$action" in
 start) loop_start "$@" ;;
 status) loop_status ;;
 iterate) loop_iterate "$@" ;;
 complete) loop_complete "$@" ;;
 cancel) loop_cancel ;;
 *)
 echo " Unknown loop action: $action"
 echo " Valid actions: start, status, iterate, complete, cancel"
 ;;
 esac
}

loop_start() {
 # Parse arguments
 local prompt=""
 local maxIterations=20
 local completion_criteria="TASK_COMPLETE"
 local issue_number=""

 # Collect prompt parts and options
 local prompt_parts=()
 while [[ $# -gt 0 ]]; do
 case $1 in
 --max-iterations)
 maxIterations="${2:-20}"
 shift 2
 ;;
 --completion-criteria)
 completion_criteria="${2:-TASK_COMPLETE}"
 shift 2
 ;;
 --issue)
 issue_number="$2"
 shift 2
 ;;
 *)
 prompt_parts+=("$1")
 shift
 ;;
 esac
 done

 prompt="${prompt_parts[*]}"

 if [[ -z "$prompt" ]]; then
 echo " [FAIL] Prompt is required to start a loop"
 echo ""
 echo " Usage: ./agentx.sh loop start \"Your task\" --max-iterations 20 --completion-criteria \"ALL_TESTS_PASSING\""
 return 1
 fi

 # Check for existing active loop
 if [[ -f "$LOOP_STATE_FILE" ]] && command -v jq &>/dev/null; then
 local active
 active=$(jq -r '.active // false' "$LOOP_STATE_FILE")
 if [[ "$active" == "true" ]]; then
 local cur_iter
 cur_iter=$(jq -r '.iteration // 0' "$LOOP_STATE_FILE")
 echo " [WARN] An active loop already exists (iteration $cur_iter)"
 echo " Cancel it first: ./agentx.sh loop cancel"
 return 1
 fi
 fi

 local now
 now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 local issue_json="null"
 if [[ -n "$issue_number" ]]; then
 issue_json="$issue_number"
 fi

 mkdir -p "$(dirname "$LOOP_STATE_FILE")"

 cat > "$LOOP_STATE_FILE" <<LOOPEOF
{
 "active": true,
 "status": "active",
 "prompt": $(printf '%s' "$prompt" | jq -Rs .),
 "iteration": 1,
 "maxIterations": $maxIterations,
 "completionCriteria": $(printf '%s' "$completion_criteria" | jq -Rs .),
 "issueNumber": $issue_json,
 "startedAt": "$now",
 "lastIterationAt": "$now",
 "history": [
 {
 "iteration": 1,
 "timestamp": "$now",
 "summary": "Loop started",
 "status": "in-progress"
 }
 ]
}
LOOPEOF

 echo ""
 echo -e " ${CYAN}Iterative Loop Started${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo " Iteration: 1/$maxIterations"
 echo " Criteria: $completion_criteria"
 if [[ -n "$issue_number" ]]; then
 echo " Issue: #$issue_number"
 fi
 echo ""
 echo -e " ${WHITE}Prompt:${NC}"
 echo -e " ${GRAY}$prompt${NC}"
 echo ""
 echo -e " ${YELLOW}[WARN] Loop runs until criteria met or max iterations reached.${NC}"
 echo -e " ${GRAY}To cancel: ./agentx.sh loop cancel${NC}"
 echo ""
 echo -e " ${RED}CRITICAL: Only output completion promise when criteria are genuinely TRUE.${NC}"
 echo -e " ${RED}Do NOT lie to exit the loop. Failures are data -- use them to improve.${NC}"
 echo ""
}

loop_status() {
 if [[ ! -f "$LOOP_STATE_FILE" ]] || ! command -v jq &>/dev/null; then
 echo " No active loop."
 return
 fi

 local active
 active=$(jq -r '.active // false' "$LOOP_STATE_FILE")

 local iteration max_iter criteria startedAt issue_num
 iteration=$(jq -r '.iteration // 0' "$LOOP_STATE_FILE")
 max_iter=$(jq -r '.maxIterations // 0' "$LOOP_STATE_FILE")
 criteria=$(jq -r '.completionCriteria // "none"' "$LOOP_STATE_FILE")
 startedAt=$(jq -r '.startedAt // "unknown"' "$LOOP_STATE_FILE")
 issue_num=$(jq -r '.issueNumber // empty' "$LOOP_STATE_FILE")

 echo ""
 echo -e " ${CYAN}Iterative Loop Status${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo " Active: $active"
 echo " Iteration: $iteration/$max_iter"
 echo " Criteria: $criteria"
 echo " Started: $startedAt"
 if [[ -n "$issue_num" && "$issue_num" != "null" ]]; then
 echo " Issue: #$issue_num"
 fi
 echo ""

 # Show last 5 history entries
 local history_count
 history_count=$(jq '.history | length' "$LOOP_STATE_FILE")
 if [[ $history_count -gt 0 ]]; then
 echo -e " ${WHITE}History (last 5):${NC}"
 jq -r '.history | .[-5:] | .[] | " [\(if .status == "complete" then "PASS" else "..." end)] Iteration \(.iteration): \(.summary)"' "$LOOP_STATE_FILE"
 fi
 echo ""
}

loop_iterate() {
 if [[ ! -f "$LOOP_STATE_FILE" ]] || ! command -v jq &>/dev/null; then
 echo " [FAIL] No loop state found."
 return 1
 fi

local active status
  active=$(jq -r '.active // false' "$LOOP_STATE_FILE")
  status=$(jq -r '.status // "unknown"' "$LOOP_STATE_FILE")
  if [[ "$active" != "true" ]]; then
    echo -e " ${YELLOW}[WARN] Loop was $status. Reopening for new iteration.${NC}"
    local tmp_file
    tmp_file=$(mktemp)
    jq '.active = true | .status = "active"' "$LOOP_STATE_FILE" > "$tmp_file" && mv "$tmp_file" "$LOOP_STATE_FILE"
 fi

 local summary="${*:-Iteration}"
 local iteration max_iter issue_num
 iteration=$(jq -r '.iteration // 0' "$LOOP_STATE_FILE")
 max_iter=$(jq -r '.maxIterations // 0' "$LOOP_STATE_FILE")
 issue_num=$(jq -r '.issueNumber // empty' "$LOOP_STATE_FILE")
 local next_iter=$((iteration + 1))

 if [[ $next_iter -gt $max_iter ]]; then
 echo -e " ${YELLOW}[WARN] Max iterations ($max_iter) reached.${NC}"
 local now
 now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 local tmp
 tmp=$(jq --arg ts "$now" --arg s "Max iterations reached. $summary" --argjson i "$next_iter" \
 '.active = false | .lastIterationAt = $ts | .history += [{"iteration": $i, "timestamp": $ts, "summary": $s, "status": "stopped"}]' \
 "$LOOP_STATE_FILE")
 echo "$tmp" > "$LOOP_STATE_FILE"
 echo -e " ${RED}Loop stopped at iteration $max_iter.${NC}"
 add_issue_comment "$issue_num" "🛑 **Ralph Loop Stopped** (Max iterations $max_iter reached). $summary"
 return
 fi

 local now
 now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 local prompt criteria
 prompt=$(jq -r '.prompt // ""' "$LOOP_STATE_FILE")
 criteria=$(jq -r '.completionCriteria // ""' "$LOOP_STATE_FILE")

 local tmp
 tmp=$(jq --arg ts "$now" --arg s "$summary" --argjson i "$next_iter" \
 '.iteration = $i | .lastIterationAt = $ts | .history += [{"iteration": $i, "timestamp": $ts, "summary": $s, "status": "in-progress"}]' \
 "$LOOP_STATE_FILE")
 echo "$tmp" > "$LOOP_STATE_FILE"

 echo ""
 echo -e " ${CYAN}Iteration $next_iter/$max_iter${NC}"
 echo -e " ${GRAY}Summary: $summary${NC}"
 echo ""
 echo -e " ${WHITE}Prompt (unchanged):${NC}"
 echo -e " ${GRAY}$prompt${NC}"
 echo ""
 echo -e " ${YELLOW}Criteria: $criteria${NC}"
 echo -e " ${GRAY}Remaining: $((max_iter - next_iter)) iterations${NC}"
 echo ""
 add_issue_comment "$issue_num" "🔄 **Ralph Loop Iteration $next_iter/$max_iter**<br>Summary: $summary"
}

loop_complete() {
 if [[ ! -f "$LOOP_STATE_FILE" ]] || ! command -v jq &>/dev/null; then
 echo " [FAIL] No active loop to complete."
 return 1
 fi

 local active
 active=$(jq -r '.active // false' "$LOOP_STATE_FILE")
 if [[ "$active" != "true" ]]; then
    echo -e " ${YELLOW}[WARN] Loop is already inactive/complete.${NC}"
    return 0
 fi
 local now
 now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 local iteration max_iter criteria issue_num
 iteration=$(jq -r '.iteration // 0' "$LOOP_STATE_FILE")
 max_iter=$(jq -r '.maxIterations // 0' "$LOOP_STATE_FILE")
 criteria=$(jq -r '.completionCriteria // ""' "$LOOP_STATE_FILE")
 issue_num=$(jq -r '.issueNumber // empty' "$LOOP_STATE_FILE")

 local tmp
 tmp=$(jq --arg ts "$now" --arg s "$summary" --argjson i "$iteration" \
 '.active = false | .lastIterationAt = $ts | .history += [{"iteration": $i, "timestamp": $ts, "summary": $s, "status": "complete"}]' \
 "$LOOP_STATE_FILE")
 echo "$tmp" > "$LOOP_STATE_FILE"

 echo ""
 echo -e " ${GREEN}[PASS] Loop Complete!${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo " Iterations: $iteration/$max_iter"
 echo " Criteria: $criteria"
 echo " Summary: $summary"
 if [[ -n "$issue_num" && "$issue_num" != "null" ]]; then
 echo " Issue: #$issue_num"
 fi
 echo ""
 add_issue_comment "$issue_num" "✅ **Ralph Loop Complete!**<br>Iterations: $iteration/$max_iter<br>Summary: $summary"
}

loop_cancel() {
 if [[ ! -f "$LOOP_STATE_FILE" ]] || ! command -v jq &>/dev/null; then
 echo " No active loop to cancel."
 return
 fi

 local active
 active=$(jq -r '.active // false' "$LOOP_STATE_FILE")
 if [[ "$active" != "true" ]]; then
    echo -e " ${YELLOW}[WARN] Loop is already inactive/cancelled.${NC}"
    return 0
 fi
 local iteration issue_num
 local now
 now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 iteration=$(jq -r '.iteration // 0' "$LOOP_STATE_FILE")
 issue_num=$(jq -r '.issueNumber // empty' "$LOOP_STATE_FILE")

 local tmp
 tmp=$(jq --arg ts "$now" --argjson i "$iteration" \
 '.active = false | .lastIterationAt = $ts | .history += [{"iteration": $i, "timestamp": $ts, "summary": "Loop cancelled by user", "status": "cancelled"}]' \
 "$LOOP_STATE_FILE")
 echo "$tmp" > "$LOOP_STATE_FILE"

 echo -e " ${YELLOW}Cancelled loop at iteration $iteration.${NC}"
 add_issue_comment "$issue_num" "⚠️ **Ralph Loop Cancelled** at iteration $iteration."
}

# --- HELP -------------------------------------------------------------

cmd_help() {
 echo ""
 echo -e " ${CYAN}AgentX CLI${NC}"
 echo -e " ${GRAY}---------------------------------------------${NC}"
 echo ""
 echo -e " ${WHITE}Commands:${NC}"
 echo " ready Show unblocked work, sorted by priority"
 echo " state Show all agent states"
 echo " state <agent> <status> [issue] Update agent state (idle|working|reviewing|stuck|done)"
 echo " deps <issue_number> Check dependencies for an issue"
 echo " digest Generate weekly digest of closed issues"
 echo " workflow List all workflow templates"
 echo " workflow <name> Show steps for a specific workflow"
 echo " run <type> <issue_number> Execute workflow steps for an issue"
 echo " hook start <agent> [issue] Auto-run deps + state on agent start"
 echo " hook finish <agent> [issue] Auto-run state done on agent finish"
 echo " version Show installed version info"
 echo " upgrade Smart upgrade (preserves user content)"
 echo " loop start <prompt> [opts] Start iterative refinement loop"
 echo " loop status Check active loop state"
 echo " loop iterate [summary] Advance to next iteration"
 echo " loop complete [summary] Mark loop as done"
 echo " loop cancel Cancel active loop"
 echo ""
 echo -e " ${WHITE}Loop Options:${NC}"
 echo " --max-iterations <n> Max iterations (default: 20)"
 echo " --completion-criteria <text> Completion promise phrase"
 echo " --issue <n> Associated issue number"
 echo ""
 echo -e " ${WHITE}Loop Examples:${NC}"
 echo " ./agentx.sh loop start \"Fix all tests\" --max-iterations 20 --completion-criteria \"ALL_TESTS_PASSING\""
 echo " ./agentx.sh loop iterate \"3/5 tests passing\""
 echo " ./agentx.sh loop complete \"All tests green\""
 echo " ./agentx.sh loop cancel"
 echo ""
 echo -e " ${WHITE}Other Examples:${NC}"
 echo " ./agentx.sh ready"
 echo " ./agentx.sh state engineer working 42"
 echo " ./agentx.sh deps 42"
 echo " ./agentx.sh hook start engineer 42"
 echo " ./agentx.sh hook finish engineer 42"
 echo " ./agentx.sh digest"
 echo " ./agentx.sh workflow feature"
 echo " ./agentx.sh run feature 42"
 echo ""
}

# --- Main Router ------------------------------------------------------

COMMAND="${1:-help}"
shift 2>/dev/null || true

case "$COMMAND" in
 ready) cmd_ready ;;
 state) cmd_state "$@" ;;
 deps) cmd_deps "$@" ;;
 digest) cmd_digest ;;
 workflow) cmd_workflow "$@" ;;
 run) cmd_run "$@" ;;
 hook) cmd_hook "$@" ;;
 loop) cmd_loop "$@" ;;
 version) cmd_version ;;
 upgrade) cmd_upgrade ;;
 help|*) cmd_help ;;
esac
