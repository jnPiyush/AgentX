#!/usr/bin/env bash
# Install AgentX into ~/.copilot/ for global GitHub Copilot CLI discovery.
# Path 2 installer -- counterpart to install.sh (workspace-level).
#
# Layout written:
#   ~/.copilot/agents/        <- .github/agents/
#   ~/.copilot/skills/        <- .github/skills/
#   ~/.copilot/instructions/  <- .github/instructions/
#   ~/.copilot/prompts/       <- .github/prompts/
#   ~/.copilot/templates/     <- .github/templates/  (with --templates)
#   ~/.copilot/AGENTS.md      <- AGENTS.md
#
# Optionally registers AgentX MCP server in ~/.copilot/mcp-config.json (--mcp).

set -euo pipefail

SOURCE=""
USER_HOME="${HOME:-}"
FORCE=0
INCLUDE_TEMPLATES=0
REGISTER_MCP=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: install-user.sh [options]

  -s, --source PATH    AgentX repo root (auto-detected if omitted)
  -u, --home PATH      Override user home directory (default: $HOME)
  -f, --force          Overwrite existing files in ~/.copilot/
  -t, --templates      Also copy .github/templates/ to ~/.copilot/templates/
  -m, --mcp            Register AgentX MCP server in ~/.copilot/mcp-config.json
  -n, --dry-run        Preview without copying
  -h, --help           Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -s|--source) SOURCE="$2"; shift 2;;
    -u|--home) USER_HOME="$2"; shift 2;;
    -f|--force) FORCE=1; shift;;
    -t|--templates) INCLUDE_TEMPLATES=1; shift;;
    -m|--mcp) REGISTER_MCP=1; shift;;
    -n|--dry-run) DRY_RUN=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "[FAIL] Unknown option: $1" >&2; usage; exit 1;;
  esac
done

log_ok()   { printf '[OK] %s\n' "$1"; }
log_skip() { printf '[SKIP] %s\n' "$1"; }
log_info() { printf '[INFO] %s\n' "$1"; }
log_err()  { printf '[FAIL] %s\n' "$1" >&2; }

resolve_source() {
  if [ -n "$SOURCE" ]; then
    SOURCE="$(cd "$SOURCE" && pwd)"
    return
  fi
  local script_dir candidate
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  candidate="$script_dir"
  for _ in 1 2 3 4 5; do
    if [ -d "$candidate/.github/agents" ]; then
      SOURCE="$candidate"
      return
    fi
    candidate="$(dirname "$candidate")"
  done
  log_err 'Cannot auto-detect AgentX source. Use --source.'
  exit 1
}

copy_tree() {
  local src="$1" dest="$2"
  local copied=0 skipped=0
  if [ ! -d "$src" ]; then
    log_err "Source not found: $src"
    printf '%d %d' 0 0
    return
  fi
  while IFS= read -r -d '' file; do
    local rel target target_dir
    rel="${file#$src/}"
    target="$dest/$rel"
    target_dir="$(dirname "$target")"
    [ $DRY_RUN -eq 1 ] || mkdir -p "$target_dir"
    if [ -f "$target" ] && [ $FORCE -ne 1 ]; then
      skipped=$((skipped+1))
      continue
    fi
    if [ $DRY_RUN -eq 1 ]; then
      printf '  [DRY] copy %s -> %s\n' "$rel" "$target" >&2
    else
      cp -f "$file" "$target"
    fi
    copied=$((copied+1))
  done < <(find "$src" -type f -print0)
  printf '%d %d' "$copied" "$skipped"
}

copy_one_file() {
  local src="$1" dest="$2"
  [ -f "$src" ] || { printf '0 0'; return; }
  local dest_dir; dest_dir="$(dirname "$dest")"
  [ $DRY_RUN -eq 1 ] || mkdir -p "$dest_dir"
  if [ -f "$dest" ] && [ $FORCE -ne 1 ]; then
    printf '0 1'; return
  fi
  if [ $DRY_RUN -eq 1 ]; then
    printf '  [DRY] copy %s -> %s\n' "$src" "$dest" >&2
  else
    cp -f "$src" "$dest"
  fi
  printf '1 0'
}

register_mcp() {
  local cfg="$1" repo="$2"
  if ! command -v node >/dev/null 2>&1; then
    log_err 'node is required to register the MCP server. Install Node.js >= 18.'
    return 1
  fi
  if [ $DRY_RUN -eq 1 ]; then
    log_info "[DRY] would register AgentX MCP server in $cfg"
    return
  fi
  mkdir -p "$(dirname "$cfg")"
  AGENTX_REPO="$repo" AGENTX_CFG="$cfg" node - <<'NODE_EOF'
const fs = require('fs');
const path = require('path');
const cfgPath = process.env.AGENTX_CFG;
const repo = process.env.AGENTX_REPO;
let cfg = { mcpServers: {} };
if (fs.existsSync(cfgPath)) {
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
  catch (e) { console.error('[FAIL] Existing ' + cfgPath + ' is not valid JSON.'); process.exit(1); }
}
if (!cfg.mcpServers) cfg.mcpServers = {};
cfg.mcpServers.agentx = {
  command: 'node',
  args: [path.join(repo, '.agentx', 'mcp-server', 'index.js')],
  env: { AGENTX_REPO_ROOT: repo }
};
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('[OK] Registered AgentX MCP server in ' + cfgPath);
NODE_EOF
}

resolve_source
if [ -z "$USER_HOME" ]; then log_err 'Cannot determine HOME.'; exit 1; fi
COPILOT_DIR="$USER_HOME/.copilot"

printf '\n'
printf '=============================================\n'
printf '| AgentX -> Copilot CLI (user-level install)|\n'
printf '=============================================\n'
log_info "Source     : $SOURCE"
log_info "User home  : $USER_HOME"
log_info "Copilot dir: $COPILOT_DIR"
log_info "Force      : $FORCE"
log_info "Templates  : $INCLUDE_TEMPLATES"
log_info "Register MCP: $REGISTER_MCP"
log_info "Dry-run    : $DRY_RUN"
printf '\n'

total_copied=0
total_skipped=0

for pair in \
  "Agents .github/agents agents" \
  "Skills .github/skills skills" \
  "Instructions .github/instructions instructions" \
  "Prompts .github/prompts prompts"; do
  set -- $pair
  label="$1"; src="$2"; dest="$3"
  log_info "Installing ${label,,}..."
  read c s < <(copy_tree "$SOURCE/$src" "$COPILOT_DIR/$dest")
  total_copied=$((total_copied+c))
  total_skipped=$((total_skipped+s))
  log_ok "$label: $c copied, $s skipped"
done

if [ $INCLUDE_TEMPLATES -eq 1 ]; then
  log_info 'Installing templates...'
  read c s < <(copy_tree "$SOURCE/.github/templates" "$COPILOT_DIR/templates")
  total_copied=$((total_copied+c)); total_skipped=$((total_skipped+s))
  log_ok "Templates: $c copied, $s skipped"
fi

for router in AGENTS.md CLAUDE.md Skills.md; do
  read c s < <(copy_one_file "$SOURCE/$router" "$COPILOT_DIR/$router")
  total_copied=$((total_copied+c)); total_skipped=$((total_skipped+s))
done

if [ $DRY_RUN -ne 1 ]; then
  cat > "$COPILOT_DIR/.agentx-version.json" <<JSON
{
  "plugin": "agentx-copilot-cli-user",
  "version": "8.4.60",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "$SOURCE",
  "mcpRegistered": $([ $REGISTER_MCP -eq 1 ] && echo true || echo false)
}
JSON
  log_ok 'Wrote ~/.copilot/.agentx-version.json'
fi

if [ $REGISTER_MCP -eq 1 ]; then
  register_mcp "$COPILOT_DIR/mcp-config.json" "$SOURCE"
fi

printf '\n'
printf '=============================================\n'
printf ' Installed: %d files, skipped %d\n' "$total_copied" "$total_skipped"
printf '=============================================\n\n'
printf 'Next steps:\n'
printf '  1. Start a new Copilot CLI session: copilot   (or: gh copilot)\n'
printf '  2. AgentX agents/skills/instructions are now discovered globally.\n'
if [ $REGISTER_MCP -ne 1 ]; then
  printf '  3. To also expose AgentX CLI as MCP tools, rerun with --mcp.\n'
fi
printf '\n'
