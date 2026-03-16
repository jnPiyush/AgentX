#!/usr/bin/env bash
# AgentX Copilot CLI Plugin v8.3.2 - Installer (Bash)
# Standalone plugin for GitHub Copilot CLI.
# Does NOT require the AgentX VS Code extension or the core install.
#
# Usage:
#   bash packs/agentx-copilot-cli/install.sh [options]
#
# Options:
#   -t, --target <path>    Target workspace (default: current directory)
#   -s, --source <path>    AgentX repo root (default: auto-detect)
#   -c, --include-cli      Also install .agentx/ CLI utilities
#   -f, --force            Overwrite existing files
#   -n, --dry-run          Show what would be copied
#   -h, --help             Show this help
set -euo pipefail

VERSION="8.3.2"
TARGET="$(pwd)"
SOURCE=""
INCLUDE_CLI=false
FORCE=false
DRY_RUN=false

# -- Colors ----------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
skip() { echo -e "${GRAY}[SKIP]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
err()  { echo -e "${RED}[FAIL]${NC} $1"; }

# -- Parse args ------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target) TARGET="$2"; shift 2 ;;
    -s|--source) SOURCE="$2"; shift 2 ;;
    -c|--include-cli) INCLUDE_CLI=true; shift ;;
    -f|--force) FORCE=true; shift ;;
    -n|--dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: bash install.sh [-t target] [-s source] [-c] [-f] [-n] [-h]"
      echo "  -t, --target      Target workspace (default: cwd)"
      echo "  -s, --source      AgentX repo root (default: auto-detect)"
      echo "  -c, --include-cli Install .agentx/ CLI utilities"
      echo "  -f, --force       Overwrite existing files"
      echo "  -n, --dry-run     Preview without changes"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

# -- Auto-detect source ---------------------------------------------------

if [ -z "$SOURCE" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CANDIDATE="$SCRIPT_DIR"
  for _ in 1 2 3 4 5; do
    if [ -d "$CANDIDATE/.github/agents" ]; then
      SOURCE="$CANDIDATE"
      break
    fi
    CANDIDATE="$(dirname "$CANDIDATE")"
  done
  if [ -z "$SOURCE" ]; then
    err "Cannot auto-detect AgentX source. Use -s to specify the repo root."
    exit 1
  fi
fi

if [ ! -d "$SOURCE/.github/agents" ]; then
  err "Source does not contain .github/agents/: $SOURCE"
  exit 1
fi

# -- Helpers ---------------------------------------------------------------

TOTAL_COPIED=0
TOTAL_SKIPPED=0

copy_tree() {
  local src_dir="$1"
  local dest_dir="$2"
  local copied=0
  local skipped=0

  if [ ! -d "$src_dir" ]; then
    err "Source not found: $src_dir"
    return
  fi

  while IFS= read -r -d '' file; do
    local rel="${file#$src_dir/}"
    local dest="$dest_dir/$rel"
    local dest_parent
    dest_parent="$(dirname "$dest")"

    if [ -f "$dest" ] && [ "$FORCE" = false ]; then
      skipped=$((skipped + 1))
      continue
    fi

    if [ "$DRY_RUN" = true ]; then
      echo "  Would copy: $rel"
      copied=$((copied + 1))
      continue
    fi

    mkdir -p "$dest_parent"
    cp "$file" "$dest"
    copied=$((copied + 1))
  done < <(find "$src_dir" -type f -print0)

  TOTAL_COPIED=$((TOTAL_COPIED + copied))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + skipped))
  ok "$3: $copied copied, $skipped skipped"
}

copy_file() {
  local src="$SOURCE/$1"
  local dest="$TARGET/$2"

  if [ ! -f "$src" ]; then return; fi

  if [ -f "$dest" ] && [ "$FORCE" = false ]; then
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  Would copy: $1"
    TOTAL_COPIED=$((TOTAL_COPIED + 1))
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  TOTAL_COPIED=$((TOTAL_COPIED + 1))
}

# -- Banner ----------------------------------------------------------------

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}| AgentX Copilot CLI Plugin v${VERSION}        |${NC}"
echo -e "${CYAN}| Standalone plugin for GitHub Copilot CLI |${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
info "Source : $SOURCE"
info "Target : $TARGET"
info "Force  : $FORCE"
info "CLI    : $INCLUDE_CLI"
echo ""

# -- Copy artifacts --------------------------------------------------------

info "Installing agents..."
copy_tree "$SOURCE/.github/agents" "$TARGET/.github/agents" "Agents"

info "Installing skills..."
copy_tree "$SOURCE/.github/skills" "$TARGET/.github/skills" "Skills"

info "Installing instructions..."
copy_tree "$SOURCE/.github/instructions" "$TARGET/.github/instructions" "Instructions"

info "Installing prompts..."
copy_tree "$SOURCE/.github/prompts" "$TARGET/.github/prompts" "Prompts"

info "Installing templates..."
copy_tree "$SOURCE/.github/templates" "$TARGET/.github/templates" "Templates"

info "Installing schemas..."
copy_tree "$SOURCE/.github/schemas" "$TARGET/.github/schemas" "Schemas"

info "Installing reference docs..."
copy_file "AGENTS.md" "AGENTS.md"
copy_file "Skills.md" "Skills.md"
copy_file "docs/WORKFLOW.md" "docs/WORKFLOW.md"
copy_file ".github/agent-delegation.md" ".github/agent-delegation.md"
ok "Docs: copied reference files"

if [ "$INCLUDE_CLI" = true ]; then
  info "Installing CLI utilities..."
  copy_file ".agentx/agentx.ps1" ".agentx/agentx.ps1"
  copy_file ".agentx/agentx.sh" ".agentx/agentx.sh"
  copy_file ".agentx/local-issue-manager.ps1" ".agentx/local-issue-manager.ps1"
  copy_file ".agentx/local-issue-manager.sh" ".agentx/local-issue-manager.sh"
  ok "CLI: copied CLI utilities"
fi

# -- Version stamp ---------------------------------------------------------

if [ "$DRY_RUN" = false ]; then
  mkdir -p "$TARGET/.github"
  cat > "$TARGET/.github/.agentx-cli-plugin.json" <<EOF
{
  "plugin": "agentx-copilot-cli",
  "version": "$VERSION",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "$SOURCE",
  "includeCli": $INCLUDE_CLI
}
EOF
  ok "Version stamp written to .github/.agentx-cli-plugin.json"
fi

# -- Summary ---------------------------------------------------------------

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} AgentX Copilot CLI Plugin v${VERSION} installed${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo " Files copied  : $TOTAL_COPIED"
echo -e " Files skipped : $TOTAL_SKIPPED ${GRAY}(already exist, use -f to overwrite)${NC}"
echo ""
echo " Agents        : 20 (13 external + 7 internal)"
echo " Skills        : 64 across 10 categories"
echo " Instructions  : 7 (auto-applied by file pattern)"
echo " Prompts       : 12 reusable templates"
if [ "$INCLUDE_CLI" = true ]; then
  echo " CLI utilities : 4 scripts (.agentx/)"
fi
echo ""
echo -e "${YELLOW} Limitations (Copilot CLI vs VS Code):${NC}"
echo -e "${GRAY}  - No runSubagent: agents run standalone, no agent chaining${NC}"
echo -e "${GRAY}  - No Mode 1 hub: Agent X cannot orchestrate sub-agents${NC}"
echo -e "${GRAY}  - Quality loop: Layer 2 (body instructions) + Layer 3 (CLI gate)${NC}"
echo ""