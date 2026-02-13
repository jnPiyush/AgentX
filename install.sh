#!/bin/bash
# AgentX v5.1.0 Installer — Download, copy, configure.
#
# Modes: github (default), local
#
# Usage:
#   ./install.sh                                       # Interactive — asks for mode
#   ./install.sh --mode github                         # Non-interactive, GitHub mode
#   ./install.sh --mode local                          # Non-interactive, Local mode
#   ./install.sh --force                               # Full reinstall (overwrite)
#
#   # One-liner install (interactive)
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
#
#   # One-liner with overrides (non-interactive)
#   MODE=local curl -fsSL ... | bash

set -e

MODE="${MODE:-}"
FORCE="${FORCE:-false}"
NO_SETUP="${NO_SETUP:-false}"
BRANCH="master"
TMP=".agentx-install-tmp"
ARCHIVE_URL="https://github.com/jnPiyush/AgentX/archive/refs/heads/$BRANCH.tar.gz"
PREFIX="AgentX-$BRANCH"
# Legacy: support LOCAL=true → MODE=local
[ -z "$MODE" ] && [ "${LOCAL:-false}" = "true" ] && MODE="local"

while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)     MODE="$2"; shift 2 ;;
        --force)    FORCE=true; shift ;;
        --local)    MODE="local"; shift ;;
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
echo -e "${C}║  AgentX v5.1.0 — AI Agent Orchestration          ║${N}"
echo -e "${C}╚═══════════════════════════════════════════════════╝${N}"
echo ""

# ── Interactive selection ───────────────────────────────
if [ -z "$MODE" ]; then
    echo -e "${C}  Select a mode:${N}"
    echo "  [1] GitHub — Full features: GitHub Actions, PRs, Projects"
    echo "  [2] Local  — Filesystem-based issue tracking, no GitHub required"
    read -rp "  Choose [1-2, default=1]: " mc
    case "$mc" in
        2) MODE="local" ;;
        *) MODE="github" ;;
    esac
fi

LOCAL="false"; [ "$MODE" = "local" ] && LOCAL="true"
DISPLAY_MODE="GitHub"; [ "$LOCAL" = "true" ] && DISPLAY_MODE="Local"
echo ""
echo -e "${G}  Mode: $DISPLAY_MODE${N}"
echo ""

# ── Prerequisites ───────────────────────────────────────
# curl/wget + tar for download; git is optional (only for Step 5)
if command -v curl &>/dev/null; then
    FETCH="curl -fsSL"
elif command -v wget &>/dev/null; then
    FETCH="wget -qO-"
else
    echo "curl or wget is required. Install one and retry."; exit 1
fi
command -v tar &>/dev/null || { echo "tar is required for extraction."; exit 1; }

# ── Step 1: Download ────────────────────────────────────
echo -e "${C}① Downloading AgentX...${N}"
rm -rf "$TMP"
mkdir -p "$TMP"
TMPARCHIVE="$TMP.tar.gz"
$FETCH "$ARCHIVE_URL" > "$TMPARCHIVE"
[ -s "$TMPARCHIVE" ] || { echo "Download failed. Check network."; exit 1; }

# Extract only essential paths (skip vscode-extension, tests, CHANGELOG, CONTRIBUTING, etc.)
tar xzf "$TMPARCHIVE" --strip-components=1 -C "$TMP" \
    "$PREFIX/.agentx" \
    "$PREFIX/.github" \
    "$PREFIX/.vscode" \
    "$PREFIX/scripts" \
    "$PREFIX/AGENTS.md" \
    "$PREFIX/Skills.md" \
    "$PREFIX/.gitignore" 2>/dev/null || true

rm -f "$TMPARCHIVE"
[ -f "$TMP/AGENTS.md" ] || { echo "Download failed. Check network."; exit 1; }
ok "AgentX downloaded (essential files only)"

# ── Step 2: Copy files ──────────────────────────────────
echo -e "${C}② Installing files...${N}"
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

# ── Step 3: Generate runtime files ──────────────────────
echo -e "${C}③ Configuring runtime...${N}"
mkdir -p .agentx/state .agentx/digests docs/{prd,adr,specs,ux,reviews,progress}

# Version tracking
VERSION_FILE=".agentx/version.json"
echo "{ \"version\": \"5.1.0\", \"mode\": \"$MODE\", \"installedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > "$VERSION_FILE"
ok "Version 5.1.0 recorded"

# Agent status
STATUS=".agentx/state/agent-status.json"
if [ ! -f "$STATUS" ] || [ "$FORCE" = "true" ]; then
    cat > "$STATUS" <<EOF
{
    "product-manager": { "status": "idle", "issue": null, "lastActivity": null },
    "ux-designer":     { "status": "idle", "issue": null, "lastActivity": null },
    "architect":       { "status": "idle", "issue": null, "lastActivity": null },
    "engineer":        { "status": "idle", "issue": null, "lastActivity": null },
    "reviewer":        { "status": "idle", "issue": null, "lastActivity": null },
    "devops-engineer": { "status": "idle", "issue": null, "lastActivity": null }
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

# ── Step 4: Interactive setup ─────────────────────────
if [ "$NO_SETUP" != "true" ]; then
    echo -e "${C}④ Setup...${N}"

    if command -v git &>/dev/null; then
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
    else
        skip "Git not found — skipping git init and hooks"
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
rm -rf "$TMP" "$TMP.tar.gz"

# ── Done ────────────────────────────────────────────────
echo ""
echo -e "${G}═══════════════════════════════════════════════════${N}"
echo -e "${G}  AgentX v5.1.0 installed!  [$DISPLAY_MODE]${N}"
echo -e "${G}═══════════════════════════════════════════════════${N}"
echo ""
echo "  CLI:   ./.agentx/agentx.sh help"
echo "  Docs:  AGENTS.md | Skills.md | docs/SETUP.md"
[ "$LOCAL" = "true" ] && echo -e "${D}  Issue: ./.agentx/local-issue-manager.sh create \"[Story] Task\" \"\" \"type:story\"${N}"
echo ""
