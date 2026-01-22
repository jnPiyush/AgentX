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
download_file "README.md" "README.md"
download_file "LICENSE" "LICENSE"
download_file "AGENTS.md" "AGENTS.md"
download_file "Skills.md" "Skills.md"
download_file "CONTRIBUTING.md" "CONTRIBUTING.md"
download_file ".github/copilot-instructions.md" ".github/copilot-instructions.md"

# Security configuration (4-layer architecture)
info "Downloading security configuration..."
download_file ".github/CODEOWNERS" ".github/CODEOWNERS"
download_file ".github/agentx-security.yml" ".github/agentx-security.yml"

# Orchestration and workflows
download_file ".github/orchestration-config.yml" ".github/orchestration-config.yml"
download_file ".github/workflows/agent-orchestrator.yml" ".github/workflows/agent-orchestrator.yml"
download_file ".github/workflows/test-e2e.yml" ".github/workflows/test-e2e.yml"

# Git hooks
info "Downloading git hooks..."
download_file ".github/hooks/pre-commit" ".github/hooks/pre-commit"
download_file ".github/hooks/commit-msg" ".github/hooks/commit-msg"

# Scripts
info "Downloading helper scripts..."
download_file ".github/scripts/validate-handoff.ps1" ".github/scripts/validate-handoff.ps1"
download_file ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
download_file ".github/scripts/capture-context.ps1" ".github/scripts/capture-context.ps1"
download_file ".github/scripts/capture-context.sh" ".github/scripts/capture-context.sh"

# Issue and PR templates
info "Downloading issue and PR templates..."
download_file ".github/ISSUE_TEMPLATE/epic.yml" ".github/ISSUE_TEMPLATE/epic.yml"
download_file ".github/ISSUE_TEMPLATE/feature.yml" ".github/ISSUE_TEMPLATE/feature.yml"
download_file ".github/ISSUE_TEMPLATE/story.yml" ".github/ISSUE_TEMPLATE/story.yml"
download_file ".github/ISSUE_TEMPLATE/bug.yml" ".github/ISSUE_TEMPLATE/bug.yml"
download_file ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"

# VS Code and docs
info "Downloading configuration and documentation..."
download_file ".vscode/mcp.json" ".vscode/mcp.json"
download_file "docs/mcp-integration.md" "docs/mcp-integration.md"
download_file "docs/project-setup.md" "docs/project-setup.md"
download_file "docs/technical-specification.md" "docs/technical-specification.md"
download_file "docs/architecture-hybrid-orchestration.md" "docs/architecture-hybrid-orchestration.md"
download_file "docs/context-engineering.md" "docs/context-engineering.md"

# Skills files (new structure: .github/skills/<skill-name>/SKILL.md)
info "Downloading skills documentation..."
SKILLS=(
    ".github/skills/core-principles/SKILL.md"
    ".github/skills/testing/SKILL.md"
    ".github/skills/error-handling/SKILL.md"
    ".github/skills/security/SKILL.md"
    ".github/skills/performance/SKILL.md"
    ".github/skills/database/SKILL.md"
    ".github/skills/scalability/SKILL.md"
    ".github/skills/code-organization/SKILL.md"
    ".github/skills/api-design/SKILL.md"
    ".github/skills/configuration/SKILL.md"
    ".github/skills/documentation/SKILL.md"
    ".github/skills/version-control/SKILL.md"
    ".github/skills/type-safety/SKILL.md"
    ".github/skills/dependency-management/SKILL.md"
    ".github/skills/logging-monitoring/SKILL.md"
    ".github/skills/remote-git-operations/SKILL.md"
    ".github/skills/ai-agent-development/SKILL.md"
    ".github/skills/code-review-and-audit/SKILL.md"
)

for skill in "${SKILLS[@]}"; do
    download_file "${skill}" "${skill}"
done

# Download additional files (agents, instructions, prompts)
info "Downloading agents, instructions, and prompts..."

# Agents
download_file ".github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
download_file ".github/agents/architect.agent.md" ".github/agents/architect.agent.md"
download_file ".github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"
download_file ".github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
download_file ".github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
download_file ".github/agents/orchestrator.agent.md" ".github/agents/orchestrator.agent.md"

# Templates
info "Downloading templates..."
download_file ".github/templates/ADR-TEMPLATE.md" ".github/templates/ADR-TEMPLATE.md"
download_file ".github/templates/SPEC-TEMPLATE.md" ".github/templates/SPEC-TEMPLATE.md"
download_file ".github/templates/PRD-TEMPLATE.md" ".github/templates/PRD-TEMPLATE.md"
download_file ".github/templates/UX-TEMPLATE.md" ".github/templates/UX-TEMPLATE.md"
download_file ".github/templates/REVIEW-TEMPLATE.md" ".github/templates/REVIEW-TEMPLATE.md"
download_file ".github/templates/README.md" ".github/templates/README.md"

# Instructions
download_file ".github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
download_file ".github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"
download_file ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"
download_file ".github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"

# Prompts
download_file ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
download_file ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
download_file ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"

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
echo "1. Review AGENTS.md for the complete workflow: PM → UX → Architect → Engineer → Reviewer"
echo ""
echo "2. Create GitHub labels by running:"
echo ""
echo "   # Type labels (required - determines agent role):"
echo -e "${YELLOW}   gh label create \"type:epic\" --description \"Large initiative (multiple features)\" --color \"5319E7\"${NC}"
echo -e "${YELLOW}   gh label create \"type:feature\" --description \"User-facing capability\" --color \"A2EEEF\"${NC}"
echo -e "${YELLOW}   gh label create \"type:story\" --description \"Implementation task\" --color \"0E8A16\"${NC}"
echo -e "${YELLOW}   gh label create \"type:bug\" --description \"Something broken\" --color \"D73A4A\"${NC}"
echo -e "${YELLOW}   gh label create \"type:spike\" --description \"Research/investigation\" --color \"EDEDED\"${NC}"
echo -e "${YELLOW}   gh label create \"type:docs\" --description \"Documentation only\" --color \"0075CA\"${NC}"
echo ""
echo "   # Orchestration labels (sequential handoffs: PM→UX→Architect→Engineer):"
echo -e "${YELLOW}   gh label create \"orch:pm-done\" --description \"PM: PRD + Backlog complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:ux-done\" --description \"UX: Wireframes + Prototypes + Personas complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:architect-done\" --description \"Architect: ADR + Specs + Architecture complete\" --color \"BFD4F2\"${NC}"
echo -e "${YELLOW}   gh label create \"orch:engineer-done\" --description \"Engineer: Code + Tests complete\" --color \"BFD4F2\"${NC}"
echo ""
echo "   # Priority labels:"
echo -e "${YELLOW}   gh label create \"priority:p0\" --description \"Critical\" --color \"D93F0B\"${NC}"
echo -e "${YELLOW}   gh label create \"priority:p1\" --description \"High - do next\" --color \"FBCA04\"${NC}"
echo -e "${YELLOW}   gh label create \"priority:p2\" --description \"Medium\" --color \"FEF2C0\"${NC}"
echo -e "${YELLOW}   gh label create \"priority:p3\" --description \"Low\" --color \"C5DEF5\"${NC}"
echo ""
echo "   # Workflow labels:"
echo -e "${YELLOW}   gh label create \"needs:ux\" --description \"Requires UX design work\" --color \"C5DEF5\"${NC}"
echo -e "${YELLOW}   gh label create \"needs:help\" --description \"Blocked or needs assistance\" --color \"D93F0B\"${NC}"
echo -e "${YELLOW}   gh label create \"needs:changes\" --description \"Reviewer requested changes\" --color \"FBCA04\"${NC}"
echo -e "${YELLOW}   gh label create \"needs:fixes\" --description \"Tests failing, needs fixes\" --color \"D93F0B\"${NC}"
echo ""
echo "3. Set up GitHub Project v2 with Status field (see docs/project-setup.md)"
echo "   Status values: Backlog, In Progress, In Review, Done, Ready (optional)"
echo ""
echo "4. Check Skills.md for 18 production code skills"
echo "5. Review .github/orchestration-config.yml for multi-agent orchestration settings"
echo "6. Read docs/mcp-integration.md for GitHub MCP Server setup (requires VS Code 1.101+ and GitHub Copilot)"
echo "7. Review docs/architecture-hybrid-orchestration.md for 3-layer hybrid architecture"
echo "8. Install agent definition files (optional):"
echo "   .github/agents/{product-manager,ux-designer,architect,engineer,reviewer,orchestrator}.agent.md"
echo ""
success "AgentX installed successfully! 🚀"
echo ""
echo -e "${GREEN}Workflow: PM creates PRD+Backlog → UX creates Wireframes+Prototypes+Personas →${NC}"
echo -e "${GREEN}          Architect creates ADR+Specs+Architecture → Engineer creates Low-level Design+Code+Tests${NC}"
echo ""

