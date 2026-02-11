#!/usr/bin/env bash
# AgentX CLI — Lightweight task orchestration utilities
# Subcommands: ready, state, deps, digest, workflow, hook, version, upgrade
#
# Usage:
#   ./.agentx/agentx.sh ready                          # Show unblocked work
#   ./.agentx/agentx.sh state                          # Show agent states
#   ./.agentx/agentx.sh state engineer working 42      # Set agent state
#   ./.agentx/agentx.sh deps 42                        # Check dependencies
#   ./.agentx/agentx.sh digest                         # Generate weekly digest
#   ./.agentx/agentx.sh workflow feature               # Show workflow steps
#   ./.agentx/agentx.sh version                        # Show version info
#   ./.agentx/agentx.sh upgrade                        # Smart upgrade

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

# ─── Helpers ──────────────────────────────────────────────────────────

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

# ─── READY: Show unblocked work ──────────────────────────────────────

cmd_ready() {
    check_jq

    local ready_items=()

    if [[ "$MODE" == "github" ]]; then
        # GitHub mode: fetch issues via gh CLI
        local gh_issues
        gh_issues=$(gh issue list --state open --json number,title,labels,body --limit 200 2>/dev/null) || {
            echo -e "${YELLOW}Warning: gh CLI failed — falling back to local issues${NC}"
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

    echo -e "\n  ${CYAN}Ready Work (unblocked, sorted by priority):${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

    for item in "${sorted[@]}"; do
        IFS='|' read -r pri num type title <<< "$item"
        local pri_label="P$pri"
        [[ "$pri" == "9" ]] && pri_label="  "
        local color=$WHITE
        case $pri in 0) color=$RED;; 1) color=$YELLOW;; esac
        echo -e "  ${color}[$pri_label]${NC} ${CYAN}#$num${NC} ${GRAY}($type)${NC} $title"
    done
    echo ""
}

# ─── STATE: Agent status tracking ─────────────────────────────────────

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

        echo -e "  ${GREEN}Agent '$agent' → $new_state${NC}"
        [[ -n "$issue" ]] && echo -e "  ${GRAY}Working on: #$issue${NC}"
        return
    fi

    # Display states
    echo -e "\n  ${CYAN}Agent Status:${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

    if [[ ! -f "$STATE_FILE" ]]; then
        echo -e "  ${GRAY}No state data yet.${NC}"
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
        [[ -n "$issue_ref" && "$issue_ref" != "null" ]] && extra=" → #$issue_ref"
        [[ -n "$last" && "$last" != "null" ]] && extra="$extra (${last:0:10})"

        echo -e "  ${WHITE}$a${NC} ${color}[$status]${NC}${GRAY}$extra${NC}"
    done
    echo ""
}

# ─── DEPS: Dependency validation ──────────────────────────────────────

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

    echo -e "\n  ${CYAN}Dependency Check: #$num — $title${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

    local blocked_by
    blocked_by=$(echo "$body" | grep -oP '(?<=Blocked[- ]by:\s).*' || true)
    local blocks
    blocks=$(echo "$body" | grep -oP '(?<=Blocks:\s).*' || true)

    local has_issues=false

    if [[ -n "$blocked_by" ]]; then
        echo -e "  ${YELLOW}Blocked by:${NC}"
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
                    echo -e "    ${GREEN}✓ #$bid — $btitle [closed]${NC}"
                else
                    echo -e "    ${RED}✗ #$bid — $btitle [open]${NC}"
                    has_issues=true
                fi
            else
                echo -e "    ${YELLOW}? #$bid — (not found)${NC}"
            fi
        done
    else
        echo -e "  ${GREEN}No blockers — ready to start.${NC}"
    fi

    if [[ -n "$blocks" ]]; then
        echo -e "  ${GRAY}Blocks:${NC}"
        for bid in $(echo "$blocks" | grep -oP '#\d+' | tr -d '#'); do
            local btitle="(not found)"
            if [[ "$MODE" == "github" ]]; then
                btitle=$(gh issue view "$bid" --json title -q '.title' 2>/dev/null || echo "(not found)")
            else
                local bf="$ISSUES_DIR/$bid.json"
                [[ -f "$bf" ]] && btitle=$(jq -r '.title' "$bf")
            fi
            echo -e "    ${GRAY}→ #$bid — $btitle${NC}"
        done
    fi

    if [[ "$has_issues" == "true" ]]; then
        echo -e "\n  ${RED}⚠ BLOCKED — resolve open blockers first.${NC}"
    else
        echo -e "\n  ${GREEN}✓ All clear — issue is unblocked.${NC}"
    fi
    echo ""
}

# ─── DIGEST: Summarize closed issues ─────────────────────────────────

cmd_digest() {
    check_jq
    ensure_dir "$DIGESTS_DIR"

    local week_num
    week_num=$(date +"%Y-W%V")
    local digest_file="$DIGESTS_DIR/DIGEST-$week_num.md"
    local count=0

    {
        echo "# Weekly Digest — $week_num"
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
                updated=$(echo "$gh_closed" | jq -r ".[$i].updatedAt // \"—\"" | cut -c1-10)
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
                        updated=$(jq -r '.updated // "—"' "$file" | cut -c1-10)
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

    echo -e "  ${GREEN}Digest generated: $digest_file${NC}"
    echo -e "  ${GRAY}Closed issues: $count${NC}"
}

# ─── WORKFLOW: Show workflow steps ────────────────────────────────────

cmd_workflow() {
    local type="${1:-}"

    if [[ -z "$type" ]]; then
        echo -e "\n  ${CYAN}Available Workflows:${NC}"
        echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

        for f in "$WORKFLOWS_DIR"/*.toml; do
            [[ -f "$f" ]] || continue
            local name desc
            name=$(basename "$f" .toml)
            desc=$(grep -oP '(?<=^description\s=\s").*(?=")' "$f" | head -1)
            echo -e "  ${WHITE}$name${NC} ${GRAY}— $desc${NC}"
        done
        echo ""
        echo -e "  ${GRAY}Usage: agentx workflow <name>${NC}"
        echo ""
        return
    fi

    local wf_file="$WORKFLOWS_DIR/$type.toml"
    if [[ ! -f "$wf_file" ]]; then
        echo -e "${RED}Workflow '$type' not found at $wf_file${NC}"
        return 1
    fi

    echo -e "\n  ${CYAN}Workflow: $type${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

    local step_num=0
    local id="" title="" agent="" needs=""

    while IFS= read -r line; do
        if [[ "$line" =~ ^\[\[steps\]\] ]]; then
            if [[ -n "$id" ]]; then
                step_num=$((step_num + 1))
                local needs_str=""
                [[ -n "$needs" ]] && needs_str=" (after: $needs)"
                echo -e "  ${CYAN}$step_num.${NC} ${WHITE}$id${NC} ${YELLOW}→ $agent${NC}${GRAY}$needs_str${NC}"
                echo -e "     ${GRAY}$title${NC}"
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
        echo -e "  ${CYAN}$step_num.${NC} ${WHITE}$id${NC} ${YELLOW}→ $agent${NC}${GRAY}$needs_str${NC}"
        echo -e "     ${GRAY}$title${NC}"
    fi
    echo ""
}

# ─── HOOK: Lifecycle hooks for agents ─────────────────────────────────

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
            echo -e "\n  ${CYAN}Agent Hook: START${NC}"
            echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

            # 1. Check dependencies
            if [[ -n "$issue" ]]; then
                echo -e "  ${GRAY}Checking dependencies for #$issue...${NC}"
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
                                echo -e "  ${RED}✗ BLOCKED by #$bid — $btitle [open]${NC}"
                                echo -e "\n  ${RED}⛔ Cannot start — resolve blockers first.${NC}"
                                return 1
                            fi
                        done
                    fi
                fi
                echo -e "  ${GREEN}✓ No blockers${NC}"
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

            echo -e "  ${GREEN}✓ $agent → $status (issue #$issue)${NC}"
            echo ""
            ;;
        finish)
            echo -e "\n  ${CYAN}Agent Hook: FINISH${NC}"
            echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

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

            echo -e "  ${GREEN}✓ $agent → done (issue #$issue)${NC}"
            echo ""
            ;;
        *)
            echo -e "${RED}Unknown phase: $phase (use start|finish)${NC}"
            return 1
            ;;
    esac
}

# ─── VERSION ──────────────────────────────────────────────────────────

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
        echo -e "  ${CYAN}AgentX Version Information:${NC}"
        echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"
        echo -e "  Version:     ${WHITE}${ver}${NC}"
        echo -e "  Profile:     ${WHITE}${profile}${NC}"
        echo -e "  Mode:        ${WHITE}${mode}${NC}"
        echo -e "  Installed:   ${GRAY}${installed}${NC}"
        echo -e "  Updated:     ${GRAY}${updated}${NC}"
        echo ""
    else
        echo -e "  ${YELLOW}AgentX version unknown (no version.json — installed before v4.0)${NC}"
        echo -e "  ${GRAY}Re-run the installer to generate version tracking.${NC}"
    fi
}

# ─── UPGRADE ──────────────────────────────────────────────────────────

cmd_upgrade() {
    local REPO="https://github.com/jnPiyush/AgentX.git"
    local TMP=".agentx-upgrade-tmp"
    local version_file="$AGENTX_DIR/version.json"
    local current_version="unknown"

    echo ""
    echo -e "  ${CYAN}AgentX Upgrade${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"

    # Show current version
    if [[ -f "$version_file" ]] && command -v jq &>/dev/null; then
        current_version=$(jq -r '.version // "unknown"' "$version_file")
        echo -e "  Current version: ${WHITE}${current_version}${NC}"
    fi

    # Clone latest
    echo -e "  ${GRAY}Fetching latest AgentX...${NC}"
    rm -rf "$TMP"
    if ! git clone --depth 1 --quiet "$REPO" "$TMP" 2>/dev/null; then
        echo -e "  ${RED}✗ Clone failed. Check network connection.${NC}"
        return 1
    fi
    if [[ ! -f "$TMP/AGENTS.md" ]]; then
        echo -e "  ${RED}✗ Clone incomplete. Try again.${NC}"
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
    echo -e "  ${GREEN}✓ Upgrade complete: ${current_version} → ${new_ver}${NC}"
    echo -e "    Updated: ${WHITE}${updated}${NC} files"
    echo -e "    Added:   ${WHITE}${added}${NC} new files"
    echo -e "    Skipped: ${GRAY}${skipped}${NC} unchanged files"
    echo ""
    echo -e "  ${GRAY}User content preserved: docs/prd/, docs/adr/, src/, .agentx/issues/${NC}"
    echo ""
}

# ─── HELP ─────────────────────────────────────────────────────────────

cmd_help() {
    echo ""
    echo -e "  ${CYAN}AgentX CLI${NC}"
    echo -e "  ${GRAY}─────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${WHITE}Commands:${NC}"
    echo "    ready                          Show unblocked work, sorted by priority"
    echo "    state                          Show all agent states"
    echo "    state <agent> <status> [issue] Update agent state (idle|working|reviewing|stuck|done)"
    echo "    deps <issue_number>            Check dependencies for an issue"
    echo "    digest                         Generate weekly digest of closed issues"
    echo "    workflow                       List all workflow templates"
    echo "    workflow <name>                Show steps for a specific workflow"
    echo "    hook start <agent> [issue]     Auto-run deps + state on agent start"
    echo "    hook finish <agent> [issue]    Auto-run state done on agent finish"
    echo "    version                        Show installed version info"
    echo "    upgrade                        Smart upgrade (preserves user content)"
    echo ""
    echo -e "  ${WHITE}Examples:${NC}"
    echo "    ./agentx.sh ready"
    echo "    ./agentx.sh state engineer working 42"
    echo "    ./agentx.sh deps 42"
    echo "    ./agentx.sh hook start engineer 42"
    echo "    ./agentx.sh hook finish engineer 42"
    echo "    ./agentx.sh digest"
    echo "    ./agentx.sh workflow feature"
    echo ""
}

# ─── Main Router ──────────────────────────────────────────────────────

COMMAND="${1:-help}"
shift 2>/dev/null || true

case "$COMMAND" in
    ready)    cmd_ready ;;
    state)    cmd_state "$@" ;;
    deps)     cmd_deps "$@" ;;
    digest)   cmd_digest ;;
    workflow) cmd_workflow "$@" ;;
    hook)     cmd_hook "$@" ;;
    version)  cmd_version ;;
    upgrade)  cmd_upgrade ;;
    help|*)   cmd_help ;;
esac
