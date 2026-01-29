#!/bin/bash
# Install AgentX in your project
#
# Usage:
#   ./install.sh
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

set -e

REPO_URL="https://raw.githubusercontent.com/jnPiyush/AgentX/master"
FORCE=${FORCE:-false}
DETECTED_REPO=""  # Store detected repo to avoid asking twice

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to detect GitHub repo from existing remote
detect_github_repo() {
    if [ -d ".git" ]; then
        local remoteUrl=$(git remote get-url origin 2>/dev/null)
        if [[ $remoteUrl =~ github\.com[:/]([^/]+)/([^/\.]+) ]]; then
            echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
        fi
    fi
}

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

# Pre-installation validation
echo -e "${YELLOW}Running pre-installation checks...${NC}"
echo ""

# Auto-detect repository
DETECTED_REPO=$(detect_github_repo)
if [ -n "$DETECTED_REPO" ]; then
    echo -e "${GREEN}✓ Detected GitHub repository: $DETECTED_REPO${NC}"
fi

# Check 1: Git repository
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}❌ Not a git repository${NC}"
    echo ""
    echo -e "${YELLOW}AgentX requires a Git repository to work.${NC}"
    echo -e "${CYAN}Initialize one with: git init${NC}"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ Git repository detected${NC}"

# Check 2: GitHub remote (optional - can setup later)
if git remote -v 2>/dev/null | grep -q "github\.com"; then
    echo -e "${GREEN}✓ GitHub remote configured${NC}"
else
    echo -e "${YELLOW}⚠️  No GitHub remote configured${NC}"
    echo ""
    echo -e "\033[90mAgentX requires GitHub for Issues, Projects, and Workflows.${NC}"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo -e "${CYAN}  [1] Set up GitHub remote now${NC}"
    echo -e "${CYAN}  [2] Continue and set up later${NC}"
    echo -e "${CYAN}  [3] Cancel installation${NC}"
    echo ""
    read -p "Choose (1/2/3): " -n 1 -r
    echo ""
    
    if [[ $REPLY == "1" ]]; then
        # Only ask if not already detected
        if [ -z "$DETECTED_REPO" ]; then
            read -p "Enter GitHub repository (URL or owner/repo): " repoInput
            if [[ -n $repoInput ]]; then
                DETECTED_REPO="$repoInput"
            fi
        else
            echo -e "${CYAN}Using detected repository: $DETECTED_REPO${NC}"
        fi

        if [[ -n $DETECTED_REPO ]]; then
            # Handle both URL and owner/repo formats
            if [[ $DETECTED_REPO =~ ^(https?://|git@) ]]; then
                repoUrl="$DETECTED_REPO"
            elif [[ $DETECTED_REPO =~ ^[^/]+/[^/]+$ ]]; then
                repoUrl="https://github.com/$DETECTED_REPO.git"
            else
                echo -e "${YELLOW}⚠️  Unrecognized format. Skipping remote setup.${NC}"
                repoUrl=""
            fi

            if [[ -n $repoUrl ]] && git remote add origin "$repoUrl" 2>/dev/null; then
                echo -e "${GREEN}✓ GitHub remote configured: $repoUrl${NC}"
            elif [[ -n $repoUrl ]]; then
                echo -e "${YELLOW}⚠️  Failed to add remote. You can do it manually later.${NC}"
            fi
        fi
    elif [[ ! $REPLY =~ ^[2]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 1
    fi
fi

# Check 3: GitHub CLI (optional - can install later)
if command -v gh &> /dev/null; then
    echo -e "${GREEN}✓ GitHub CLI (gh) detected${NC}"
else
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) not found${NC}"
    echo ""
    echo -e "\033[90mGitHub CLI is recommended for the Issue-First Workflow.${NC}"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo -e "${CYAN}  [1] Install GitHub CLI now (auto-detect package manager)${NC}"
    echo -e "${CYAN}  [2] Continue and install later${NC}"
    echo -e "${CYAN}  [3] Cancel installation${NC}"
    echo ""
    read -p "Choose (1/2/3): " -n 1 -r
    echo ""
    
    if [[ $REPLY == "1" ]]; then
        echo -e "${YELLOW}Installing GitHub CLI...${NC}"
        
        # Detect package manager and install
        if command -v brew &> /dev/null; then
            echo -e "${YELLOW}Using Homebrew...${NC}"
            brew install gh
        elif command -v apt-get &> /dev/null; then
            echo -e "${YELLOW}Using apt...${NC}"
            (type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
            && sudo mkdir -p -m 755 /etc/apt/keyrings \
            && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
            && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
            && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
            && sudo apt update \
            && sudo apt install gh -y
        elif command -v yum &> /dev/null; then
            echo -e "${YELLOW}Using yum...${NC}"
            sudo yum install -y gh
        else
            echo -e "${YELLOW}⚠️  No supported package manager found. Install manually from: https://cli.github.com/${NC}"
        fi
        
        if command -v gh &> /dev/null; then
            echo -e "${GREEN}✓ GitHub CLI installed! Restart your terminal after installation completes.${NC}"
        else
            echo -e "${YELLOW}⚠️  Installation failed. Install manually from: https://cli.github.com/${NC}"
        fi
    elif [[ ! $REPLY =~ ^[2]$ ]]; then
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 1
    fi
fi

# Check 4: GitHub Projects V2 (setup after installation)
echo ""
echo -e "${CYAN}ℹ️  GitHub Projects V2 - Setup Required${NC}"
echo ""
echo -e "\033[90mAgentX requires a GitHub Project (V2) with Status field values:${NC}"
echo -e "${CYAN}  • Backlog, In Progress, In Review, Ready, Done${NC}"
echo ""
echo -e "${YELLOW}Options:${NC}"
echo -e "${CYAN}  [1] Create GitHub Project V2 now (requires gh CLI + auth)${NC}"
echo -e "${CYAN}  [2] Set up manually later${NC}"
echo ""
read -p "Choose (1/2): " -n 1 -r
echo ""

if [[ $REPLY == "1" ]]; then
    if command -v gh &> /dev/null; then
        # Use detected repo or ask
        repo="$DETECTED_REPO"
        if [ -z "$repo" ]; then
            read -p "Enter repository (format: owner/repo): " repo
        else
            echo -e "${CYAN}Using repository: $repo${NC}"
        fi

        if [[ -n $repo ]]; then
            echo -e "${YELLOW}Creating GitHub Project V2...${NC}"
            
            # Get owner node_id
            ownerId=$(gh api /repos/$repo --jq '.owner.node_id' 2>/dev/null)
            
            if [[ -n $ownerId ]]; then
                # Create project
                projectName="AgentX Workflow"
                result=$(gh api graphql -f query="mutation { createProjectV2(input: {ownerId: \"$ownerId\", title: \"$projectName\"}) { projectV2 { id number } } }" 2>&1)
                
                projectNumber=$(echo "$result" | grep -oP '"number":\K[0-9]+')
                
                if [[ -n $projectNumber ]]; then
                    echo -e "${GREEN}✓ Project created! Number: #$projectNumber${NC}"
                    echo -e "${CYAN}Visit: https://github.com/$repo/projects/$projectNumber${NC}"
                    echo ""
                    echo -e "${YELLOW}⚠️  Manual step required: Add Status field with these values:${NC}"
                    echo -e "${CYAN}     Backlog, In Progress, In Review, Ready, Done${NC}"
                else
                    echo -e "${YELLOW}⚠️  Auto-creation failed. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
                fi
            else
                echo -e "${YELLOW}⚠️  Could not access repository. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  GitHub CLI not available. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
    fi
else
    echo -e "\033[90mGuide: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
fi
echo ""

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
download_file ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"

# Workflows
echo -e "${CYAN}  GitHub Actions workflows...${NC}"
download_file ".github/workflows/agent-x.yml" ".github/workflows/agent-x.yml"
download_file ".github/workflows/quality-gates.yml" ".github/workflows/quality-gates.yml"

# Git hooks
echo -e "${CYAN}  Git hooks...${NC}"
download_file ".github/hooks/pre-commit" ".github/hooks/pre-commit"
download_file ".github/hooks/pre-commit.ps1" ".github/hooks/pre-commit.ps1"
download_file ".github/hooks/commit-msg" ".github/hooks/commit-msg"

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
download_file ".github/agents/agent-x.agent.md" ".github/agents/agent-x.agent.md"

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

# Validation scripts
echo -e "${CYAN}  Validation scripts...${NC}"
download_file ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
download_file ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"

# Prompts
echo -e "${CYAN}  Prompt templates...${NC}"
download_file ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
download_file ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
download_file ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"

# Skills (25 production skills organized by category)
echo -e "${CYAN}  Production skills (25 skills)...${NC}"

# Architecture skills
for skill in core-principles security performance database scalability code-organization api-design; do
    download_file ".github/skills/architecture/$skill/SKILL.md" ".github/skills/architecture/$skill/SKILL.md"
done

# Development skills
for skill in testing error-handling configuration documentation version-control type-safety dependency-management logging-monitoring code-review-and-audit csharp python frontend-ui react blazor postgresql sql-server; do
    download_file ".github/skills/development/$skill/SKILL.md" ".github/skills/development/$skill/SKILL.md"
done

# Operations skills
download_file ".github/skills/operations/remote-git-operations/SKILL.md" ".github/skills/operations/remote-git-operations/SKILL.md"

# AI Systems skills
download_file ".github/skills/ai-systems/ai-agent-development/SKILL.md" ".github/skills/ai-systems/ai-agent-development/SKILL.md"

# VS Code configuration
echo -e "${CYAN}  VS Code configuration...${NC}"
download_file ".vscode/mcp.json" ".vscode/mcp.json"
download_file ".vscode/settings.json" ".vscode/settings.json"

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
