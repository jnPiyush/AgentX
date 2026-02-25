#!/bin/bash
# AgentX v6.5.0 Installer - Download, copy, configure.
#
# Modes: local (default), github
#
# Usage:
# ./install.sh # Local mode - no prompts
# ./install.sh --mode github # GitHub mode - asks for repo/project
# ./install.sh --path myproject # Install into a subfolder
# ./install.sh --force # Full reinstall (overwrite)
#
# # One-liner install (local mode, no prompts)
# curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
#
# # One-liner for GitHub mode
# MODE=github curl -fsSL ... | bash

set -e

# -- Bash version check --
if [ -z "$BASH_VERSION" ]; then
 echo "[X] This installer requires Bash. Please run with: bash install.sh"
 exit 1
fi

MODE="${MODE:-}"
FORCE="${FORCE:-false}"
NO_SETUP="${NO_SETUP:-false}"
INSTALL_PATH="${AGENTX_PATH:-}"
BRANCH="master"
TMP=".agentx-install-tmp"
TMPARCHIVE="$TMP.tar.gz"
ARCHIVE_URL="https://github.com/jnPiyush/AgentX/archive/refs/heads/$BRANCH.tar.gz"

# -- Guaranteed cleanup (runs on success, error, or Ctrl+C) --
cleanup() {
 rm -rf "$TMP" "$TMPARCHIVE"
 # Return to original dir if --path was used
 [ -n "$INSTALL_PATH" ] && cd - >/dev/null 2>&1 || true
}
trap cleanup EXIT
# -- Error handler - display message before cleanup --
on_error() {
 echo -e "\033[0;31m[X] Installation failed.\033[0m"
 echo -e "\033[0;90m Temp files will be cleaned up automatically.\033[0m"
}
trap 'on_error; cleanup' ERR
PREFIX="AgentX-$BRANCH"
# Legacy: support LOCAL=true -> MODE=local
[ -z "$MODE" ] && [ "${LOCAL:-false}" = "true" ] && MODE="local"

while [[ $# -gt 0 ]]; do
 case $1 in
 --mode) MODE="$2"; shift 2 ;;
 --path) INSTALL_PATH="$2"; shift 2 ;;
 --force) FORCE=true; shift ;;
 --local) MODE="local"; shift ;;
 --no-setup) NO_SETUP=true; shift ;;
 *) shift ;;
 esac
done

# --path: install into a subdirectory
if [ -n "$INSTALL_PATH" ]; then
 INSTALL_PATH="${INSTALL_PATH%/}"
 mkdir -p "$INSTALL_PATH"
 cd "$INSTALL_PATH"
 echo -e "${D} Target: $INSTALL_PATH${N}"
fi

# Auto-detect piped execution (curl | bash) - used to skip interactive prompts
IS_PIPED=false
[ ! -t 0 ] && IS_PIPED=true

G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' D='\033[0;90m' N='\033[0m'
ok() { echo -e "${G}[OK] $1${N}"; }
skip() { echo -e "${D}[--] $1${N}"; }

# -- Banner ----------------------------------------------
echo ""
echo -e "${C}+===================================================+${N}"
echo -e "${C}| AgentX v6.5.0 - AI Agent Orchestration |${N}"
echo -e "${C}+===================================================+${N}"
echo ""

# -- Mode selection (defaults to local - no prompt) ------
if [ -z "$MODE" ]; then
 MODE="local"
fi

LOCAL="false"; [ "$MODE" = "local" ] && LOCAL="true"
DISPLAY_MODE="GitHub"; [ "$LOCAL" = "true" ] && DISPLAY_MODE="Local"
echo ""
echo -e "${G} Mode: $DISPLAY_MODE${N}"
echo ""

# -- Prerequisites ---------------------------------------
# curl/wget + tar for download; git is optional (only for Step 5)
if command -v curl &>/dev/null; then
 FETCH="curl -fsSL"
elif command -v wget &>/dev/null; then
 FETCH="wget -qO-"
else
 echo "curl or wget is required. Install one and retry."; exit 1
fi
command -v tar &>/dev/null || { echo "tar is required for extraction."; exit 1; }

# -- Step 1: Download ------------------------------------
echo -e "${C}[1] Downloading AgentX...${N}"
rm -rf "$TMP"
mkdir -p "$TMP"
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

[ -f "$TMP/AGENTS.md" ] || { echo "Download failed. Check network."; exit 1; }
ok "AgentX downloaded (essential files only)"

# -- Step 2: Copy files ----------------------------------
echo -e "${C}[2] Installing files...${N}"
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

# -- Step 3: Generate runtime files ----------------------
echo -e "${C}[3] Configuring runtime...${N}"
mkdir -p .agentx/state .agentx/digests docs/{prd,adr,specs,ux,reviews,progress}

# Version tracking
VERSION_FILE=".agentx/version.json"
echo "{ \"version\": \"6.5.0\", \"mode\": \"$MODE\", \"installedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > "$VERSION_FILE"
ok "Version 6.5.0 recorded"

# Agent status
STATUS=".agentx/state/agent-status.json"
if [ ! -f "$STATUS" ] || [ "$FORCE" = "true" ]; then
 cat > "$STATUS" <<EOF
{
 "product-manager": { "status": "idle", "issue": null, "lastActivity": null },
 "ux-designer": { "status": "idle", "issue": null, "lastActivity": null },
 "architect": { "status": "idle", "issue": null, "lastActivity": null },
 "engineer": { "status": "idle", "issue": null, "lastActivity": null },
 "reviewer": { "status": "idle", "issue": null, "lastActivity": null },
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
 echo "{ \"mode\": \"github\", \"repo\": null, \"project\": null, \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > "$CONFIG"
 ok "GitHub Mode configured"
 fi
fi

chmod +x .agentx/agentx.sh .agentx/local-issue-manager.sh 2>/dev/null || true

# -- Step 4: Interactive setup -------------------------
if [ "$NO_SETUP" != "true" ]; then
 echo -e "${C}[4] Setup...${N}"

 # Git init + hooks - always auto-init (non-destructive, both modes)
 if command -v git &>/dev/null; then
 if [ ! -d ".git" ]; then
 git init -q
 ok "Git initialized"
 fi

 if [ -d ".git" ]; then
 for h in pre-commit commit-msg; do
 [ -f ".github/hooks/$h" ] && cp ".github/hooks/$h" ".git/hooks/$h" && chmod +x ".git/hooks/$h"
 done
 ok "Git hooks installed"
 fi
 else
 skip "Git not found - skipping git init and hooks"
 fi

 # GitHub setup (username, repo, project) - skipped in local mode or when piped
 if [ "$LOCAL" != "true" ] && [ "$IS_PIPED" != "true" ]; then
 # Username for CODEOWNERS
 USERNAME=""
 command -v gh &>/dev/null && USERNAME=$(gh api user --jq '.login' 2>/dev/null || true)
 [ -z "$USERNAME" ] && command -v git &>/dev/null && USERNAME=$(git config user.name 2>/dev/null || true)
 if [ -z "$USERNAME" ]; then
 read -rp " GitHub username (for CODEOWNERS): " USERNAME
 fi
 if [ -n "$USERNAME" ]; then
 for f in .github/CODEOWNERS .github/agentx-security.yml; do
 [ -f "$f" ] && (sed -i "s/<YOUR_GITHUB_USERNAME>/$USERNAME/g" "$f" 2>/dev/null || \
 sed -i '' "s/<YOUR_GITHUB_USERNAME>/$USERNAME/g" "$f" 2>/dev/null || true)
 done
 ok "Username: $USERNAME"
 fi
 echo ""
 echo -e "${C} GitHub Repository & Project${N}"

 # Auto-detect repo from git remote
 REPO_SLUG=""
 if command -v git &>/dev/null; then
 REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
 if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/.]+) ]]; then
 REPO_SLUG="${BASH_REMATCH[1]}"
 REPO_SLUG="${REPO_SLUG%.git}"
 fi
 fi
 if [ -z "$REPO_SLUG" ] && command -v gh &>/dev/null; then
 REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)
 fi

 if [ -n "$REPO_SLUG" ]; then
 echo -e "${D} Detected repo: $REPO_SLUG${N}"
 read -rp " Use this repo? [Y/n]: " cr
 if [[ "$cr" == "n" || "$cr" == "N" ]]; then
 read -rp " Enter GitHub repo (owner/repo): " REPO_SLUG
 fi
 else
 read -rp " Enter GitHub repo (owner/repo, e.g. myorg/myproject): " REPO_SLUG
 fi

 # Auto-detect project number
 PROJECT_NUM=""
 if [ -n "$REPO_SLUG" ] && command -v gh &>/dev/null; then
 OWNER="${REPO_SLUG%%/*}"
 PROJECTS_JSON=$(gh project list --owner "$OWNER" --format json --limit 10 2>/dev/null || true)
 if [ -n "$PROJECTS_JSON" ]; then
 PROJ_COUNT=$(echo "$PROJECTS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('projects',[])))" 2>/dev/null || echo "0")
 if [ "$PROJ_COUNT" = "1" ]; then
 PROJECT_NUM=$(echo "$PROJECTS_JSON" | python3 -c "import sys,json; p=json.load(sys.stdin)['projects'][0]; print(p['number'])" 2>/dev/null || true)
 PROJ_TITLE=$(echo "$PROJECTS_JSON" | python3 -c "import sys,json; p=json.load(sys.stdin)['projects'][0]; print(p['title'])" 2>/dev/null || true)
 echo -e "${D} Detected project: #$PROJECT_NUM ($PROJ_TITLE)${N}"
 read -rp " Use this project? [Y/n]: " cp
 if [[ "$cp" == "n" || "$cp" == "N" ]]; then PROJECT_NUM=""; fi
 elif [ "$PROJ_COUNT" -gt 1 ] 2>/dev/null; then
 echo -e "${D} Available projects:${N}"
 echo "$PROJECTS_JSON" | python3 -c "
import sys, json
projects = json.load(sys.stdin).get('projects', [])
for i, p in enumerate(projects):
 print(f' [{i+1}] #{p["number"]} - {p["title"]}')
" 2>/dev/null || true
 read -rp " Choose [1-$PROJ_COUNT, or Enter to skip]: " pc
 if [[ "$pc" =~ ^[0-9]+$ ]] && [ "$pc" -ge 1 ] && [ "$pc" -le "$PROJ_COUNT" ]; then
 PROJECT_NUM=$(echo "$PROJECTS_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['projects'][$((pc-1))]['number'])" 2>/dev/null || true)
 fi
 fi
 fi
 fi
 if [ -z "$PROJECT_NUM" ]; then
 read -rp " GitHub Project number (Enter to skip): " PROJECT_NUM
 fi

 # Update config.json with repo and project
 if [ -f "$CONFIG" ] && command -v python3 &>/dev/null; then
 python3 -c "
import json
with open('$CONFIG') as f: cfg = json.load(f)
if '$REPO_SLUG': cfg['repo'] = '$REPO_SLUG'
if '$PROJECT_NUM': cfg['project'] = int('$PROJECT_NUM') if '$PROJECT_NUM'.isdigit() else None
with open('$CONFIG', 'w') as f: json.dump(cfg, f, indent=2)
" 2>/dev/null || true
 fi
 [ -n "$REPO_SLUG" ] && ok "Repo: $REPO_SLUG"
 [ -n "$PROJECT_NUM" ] && ok "Project: #$PROJECT_NUM"
 elif [ "$LOCAL" != "true" ] && [ "$IS_PIPED" = "true" ]; then
 skip "GitHub interactive setup skipped (piped execution)"
 echo -e "${D} Run ./install.sh --mode github to configure repo & project${N}"
 fi
else
 skip "Setup skipped (--no-setup)"
fi

# -- Done ------------------------------------------------
echo ""
echo -e "${G}===================================================${N}"
echo -e "${G} AgentX v6.5.0 installed! [$DISPLAY_MODE]${N}"
echo -e "${G}===================================================${N}"
echo ""
echo " CLI: ./.agentx/agentx.sh help"
echo " Docs: AGENTS.md | Skills.md | docs/SETUP.md"
[ "$LOCAL" = "true" ] && echo -e "${D} Issue: ./.agentx/local-issue-manager.sh create \"[Story] Task\" \"\" \"type:story\"${N}"
if [ -n "$INSTALL_PATH" ]; then
 echo ""
 echo -e "${Y} [TIP] VS Code nested folder:${N}"
 echo -e "${D}  Set 'agentx.rootPath' in .vscode/settings.json to '$(pwd)'${N}"
 echo -e "${D}  or the extension will auto-detect up to 2 levels deep.${N}"
fi

echo ""
