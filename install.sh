#!/bin/bash
# Install AgentX in your project
#
# Usage:
#   ./install.sh
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

set -e

REPO_URL="https://raw.githubusercontent.com/jnPiyush/AgentX/master"
FORCE=${FORCE:-false}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

download_file() {
    local src=$1
    local dest=$2
    local dir=$(dirname "$dest")
    
    [ -n "$dir" ] && mkdir -p "$dir"
    
    if [ -f "$dest" ] && [ "$FORCE" != "true" ]; then
        echo -e "${YELLOW}⚠ Skipped (exists): $dest${NC}"
        return
    fi
    
    if curl -fsSL "$REPO_URL/$src" -o "$dest" 2>/dev/null; then
        echo -e "${GREEN}✓ Downloaded: $dest${NC}"
    else
        echo -e "${YELLOW}⚠ Failed: $src${NC}"
    fi
}

# Banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  AgentX - AI Agent Guidelines for Production Code ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Check for git
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠ Not a git repository. Run 'git init' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing AgentX files...${NC}"
echo ""

# Core documentation
echo -e "${CYAN}  Core documentation...${NC}"
download_file "AGENTS.md" "AGENTS.md"
download_file "Skills.md" "Skills.md"
download_file "CONTRIBUTING.md" "CONTRIBUTING.md"

# GitHub configuration
echo -e "${CYAN}  GitHub configuration...${NC}"
download_file ".github/copilot-instructions.md" ".github/copilot-instructions.md"
download_file ".github/CODEOWNERS" ".github/CODEOWNERS"
download_file ".github/agentx-security.yml" ".github/agentx-security.yml"
download_file ".github/orchestration-config.yml" ".github/orchestration-config.yml"
download_file ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"

# Workflows
echo -e "${CYAN}  GitHub Actions workflows...${NC}"
download_file ".github/workflows/agent-orchestrator.yml" ".github/workflows/agent-orchestrator.yml"
download_file ".github/workflows/quality-gates.yml" ".github/workflows/quality-gates.yml"

# Git hooks
echo -e "${CYAN}  Git hooks...${NC}"
download_file ".github/hooks/pre-commit" ".github/hooks/pre-commit"
download_file ".github/hooks/commit-msg" ".github/hooks/commit-msg"

# Scripts
echo -e "${CYAN}  Scripts...${NC}"
download_file ".github/scripts/validate-handoff.ps1" ".github/scripts/validate-handoff.ps1"
download_file ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
download_file ".github/scripts/capture-context.ps1" ".github/scripts/capture-context.ps1"
download_file ".github/scripts/capture-context.sh" ".github/scripts/capture-context.sh"

# Issue templates
echo -e "${CYAN}  Issue templates...${NC}"
download_file ".github/ISSUE_TEMPLATE/config.yml" ".github/ISSUE_TEMPLATE/config.yml"
download_file ".github/ISSUE_TEMPLATE/epic.yml" ".github/ISSUE_TEMPLATE/epic.yml"
download_file ".github/ISSUE_TEMPLATE/feature.yml" ".github/ISSUE_TEMPLATE/feature.yml"
download_file ".github/ISSUE_TEMPLATE/story.yml" ".github/ISSUE_TEMPLATE/story.yml"
download_file ".github/ISSUE_TEMPLATE/bug.yml" ".github/ISSUE_TEMPLATE/bug.yml"
download_file ".github/ISSUE_TEMPLATE/spike.yml" ".github/ISSUE_TEMPLATE/spike.yml"
download_file ".github/ISSUE_TEMPLATE/docs.yml" ".github/ISSUE_TEMPLATE/docs.yml"

# Agent definitions
echo -e "${CYAN}  Agent definitions...${NC}"
download_file ".github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
download_file ".github/agents/architect.agent.md" ".github/agents/architect.agent.md"
download_file ".github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"
download_file ".github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
download_file ".github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
download_file ".github/agents/orchestrator.agent.md" ".github/agents/orchestrator.agent.md"

# Document templates
echo -e "${CYAN}  Document templates...${NC}"
download_file ".github/templates/PRD-TEMPLATE.md" ".github/templates/PRD-TEMPLATE.md"
download_file ".github/templates/ADR-TEMPLATE.md" ".github/templates/ADR-TEMPLATE.md"
download_file ".github/templates/SPEC-TEMPLATE.md" ".github/templates/SPEC-TEMPLATE.md"
download_file ".github/templates/UX-TEMPLATE.md" ".github/templates/UX-TEMPLATE.md"
download_file ".github/templates/REVIEW-TEMPLATE.md" ".github/templates/REVIEW-TEMPLATE.md"

# Instructions
echo -e "${CYAN}  Coding instructions...${NC}"
download_file ".github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"
download_file ".github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
download_file ".github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"
download_file ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"

# Prompts
echo -e "${CYAN}  Prompt templates...${NC}"
download_file ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
download_file ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
download_file ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"

# Skills (18 production skills)
echo -e "${CYAN}  Production skills (18 skills)...${NC}"
skills=(
    "core-principles" "testing" "error-handling" "security"
    "performance" "database" "scalability" "code-organization"
    "api-design" "configuration" "documentation" "version-control"
    "type-safety" "dependency-management" "logging-monitoring"
    "remote-git-operations" "ai-agent-development" "code-review-and-audit"
)
for skill in "${skills[@]}"; do
    download_file ".github/skills/$skill/SKILL.md" ".github/skills/$skill/SKILL.md"
done

# VS Code configuration
echo -e "${CYAN}  VS Code configuration...${NC}"
download_file ".vscode/mcp.json" ".vscode/mcp.json"

# Documentation
echo -e "${CYAN}  Documentation...${NC}"
download_file "docs/mcp-integration.md" "docs/mcp-integration.md"
download_file "docs/project-setup.md" "docs/project-setup.md"

# Create output directories
echo -e "${CYAN}  Creating output directories...${NC}"
for dir in docs/prd docs/adr docs/specs docs/ux docs/reviews; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GREEN}✓ Created: $dir/${NC}"
    fi
done

# Install git hooks
echo ""
echo -e "${CYAN}  Installing git hooks...${NC}"
if [ -d ".github/hooks" ]; then
    for hook in pre-commit commit-msg; do
        if [ -f ".github/hooks/$hook" ]; then
            cp ".github/hooks/$hook" ".git/hooks/$hook"
            chmod +x ".git/hooks/$hook"
            echo -e "${GREEN}✓ Installed: $hook hook${NC}"
        fi
    done
fi

# Install Git hooks
echo ""
echo -e "${CYAN}Installing Git hooks...${NC}"
if [ -d ".git" ]; then
    HOOKS_DIR=".git/hooks"
    
    # Copy pre-commit hook
    if [ -f ".github/hooks/pre-commit" ]; then
        cp ".github/hooks/pre-commit" "$HOOKS_DIR/pre-commit"
        chmod +x "$HOOKS_DIR/pre-commit"
        echo -e "${GREEN}✓ Installed: pre-commit hook${NC}"
    fi
    
    # Copy commit-msg hook
    if [ -f ".github/hooks/commit-msg" ]; then
        cp ".github/hooks/commit-msg" "$HOOKS_DIR/commit-msg"
        chmod +x "$HOOKS_DIR/commit-msg"
        echo -e "${GREEN}✓ Installed: commit-msg hook${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}  Git hooks enforce AgentX workflow compliance:${NC}"
    echo "  • Issue number required in commit messages"
    echo "  • PRD required before Epic implementation"
    echo "  • ADR + Tech Spec required before Feature implementation"
    echo "  • UX design required when needs:ux label present"
    echo "  • No secrets in code"
    echo "  • Code formatting"
else
    echo -e "${YELLOW}⚠ Not a Git repository - skipping hook installation${NC}"
    echo "  Run 'git init' first to enable workflow enforcement"
fi

# Done
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  AgentX installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Read AGENTS.md for workflow guidelines"
echo "  2. Read Skills.md for production code standards"
echo "  3. Create GitHub labels:"
echo ""
echo -e "${YELLOW}     # Type labels${NC}"
echo '     gh label create "type:epic" --color "5319E7"'
echo '     gh label create "type:feature" --color "A2EEEF"'
echo '     gh label create "type:story" --color "0E8A16"'
echo '     gh label create "type:bug" --color "D73A4A"'
echo '     gh label create "type:spike" --color "FBCA04"'
echo '     gh label create "type:docs" --color "0075CA"'
echo ""
echo -e "${YELLOW}     # Workflow labels${NC}"
echo '     gh label create "needs:ux" --color "D4C5F9"'
echo '     gh label create "needs:changes" --color "FBCA04"'
echo '     gh label create "needs:help" --color "D73A4A"'
echo ""
echo "  4. Set up GitHub Project with Status field (see docs/project-setup.md)"
echo ""
echo -e "${YELLOW}  ⚠️  IMPORTANT: Git hooks are now active!${NC}"
echo "  Your commits will be validated for workflow compliance."
echo ""
