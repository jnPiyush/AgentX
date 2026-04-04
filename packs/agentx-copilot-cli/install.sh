#!/usr/bin/env bash
# AgentX Copilot CLI Plugin v8.4.29 - Installer (Bash)
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

VERSION="8.4.29"
TARGET="$(pwd)"
SOURCE=""
INCLUDE_CLI=false
FORCE=false
DRY_RUN=false
RUNTIME_BUNDLE_ROOT=".github/agentx/.agentx"
RUNTIME_BUNDLE_FILES=(
  "agentx.ps1"
  "agentx.sh"
  "agentx-cli.ps1"
  "agentic-runner.ps1"
  "local-issue-manager.ps1"
  "local-issue-manager.sh"
)
RUNTIME_STATE_DIRS=(
  ".agentx/state"
  ".agentx/digests"
  ".agentx/sessions"
  "docs/artifacts/prd"
  "docs/artifacts/adr"
  "docs/artifacts/specs"
  "docs/artifacts/reviews"
  "docs/artifacts/reviews/findings"
  "docs/artifacts/learnings"
  "docs/ux"
  "docs/execution/plans"
  "docs/execution/progress"
  "memories"
  "memories/session"
)

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

SOURCE="$(cd "$SOURCE" && pwd)"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"

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

write_file_if_needed() {
  local dest="$1"
  local content="$2"

  if [ -f "$dest" ] && [ "$FORCE" = false ]; then
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  Would write: ${dest#$TARGET/}"
    TOTAL_COPIED=$((TOTAL_COPIED + 1))
    return
  fi

  mkdir -p "$(dirname "$dest")"
  printf '%s' "$content" > "$dest"
  TOTAL_COPIED=$((TOTAL_COPIED + 1))
}

install_cli_runtime_bundle() {
  local copied_before=$TOTAL_COPIED
  local skipped_before=$TOTAL_SKIPPED

  for file_name in "${RUNTIME_BUNDLE_FILES[@]}"; do
    copy_file ".agentx/$file_name" "$RUNTIME_BUNDLE_ROOT/$file_name"
  done

  ok "CLI runtime: $((TOTAL_COPIED - copied_before)) copied, $((TOTAL_SKIPPED - skipped_before)) skipped"
}

install_starter_memories() {
  copy_tree "$SOURCE/.agentx/templates/memories" "$TARGET/memories" "Starter memories"
}

initialize_workspace_cli_state() {
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  for dir in "${RUNTIME_STATE_DIRS[@]}"; do
    if [ "$DRY_RUN" = false ]; then
      mkdir -p "$TARGET/$dir"
    fi
  done

  local status_path="$TARGET/.agentx/state/agent-status.json"
  if [ ! -f "$status_path" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "  Would write: .agentx/state/agent-status.json"
    else
      cat > "$status_path" <<'EOF'
{
  "product-manager": { "status": "idle", "issue": null, "lastActivity": null },
  "ux-designer": { "status": "idle", "issue": null, "lastActivity": null },
  "architect": { "status": "idle", "issue": null, "lastActivity": null },
  "engineer": { "status": "idle", "issue": null, "lastActivity": null },
  "reviewer": { "status": "idle", "issue": null, "lastActivity": null },
  "devops-engineer": { "status": "idle", "issue": null, "lastActivity": null },
  "auto-fix-reviewer": { "status": "idle", "issue": null, "lastActivity": null },
  "data-scientist": { "status": "idle", "issue": null, "lastActivity": null },
  "tester": { "status": "idle", "issue": null, "lastActivity": null },
  "consulting-research": { "status": "idle", "issue": null, "lastActivity": null },
  "powerbi-analyst": { "status": "idle", "issue": null, "lastActivity": null }
}
EOF
    fi
  fi

  local created="$now"
  local next_issue_number=1
  if [ -f "$TARGET/.agentx/config.json" ]; then
    local existing_created
    local existing_next_issue
    existing_created="$(sed -n 's/.*"created"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TARGET/.agentx/config.json" | head -n 1)"
    existing_next_issue="$(sed -n 's/.*"nextIssueNumber"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$TARGET/.agentx/config.json" | head -n 1)"
    if [ -n "$existing_created" ]; then
      created="$existing_created"
    fi
    if [ -n "$existing_next_issue" ]; then
      next_issue_number="$existing_next_issue"
    fi
    if [ -z "$created" ]; then
      created="$now"
    fi
  fi

  local installed_at="$now"
  if [ -f "$TARGET/.agentx/version.json" ]; then
    local existing_installed_at
    existing_installed_at="$(sed -n 's/.*"installedAt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TARGET/.agentx/version.json" | head -n 1)"
    if [ -n "$existing_installed_at" ]; then
      installed_at="$existing_installed_at"
    fi
  fi

  if [ "$DRY_RUN" = false ]; then
    cat > "$TARGET/.agentx/config.json" <<EOF
{
  "provider": "local",
  "integration": "local",
  "mode": "local",
  "enforceIssues": false,
  "nextIssueNumber": $next_issue_number,
  "created": "$created",
  "updatedAt": "$now"
}
EOF

    cat > "$TARGET/.agentx/version.json" <<EOF
{
  "version": "$VERSION",
  "provider": "local",
  "mode": "local",
  "integration": "local",
  "installedAt": "$installed_at",
  "updatedAt": "$now"
}
EOF
  fi
}

install_workspace_cli_wrappers() {
  local agentx_ps1='#!/usr/bin/env pwsh
$ErrorActionPreference = '\''Stop'\''
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '\''..'\'')).Path
$env:AGENTX_WORKSPACE_ROOT = $workspaceRoot
& (Join-Path $workspaceRoot '\''.github\\agentx\\.agentx\\agentx.ps1'\'') @args
$succeeded = $?
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if ($succeeded) {
 $exitCode = 0
} elseif ($exitCode -eq 0) {
 $exitCode = 1
}
exit $exitCode
'
  local issue_ps1='#!/usr/bin/env pwsh
$ErrorActionPreference = '\''Stop'\''
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '\''..'\'')).Path
$env:AGENTX_WORKSPACE_ROOT = $workspaceRoot
& (Join-Path $workspaceRoot '\''.github\\agentx\\.agentx\\local-issue-manager.ps1'\'') @args
$succeeded = $?
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if ($succeeded) {
 $exitCode = 0
} elseif ($exitCode -eq 0) {
 $exitCode = 1
}
exit $exitCode
'
  local agentx_sh='#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AGENTX_WORKSPACE_ROOT="$workspace_root"
exec "$workspace_root/.github/agentx/.agentx/agentx.sh" "$@"
'
  local issue_sh='#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AGENTX_WORKSPACE_ROOT="$workspace_root"
exec "$workspace_root/.github/agentx/.agentx/local-issue-manager.sh" "$@"
'

  local copied_before=$TOTAL_COPIED
  local skipped_before=$TOTAL_SKIPPED
  write_file_if_needed "$TARGET/.agentx/agentx.ps1" "$agentx_ps1"
  write_file_if_needed "$TARGET/.agentx/local-issue-manager.ps1" "$issue_ps1"
  write_file_if_needed "$TARGET/.agentx/agentx.sh" "$agentx_sh"
  write_file_if_needed "$TARGET/.agentx/local-issue-manager.sh" "$issue_sh"
  ok "CLI wrappers: $((TOTAL_COPIED - copied_before)) copied, $((TOTAL_SKIPPED - skipped_before)) skipped"
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

info "Installing scripts..."
copy_file "scripts/score-output.ps1" "scripts/score-output.ps1"
copy_file "scripts/validate-handoff.ps1" "scripts/validate-handoff.ps1"
ok "Scripts: copied supporting scorer files"

info "Installing reference docs..."
copy_file "AGENTS.md" "AGENTS.md"
copy_file "Skills.md" "Skills.md"
copy_file "docs/WORKFLOW.md" "docs/WORKFLOW.md"
copy_file "docs/GUIDE.md" "docs/GUIDE.md"
copy_file "docs/GOLDEN_PRINCIPLES.md" "docs/GOLDEN_PRINCIPLES.md"
copy_file "docs/QUALITY_SCORE.md" "docs/QUALITY_SCORE.md"
copy_file "docs/tech-debt-tracker.md" "docs/tech-debt-tracker.md"
copy_file "docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md" "docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md"
copy_file ".github/agent-delegation.md" ".github/agent-delegation.md"
ok "Docs: copied reference files"

if [ "$INCLUDE_CLI" = true ]; then
  info "Installing CLI runtime bundle..."
  install_cli_runtime_bundle

  info "Seeding CLI workspace state..."
  initialize_workspace_cli_state
  install_starter_memories

  info "Writing workspace CLI wrappers..."
  install_workspace_cli_wrappers
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
  echo " CLI utilities : 4 wrappers (.agentx/) + bundled runtime (.github/agentx/.agentx)"
fi
echo ""
echo -e "${YELLOW} Limitations (Copilot CLI vs VS Code):${NC}"
echo -e "${GRAY}  - No runSubagent: agents run standalone, no agent chaining${NC}"
echo -e "${GRAY}  - No Mode 1 hub: Agent X cannot orchestrate sub-agents${NC}"
echo -e "${GRAY}  - Quality loop: Layer 2 (body instructions) + Layer 3 (CLI gate)${NC}"
echo ""