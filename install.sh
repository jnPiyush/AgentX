#!/bin/bash
#
# Install AgentX in your project (Bash version)
#
# Installs all files including agents, instructions, prompts, and VS Code extension.
#
# Usage:
#   ./install.sh           Install all files
#   ./install.sh --force   Overwrite existing files
#
# One-liner installation:
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

REPO_URL="https://raw.githubusercontent.com/jnPiyush/AgentX/master"
TARGET_DIR="$(pwd)"

# Parse arguments
FORCE=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            ;;
    esac
done

# Banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                 ║${NC}"
echo -e "${CYAN}║   ${BOLD}AgentX${NC}${CYAN} - AI Agent Guidelines for Production Code         ║${NC}"
echo -e "${CYAN}║                                                                 ║${NC}"
echo -e "${CYAN}║   Dynamic Multi-agent Workflow & Enterprise-grade Standards     ║${NC}"
echo -e "${CYAN}║                                                                 ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Installing AgentX in your project...${NC}"
echo ""

# Function to download a file
download_file() {
    local src="$1"
    local dest="$2"
    local dest_path="${TARGET_DIR}/${dest}"
    local dest_dir=$(dirname "$dest_path")
    
    # Create directory if needed
    mkdir -p "$dest_dir"
    
    # Skip if exists and not forcing
    if [ -f "$dest_path" ] && [ "$FORCE" = false ]; then
        warn "Skipped (exists): $dest"
        return 0
    fi
    
    # Download
    if curl -fsSL "${REPO_URL}/${src}" -o "$dest_path" 2>/dev/null; then
        success "Downloaded: $dest"
    else
        error "Failed to download: $dest"
    fi
}

# Check for git
if [ ! -d "${TARGET_DIR}/.git" ]; then
    warn "Not a git repository. Some features may not work."
    info "Run 'git init' to initialize a git repository."
fi

# Core files
info "Downloading core files..."
download_file "AGENTS.md" "AGENTS.md"
download_file "Skills.md" "Skills.md"
download_file ".github/copilot-instructions.md" ".github/copilot-instructions.md"
download_file ".github/autonomous-mode.yml" ".github/autonomous-mode.yml"
download_file ".github/orchestration-config.yml" ".github/orchestration-config.yml"
download_file ".github/workflows/agent-orchestrator.yml" ".github/workflows/agent-orchestrator.yml"
download_file ".github/workflows/sync-status-to-labels.yml" ".github/workflows/sync-status-to-labels.yml"
download_file ".github/workflows/test-e2e.yml" ".github/workflows/test-e2e.yml"
download_file ".vscode/settings.json" ".vscode/settings.json"
download_file ".vscode/mcp.json" ".vscode/mcp.json"

# Skills files
info "Downloading skills documentation..."
SKILLS=(
    "01-core-principles.md"
    "02-testing.md"
    "03-error-handling.md"
    "04-security.md"
    "05-performance.md"
    "06-database.md"
    "07-scalability.md"
    "08-code-organization.md"
    "09-api-design.md"
    "10-configuration.md"
    "11-documentation.md"
    "12-version-control.md"
    "13-type-safety.md"
    "14-dependency-management.md"
    "15-logging-monitoring.md"
    "16-remote-git-operations.md"
    "17-ai-agent-development.md"
    "18-code-review-and-audit.md"
)

for skill in "${SKILLS[@]}"; do
    download_file "skills/${skill}" "skills/${skill}"
done

# Download additional files (agents, instructions, prompts)
info "Downloading agents, instructions, and prompts..."

# Agents
download_file "templates/.github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
download_file "templates/.github/agents/architect.agent.md" ".github/agents/architect.agent.md"
download_file "templates/.github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
download_file "templates/.github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
download_file "templates/.github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"

# Instructions
download_file "templates/.github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
download_file "templates/.github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"
download_file "templates/.github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"
download_file "templates/.github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"

# Prompts
download_file "templates/.github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
download_file "templates/.github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
download_file "templates/.github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"

# Install git hooks
info "Installing git hooks..."
if [ -d ".git" ]; then
    HOOKS_DIR=".git/hooks"
    SOURCE_HOOKS_DIR=".github/hooks"
    
    if [ -d "$SOURCE_HOOKS_DIR" ]; then
        for hook in pre-commit commit-msg; do
            if [ -f "$SOURCE_HOOKS_DIR/$hook" ]; then
                cp "$SOURCE_HOOKS_DIR/$hook" "$HOOKS_DIR/$hook"
                chmod +x "$HOOKS_DIR/$hook"
                success "Installed $hook hook"
            fi
        done
        success "Git hooks installed successfully"
    else
        warn "Hooks directory not found. Skipping hooks installation."
    fi
else
    warn "Not a git repository. Skipping hooks installation."
fi

echo ""
echo -e "${CYAN}${BOLD}Next Steps${NC}"
echo ""
echo "1. Review and customize .github/autonomous-mode.yml"
echo "2. Add your GitHub username to the allowed_actors list"
echo "3. Create GitHub labels by running:"
echo ""
echo -e "${YELLOW}   gh label create \"type:task\" --description \"Atomic unit of work\" --color \"0E8A16\"${NC}"
echo -e "${YELLOW}   gh label create \"type:feature\" --description \"User-facing capability\" --color \"A2EEEF\"${NC}"
echo -e "${YELLOW}   gh label create \"status:ready\" --description \"No blockers, can start\" --color \"C2E0C6\"${NC}"
echo -e "${YELLOW}   gh label create \"status:in-progress\" --description \"Currently working\" --color \"FBCA04\"${NC}"
echo -e "${YELLOW}   gh label create \"status:done\" --description \"Completed\" --color \"0E8A16\"${NC}"
echo -e "${YELLOW}   gh label create \"priority:p1\" --description \"High - do next\" --color \"D93F0B\"${NC}"
echo ""
echo "   # Orchestration labels (required for multi-agent workflows):"
echo -e "${YELLOW}   gh label create \"type:epic\" --description \"Large initiative (multiple features)\" --color \"5319E7\"${NC}"
echo -e "${YELLOW}   gh label create \"needs:ux\" --description \"Requires UX design work\" --color \"C5DEF5\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:pm-done\" --description \"Product Manager work complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:architect-done\" --description \"Architect work complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:ux-done\" --description \"UX Designer work complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:engineer-done\" --description \"Engineer work complete\" --color \"BFD4F2\"${NC}"
echo ""
echo "4. Read AGENTS.md for workflow guidelines"
echo "5. Check Skills.md for production standards"
echo "6. Review .github/orchestration-config.yml for multi-agent orchestration settings"
echo "7. MCP Server is pre-configured (requires VS Code 1.101+ and GitHub Copilot)"
echo ""
success "AgentX installed successfully! 🚀"
echo ""

