#!/bin/bash
# AgentX v4.0.0 Installer — Clone, prune by profile, copy, configure.
#
# Profiles: full (default), minimal, python, dotnet, react
#
# Usage:
#   ./install.sh                              # Full install, GitHub mode
#   ./install.sh --profile python             # Python profile
#   ./install.sh --profile minimal --local    # Minimal, local mode
#   ./install.sh --force                      # Full reinstall (overwrite)
#
#   # One-liner install
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
#
#   # One-liner with profile (env vars)
#   PROFILE=python LOCAL=true curl -fsSL ... | bash

set -e

PROFILE="${PROFILE:-full}"
FORCE="${FORCE:-false}"
LOCAL="${LOCAL:-false}"
NO_SETUP="${NO_SETUP:-false}"
REPO="https://github.com/jnPiyush/AgentX.git"
TMP=".agentx-install-tmp"

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)  PROFILE="$2"; shift 2 ;;
        --force)    FORCE=true; shift ;;
        --local)    LOCAL=true; shift ;;
        --no-setup) NO_SETUP=true; shift ;;
        *) shift ;;
    esac
done

G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' D='\033[0;90m' N='\033[0m'
ok()   { echo -e "${G}[OK] $1${N}"; }
skip() { echo -e "${D}[--] $1${N}"; }

# ── Banner ──────────────────────────────────────────────
echo ""
echo -e "${C}╔═══════════════════════════════════════════════════╗${N}"
echo -e "${C}║  AgentX v4.0.0 — AI Agent Orchestration          ║${N}"
echo -e "${C}╚═══════════════════════════════════════════════════╝${N}"
MODE="GitHub"; [ "$LOCAL" = "true" ] && MODE="Local"
echo -e "${G}  Profile: $PROFILE | Mode: $MODE${N}"
echo ""

# ── Prerequisites ───────────────────────────────────────
command -v git &>/dev/null || { echo "Git required: https://git-scm.com"; exit 1; }

# ── Step 1: Clone ───────────────────────────────────────
echo -e "${C}① Cloning repository...${N}"
rm -rf "$TMP"
git clone --depth 1 --quiet "$REPO" "$TMP" 2>/dev/null
[ -f "$TMP/AGENTS.md" ] || { echo "Clone failed. Check network."; exit 1; }
rm -rf "$TMP/.git" "$TMP/install.ps1" "$TMP/install.sh"
ok "Repository cloned"

# ── Step 2: Prune by profile ───────────────────────────
echo -e "${C}② Applying profile: $PROFILE${N}"
prune() { for p in "$@"; do rm -rf "$TMP/$p" 2>/dev/null || true; done; }

case "$PROFILE" in
    minimal)
        prune .github/skills .github/instructions .github/prompts \
              .github/workflows .github/hooks .vscode scripts ;;
    python)
        prune .github/skills/cloud .github/skills/design \
              .github/skills/development/{csharp,blazor,react,frontend-ui,go,rust,mcp-server-development} \
              .github/instructions/{csharp,blazor,react}.instructions.md ;;
    dotnet)
        prune .github/skills/design \
              .github/skills/development/{python,react,frontend-ui,go,rust,data-analysis,mcp-server-development} \
              .github/skills/cloud/{fabric-analytics,fabric-data-agent,fabric-forecasting} \
              .github/instructions/{python,react}.instructions.md ;;
    react)
        prune .github/skills/cloud \
              .github/skills/development/{csharp,blazor,python,go,rust,postgresql,sql-server,data-analysis,mcp-server-development} \
              .github/instructions/{csharp,blazor,python,sql}.instructions.md ;;
esac
ok "Profile applied"

# ── Step 3: Copy files ──────────────────────────────────
echo -e "${C}③ Installing files...${N}"
copied=0; skipped=0

while IFS= read -r src; do
    rel="${src#$TMP/}"
    dest="./$rel"
    mkdir -p "$(dirname "$dest")"
    if [ "$FORCE" = "true" ] || [ ! -f "$dest" ]; then
        cp "$src" "$dest"
        ((copied++)) || true
    else
        ((skipped++)) || true
    fi
done < <(find "$TMP" -type f)
ok "$copied files installed ($skipped existing skipped)"

# ── Step 4: Generate runtime files ──────────────────────
echo -e "${C}④ Configuring runtime...${N}"
mkdir -p .agentx/state .agentx/digests docs/{prd,adr,specs,ux,reviews,progress}

# Agent status
STATUS=".agentx/state/agent-status.json"
if [ ! -f "$STATUS" ] || [ "$FORCE" = "true" ]; then
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    cat > "$STATUS" <<EOF
{
    "agents": {
        "product_manager": { "status": "idle", "current_issue": null, "updated": "$ts" },
        "ux_designer":     { "status": "idle", "current_issue": null, "updated": "$ts" },
        "architect":       { "status": "idle", "current_issue": null, "updated": "$ts" },
        "engineer":        { "status": "idle", "current_issue": null, "updated": "$ts" },
        "reviewer":        { "status": "idle", "current_issue": null, "updated": "$ts" },
        "devops":          { "status": "idle", "current_issue": null, "updated": "$ts" }
    }
}
EOF
    ok "Agent status initialized"
fi

# Mode config
CONFIG=".agentx/config.json"
if [ ! -f "$CONFIG" ] || [ "$FORCE" = "true" ]; then
    if [ "$LOCAL" = "true" ]; then
        mkdir -p .agentx/issues
        echo "{ \"mode\": \"local\", \"nextIssueNumber\": 1, \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > "$CONFIG"
        ok "Local Mode configured"
    else
        echo "{ \"mode\": \"github\", \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > "$CONFIG"
        ok "GitHub Mode configured"
    fi
fi

chmod +x .agentx/agentx.sh .agentx/local-issue-manager.sh 2>/dev/null || true

# ── Step 5: Interactive setup ───────────────────────────
if [ "$NO_SETUP" != "true" ]; then
    echo -e "${C}⑤ Setup...${N}"

    if [ ! -d ".git" ]; then
        echo -e "${Y}  Not a Git repository.${N}"
        echo -e "${C}  [1] Initialize Git  [2] Skip${N}"
        read -rp "  Choose: " r
        [[ "$r" == "1" ]] && { git init -q; ok "Git initialized"; }
    fi

    if [ -d ".git" ]; then
        for h in pre-commit commit-msg; do
            [ -f ".github/hooks/$h" ] && cp ".github/hooks/$h" ".git/hooks/$h" && chmod +x ".git/hooks/$h"
        done
        ok "Git hooks installed"
    fi

    USERNAME=""
    command -v gh &>/dev/null && USERNAME=$(gh api user --jq '.login' 2>/dev/null || true)
    [ -z "$USERNAME" ] && command -v git &>/dev/null && USERNAME=$(git config user.name 2>/dev/null || true)
    [ -z "$USERNAME" ] && { read -rp "  GitHub username (for CODEOWNERS): " USERNAME; }
    if [ -n "$USERNAME" ]; then
        for f in .github/CODEOWNERS .github/agentx-security.yml; do
            [ -f "$f" ] && (sed -i "s/<YOUR_GITHUB_USERNAME>/$USERNAME/g" "$f" 2>/dev/null || \
                            sed -i '' "s/<YOUR_GITHUB_USERNAME>/$USERNAME/g" "$f" 2>/dev/null || true)
        done
        ok "Username: $USERNAME"
    fi
else
    skip "Setup skipped (--no-setup)"
fi

# ── Cleanup ─────────────────────────────────────────────
rm -rf "$TMP"

# ── Done ────────────────────────────────────────────────
echo ""
echo -e "${G}═══════════════════════════════════════════════════${N}"
echo -e "${G}  AgentX v4.0.0 installed!  [$PROFILE | $MODE]${N}"
echo -e "${G}═══════════════════════════════════════════════════${N}"
echo ""
echo "  CLI:   ./.agentx/agentx.sh help"
echo "  Docs:  AGENTS.md | Skills.md | docs/SETUP.md"
[ "$LOCAL" = "true" ] && echo -e "${D}  Issue: ./.agentx/local-issue-manager.sh create \"[Story] Task\" \"\" \"type:story\"${N}"
echo ""
