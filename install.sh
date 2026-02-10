#!/bin/bash
# Install AgentX v3.0.0 in your project
#
# New in v3.0: Agent analytics, auto-fix reviewer, prompt engineering,
# cross-repo orchestration, CLI spec, agent memory, visualization.
# Includes all v2.1 features: maturity levels, constraint-based design,
# handoff buttons, input variables, context clearing, and adaptive mode.
#
# Usage:
#   ./install.sh
#   curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

set -e

REPO_URL="https://raw.githubusercontent.com/jnPiyush/AgentX/master"
FORCE=${FORCE:-false}
DETECTED_REPO=""  # Store detected repo to avoid asking twice
SKIP_GIT_CHECKS=false
USE_LOCAL_MODE=false

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
        echo -e "${YELLOW}[SKIP] Skipped (exists): $dest${NC}"
        return
    fi
    
    if curl -fsSL "$REPO_URL/$src" -o "$dest" 2>/dev/null; then
        echo -e "${GREEN}[OK] Downloaded: $dest${NC}"
    else
        echo -e "${YELLOW}[WARN] Failed: $src${NC}"
    fi
}

# Banner
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  AgentX v3.0.0 - Multi-Agent Orchestration       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}New: Analytics, auto-fix reviewer, prompt engineering, adaptive mode${NC}"
echo ""

# Pre-installation validation
echo -e "${YELLOW}Running pre-installation checks...${NC}"
echo ""

# Auto-detect repository
DETECTED_REPO=$(detect_github_repo)
if [ -n "$DETECTED_REPO" ]; then
    echo -e "${GREEN}[OK] Detected GitHub repository: $DETECTED_REPO${NC}"
fi

# Check 1: Git repository
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}[ERROR] Not a git repository${NC}"
    echo ""
    echo -e "${YELLOW}AgentX works best in a Git repository for hooks and workflows.${NC}"
    echo -e "${YELLOW}Options:${NC}"
    echo -e "${CYAN}  [1] Initialize Git repository now${NC}"
    echo -e "${CYAN}  [2] Continue without Git (limited features)${NC}"
    echo -e "${CYAN}  [3] Cancel installation${NC}"
    echo ""
    read -p "Choose (1/2/3): " -n 1 -r
    echo ""

    if [[ $REPLY == "1" ]]; then
        if git init 2>/dev/null; then
            echo -e "${GREEN}[OK] Initialized Git repository${NC}"

            # Ask for repo only if not already detected
            if [ -z "$DETECTED_REPO" ]; then
                read -p "Enter GitHub repository (URL or owner/repo). Press Enter to skip: " repoInput
                if [[ -n $repoInput ]]; then
                    DETECTED_REPO="$repoInput"
                fi
            fi

            if [[ -n $DETECTED_REPO ]]; then
                if [[ $DETECTED_REPO =~ ^(https?://|git@) ]]; then
                    repoUrl="$DETECTED_REPO"
                elif [[ $DETECTED_REPO =~ ^[^/]+/[^/]+$ ]]; then
                    repoUrl="https://github.com/$DETECTED_REPO.git"
                else
                    repoUrl=""
                fi

                if [[ -n $repoUrl ]] && git remote add origin "$repoUrl" 2>/dev/null; then
                    echo -e "${GREEN}✓ GitHub remote configured: $repoUrl${NC}"
                elif [[ -n $repoUrl ]]; then
                    echo -e "${YELLOW}⚠️  Failed to add remote. You can set it manually later.${NC}"
                else
                    echo -e "${YELLOW}[WARN] Unrecognized repository format. Skipping remote setup.${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}[WARN] Could not initialize a Git repository. Continuing without Git.${NC}"
            SKIP_GIT_CHECKS=true
        fi
    elif [[ $REPLY == "2" ]]; then
        SKIP_GIT_CHECKS=true
        echo -e "${YELLOW}[WARN] Proceeding without Git; some features will be skipped.${NC}"
    else
        echo -e "${YELLOW}Installation cancelled.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[OK] Git repository detected${NC}"
fi

# Check 2: GitHub remote (optional - can use Local Mode)
if [ "$SKIP_GIT_CHECKS" != "true" ] && [ -d ".git" ]; then
    if git remote -v 2>/dev/null | grep -q "github\.com"; then
        echo -e "${GREEN}[OK] GitHub remote configured${NC}"
    else
        echo -e "${YELLOW}[WARN] No GitHub remote configured${NC}"
        echo ""
        echo -e "\033[90mAgentX can work in two modes:${NC}"
        echo ""
        echo -e "${YELLOW}Options:${NC}"
        echo -e "${CYAN}  [1] Set up GitHub remote (GitHub Mode - full features)${NC}"
        echo -e "${CYAN}  [2] Use Local Mode (filesystem-based issue tracking)${NC}"
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
                    echo -e "${YELLOW}[WARN] Unrecognized format. Skipping remote setup.${NC}"
                    repoUrl=""
                fi

                if [[ -n $repoUrl ]] && git remote add origin "$repoUrl" 2>/dev/null; then
                    echo -e "${GREEN}✓ GitHub remote configured: $repoUrl${NC}"
                elif [[ -n $repoUrl ]]; then
                    echo -e "${YELLOW}⚠️  Failed to add remote. You can do it manually later.${NC}"
                fi
            fi
        elif [[ $REPLY == "2" ]]; then
            USE_LOCAL_MODE=true
            echo -e "${GREEN}[OK] Local Mode enabled - using filesystem-based issue tracking${NC}"
        else
            echo -e "${YELLOW}Installation cancelled.${NC}"
            exit 1
        fi
    fi
elif [ "$SKIP_GIT_CHECKS" = "true" ]; then
    echo -e "${YELLOW}[WARN] Skipping GitHub remote setup because Git was not initialized.${NC}"
    USE_LOCAL_MODE=true
    echo -e "${GREEN}[OK] Local Mode enabled - using filesystem-based issue tracking${NC}"
fi

# Check 3: GitHub CLI (optional - can install later) - Skip in Local Mode
if [ "$USE_LOCAL_MODE" != "true" ]; then
    if command -v gh &> /dev/null; then
        echo -e "${GREEN}[OK] GitHub CLI (gh) detected${NC}"
    else
        echo -e "${YELLOW}[WARN] GitHub CLI (gh) not found${NC}"
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
                echo -e "${YELLOW}[WARN] No supported package manager found. Install manually from: https://cli.github.com/${NC}"
            fi

            if command -v gh &> /dev/null; then
                echo -e "${GREEN}[OK] GitHub CLI installed! Restart your terminal after installation completes.${NC}"
            else
                echo -e "${YELLOW}[WARN] Installation failed. Install manually from: https://cli.github.com/${NC}"
            fi
        elif [[ ! $REPLY =~ ^[2]$ ]]; then
            echo -e "${YELLOW}Installation cancelled.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${GREEN}[OK] Local Mode - GitHub CLI not required${NC}"
fi

# Check 4: GitHub Projects V2 (setup after installation) - Skip in Local Mode
if [ "$USE_LOCAL_MODE" != "true" ]; then
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
                        echo -e "${GREEN}[OK] Project created! Number: #$projectNumber${NC}"
                        echo -e "${CYAN}Visit: https://github.com/$repo/projects/$projectNumber${NC}"
                        echo ""
                        echo -e "${YELLOW}[INFO] Manual step required: Add Status field with these values:${NC}"
                        echo -e "${CYAN}     Backlog, In Progress, In Review, Ready, Done${NC}"
                    else
                        echo -e "${YELLOW}[WARN] Auto-creation failed. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
                    fi
                else
                    echo -e "${YELLOW}[WARN] Could not access repository. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  GitHub CLI not available. Set up manually: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
        fi
    else
        echo -e "\033[90mGuide: https://docs.github.com/en/issues/planning-and-tracking-with-projects${NC}"
    fi
else
    echo -e "${GREEN}[OK] Local Mode - Status tracking via filesystem${NC}"
fi
echo ""

echo -e "${YELLOW}Installing AgentX files...${NC}"
echo ""

# Core documentation
echo -e "${CYAN}  Core documentation...${NC}"
download_file "AGENTS.md" "AGENTS.md"
download_file "Skills.md" "Skills.md"
download_file "CONTRIBUTING.md" "CONTRIBUTING.md"
download_file "CHANGELOG.md" "CHANGELOG.md"
download_file "README.md" "README.md"
download_file ".gitignore" ".gitignore"

# GitHub configuration
echo -e "${CYAN}  GitHub configuration...${NC}"
download_file ".github/copilot-instructions.md" ".github/copilot-instructions.md"
download_file ".github/CODEOWNERS" ".github/CODEOWNERS"
download_file ".github/agentx-security.yml" ".github/agentx-security.yml"
download_file ".github/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"
download_file ".github/security/allowed-commands.json" ".github/security/allowed-commands.json"

# Workflows
echo -e "${CYAN}  GitHub Actions workflows...${NC}"
download_file ".github/workflows/agent-x.yml" ".github/workflows/agent-x.yml"
download_file ".github/workflows/quality-gates.yml" ".github/workflows/quality-gates.yml"
download_file ".github/workflows/dependency-scanning.yml" ".github/workflows/dependency-scanning.yml"

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
download_file ".github/ISSUE_TEMPLATE/devops.yml" ".github/ISSUE_TEMPLATE/devops.yml"
download_file ".github/ISSUE_TEMPLATE/feature-local-mode.md" ".github/ISSUE_TEMPLATE/feature-local-mode.md"

# Agent definitions
echo -e "${CYAN}  Agent definitions...${NC}"
download_file ".github/agents/product-manager.agent.md" ".github/agents/product-manager.agent.md"
download_file ".github/agents/architect.agent.md" ".github/agents/architect.agent.md"
download_file ".github/agents/ux-designer.agent.md" ".github/agents/ux-designer.agent.md"
download_file ".github/agents/engineer.agent.md" ".github/agents/engineer.agent.md"
download_file ".github/agents/reviewer.agent.md" ".github/agents/reviewer.agent.md"
download_file ".github/agents/devops.agent.md" ".github/agents/devops.agent.md"
download_file ".github/agents/agent-x.agent.md" ".github/agents/agent-x.agent.md"
download_file ".github/agents/reviewer-auto.agent.md" ".github/agents/reviewer-auto.agent.md"

# Document templates
echo -e "${CYAN}  Document templates...${NC}"
download_file ".github/templates/PRD-TEMPLATE.md" ".github/templates/PRD-TEMPLATE.md"
download_file ".github/templates/ADR-TEMPLATE.md" ".github/templates/ADR-TEMPLATE.md"
download_file ".github/templates/SPEC-TEMPLATE.md" ".github/templates/SPEC-TEMPLATE.md"
download_file ".github/templates/UX-TEMPLATE.md" ".github/templates/UX-TEMPLATE.md"
download_file ".github/templates/REVIEW-TEMPLATE.md" ".github/templates/REVIEW-TEMPLATE.md"
download_file ".github/templates/PROGRESS-TEMPLATE.md" ".github/templates/PROGRESS-TEMPLATE.md"
download_file ".github/templates/README.md" ".github/templates/README.md"

# Instructions
echo -e "${CYAN}  Coding instructions...${NC}"
download_file ".github/instructions/api.instructions.md" ".github/instructions/api.instructions.md"
download_file ".github/instructions/csharp.instructions.md" ".github/instructions/csharp.instructions.md"
download_file ".github/instructions/python.instructions.md" ".github/instructions/python.instructions.md"

# Validation scripts
echo -e "${CYAN}  Validation scripts...${NC}"
download_file ".github/scripts/validate-handoff.sh" ".github/scripts/validate-handoff.sh"
download_file ".github/scripts/validate-handoff.ps1" ".github/scripts/validate-handoff.ps1"
download_file ".github/scripts/capture-context.sh" ".github/scripts/capture-context.sh"
download_file ".github/scripts/capture-context.ps1" ".github/scripts/capture-context.ps1"
download_file ".github/scripts/setup-hooks.sh" ".github/scripts/setup-hooks.sh"
download_file ".github/scripts/setup-hooks.ps1" ".github/scripts/setup-hooks.ps1"
download_file ".github/scripts/collect-metrics.ps1" ".github/scripts/collect-metrics.ps1"
download_file ".github/scripts/collect-metrics.sh" ".github/scripts/collect-metrics.sh"

# Git hooks (include PowerShell versions)
echo -e "${CYAN}  Git hooks (cross-platform)...${NC}"
download_file ".github/hooks/commit-msg.ps1" ".github/hooks/commit-msg.ps1"

# Utility scripts
echo -e "${CYAN}  Utility scripts...${NC}"
download_file "scripts/convert-docs.ps1" "scripts/convert-docs.ps1"
download_file "scripts/convert-docs.sh" "scripts/convert-docs.sh"

# Additional instructions
download_file ".github/instructions/react.instructions.md" ".github/instructions/react.instructions.md"
download_file ".github/instructions/blazor.instructions.md" ".github/instructions/blazor.instructions.md"
download_file ".github/instructions/sql.instructions.md" ".github/instructions/sql.instructions.md"
download_file ".github/instructions/devops.instructions.md" ".github/instructions/devops.instructions.md"

# Prompts
echo -e "${CYAN}  Prompt templates...${NC}"
download_file ".github/prompts/code-review.prompt.md" ".github/prompts/code-review.prompt.md"
download_file ".github/prompts/refactor.prompt.md" ".github/prompts/refactor.prompt.md"
download_file ".github/prompts/test-gen.prompt.md" ".github/prompts/test-gen.prompt.md"
download_file ".github/prompts/prd-gen.prompt.md" ".github/prompts/prd-gen.prompt.md"
download_file ".github/prompts/ux-design.prompt.md" ".github/prompts/ux-design.prompt.md"
download_file ".github/prompts/architecture.prompt.md" ".github/prompts/architecture.prompt.md"
download_file ".github/prompts/devops.prompt.md" ".github/prompts/devops.prompt.md"
download_file ".github/prompts/security-review.prompt.md" ".github/prompts/security-review.prompt.md"
download_file ".github/prompts/bug-triage.prompt.md" ".github/prompts/bug-triage.prompt.md"

# Skills (36 production skills organized by category)
echo -e "${CYAN}  Production skills (36 skills)...${NC}"

# Architecture skills
for skill in core-principles security performance database scalability code-organization api-design; do
    download_file ".github/skills/architecture/$skill/SKILL.md" ".github/skills/architecture/$skill/SKILL.md"
done

# Development skills
for skill in testing error-handling configuration documentation version-control type-safety dependency-management logging-monitoring code-review-and-audit csharp python frontend-ui react blazor postgresql sql-server go rust mcp-server-development data-analysis; do
    download_file ".github/skills/development/$skill/SKILL.md" ".github/skills/development/$skill/SKILL.md"
done

# Operations skills
download_file ".github/skills/operations/remote-git-operations/SKILL.md" ".github/skills/operations/remote-git-operations/SKILL.md"
download_file ".github/skills/operations/github-actions-workflows/SKILL.md" ".github/skills/operations/github-actions-workflows/SKILL.md"
download_file ".github/skills/operations/yaml-pipelines/SKILL.md" ".github/skills/operations/yaml-pipelines/SKILL.md"
download_file ".github/skills/operations/release-management/SKILL.md" ".github/skills/operations/release-management/SKILL.md"

# Cloud skills
download_file ".github/skills/cloud/azure/SKILL.md" ".github/skills/cloud/azure/SKILL.md"
download_file ".github/skills/cloud/containerization/SKILL.md" ".github/skills/cloud/containerization/SKILL.md"

# AI Systems skills
download_file ".github/skills/ai-systems/ai-agent-development/SKILL.md" ".github/skills/ai-systems/ai-agent-development/SKILL.md"
download_file ".github/skills/ai-systems/prompt-engineering/SKILL.md" ".github/skills/ai-systems/prompt-engineering/SKILL.md"
download_file ".github/skills/ai-systems/skill-creator/SKILL.md" ".github/skills/ai-systems/skill-creator/SKILL.md"

# Design skills
download_file ".github/skills/design/ux-ui-design/SKILL.md" ".github/skills/design/ux-ui-design/SKILL.md"

# Skill reference files (progressive disclosure)
echo -e "${CYAN}  Skill references and scripts...${NC}"

# ai-agent-development references
download_file ".github/skills/ai-systems/ai-agent-development/LICENSE.txt" ".github/skills/ai-systems/ai-agent-development/LICENSE.txt"
download_file ".github/skills/ai-systems/ai-agent-development/references/evaluation-guide.md" ".github/skills/ai-systems/ai-agent-development/references/evaluation-guide.md"
download_file ".github/skills/ai-systems/ai-agent-development/references/orchestration-patterns.md" ".github/skills/ai-systems/ai-agent-development/references/orchestration-patterns.md"

# skill-creator scripts
download_file ".github/skills/ai-systems/skill-creator/scripts/init-skill.ps1" ".github/skills/ai-systems/skill-creator/scripts/init-skill.ps1"

# security scripts
download_file ".github/skills/architecture/security/scripts/scan-security.ps1" ".github/skills/architecture/security/scripts/scan-security.ps1"
download_file ".github/skills/architecture/security/scripts/scan-secrets.ps1" ".github/skills/architecture/security/scripts/scan-secrets.ps1"

# ux-ui-design references
for ref in accessibility-patterns html-prototype-code research-templates responsive-patterns usability-testing-template; do
    download_file ".github/skills/design/ux-ui-design/references/$ref.md" ".github/skills/design/ux-ui-design/references/$ref.md"
done

# testing scripts
download_file ".github/skills/development/testing/scripts/check-coverage.ps1" ".github/skills/development/testing/scripts/check-coverage.ps1"
download_file ".github/skills/development/testing/scripts/check-test-pyramid.ps1" ".github/skills/development/testing/scripts/check-test-pyramid.ps1"

# github-actions-workflows references
for ref in workflow-syntax-reference jobs-and-steps-patterns actions-marketplace-examples secrets-variables-matrix reusable-workflows-and-actions; do
    download_file ".github/skills/operations/github-actions-workflows/references/$ref.md" ".github/skills/operations/github-actions-workflows/references/$ref.md"
done

# release-management references and scripts
for ref in release-pipeline-examples deployment-strategy-examples rollback-scripts release-automation-workflows release-runbook-template; do
    download_file ".github/skills/operations/release-management/references/$ref.md" ".github/skills/operations/release-management/references/$ref.md"
done
download_file ".github/skills/operations/release-management/scripts/version-bump.ps1" ".github/skills/operations/release-management/scripts/version-bump.ps1"

# yaml-pipelines references
for ref in azure-pipelines-examples gitlab-ci-examples pipeline-design-patterns multi-stage-pipelines templates-variables-caching; do
    download_file ".github/skills/operations/yaml-pipelines/references/$ref.md" ".github/skills/operations/yaml-pipelines/references/$ref.md"
done

# Documentation
echo -e "${CYAN}  Documentation...${NC}"
download_file "docs/mcp-integration.md" "docs/mcp-integration.md"
download_file "docs/troubleshooting.md" "docs/troubleshooting.md"
download_file "docs/project-setup.md" "docs/project-setup.md"
download_file "docs/markdown-to-doc-conversion.md" "docs/markdown-to-doc-conversion.md"
download_file "docs/NEW-FEATURES-v2.1.md" "docs/NEW-FEATURES-v2.1.md"
download_file "docs/assets/agentx-logo.svg" "docs/assets/agentx-logo.svg"

# v3.0 Documentation
echo -e "${CYAN}  v3.0 feature documentation...${NC}"
download_file "docs/analytics/METRICS.md" "docs/analytics/METRICS.md"
download_file "docs/multi-repo.md" "docs/multi-repo.md"
download_file "docs/cli-specification.md" "docs/cli-specification.md"
download_file "docs/agent-memory.md" "docs/agent-memory.md"
download_file "docs/visualization.md" "docs/visualization.md"
download_file "docs/local-mode.md" "docs/local-mode.md"
download_file "docs/template-input-variables.md" "docs/template-input-variables.md"
download_file "docs/session-persistence.md" "docs/session-persistence.md"
download_file "LICENSE" "LICENSE"

# VS Code configuration
echo -e "${CYAN}  VS Code configuration...${NC}"
download_file ".vscode/mcp.json" ".vscode/mcp.json"
download_file ".vscode/settings.json" ".vscode/settings.json"

# Create output directories
echo -e "${CYAN}  Creating output directories...${NC}"
for dir in docs/prd docs/adr docs/specs docs/ux docs/reviews docs/progress; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GREEN}✓ Created: $dir/${NC}"
    fi
done

# Example documents (help users understand output formats)
echo -e "${CYAN}  Example documents...${NC}"
download_file "docs/prd/PRD-EXAMPLE.md" "docs/prd/PRD-EXAMPLE.md"
download_file "docs/adr/ADR-EXAMPLE.md" "docs/adr/ADR-EXAMPLE.md"
download_file "docs/specs/SPEC-EXAMPLE.md" "docs/specs/SPEC-EXAMPLE.md"
download_file "docs/reviews/REVIEW-EXAMPLE.md" "docs/reviews/REVIEW-EXAMPLE.md"
download_file "docs/ux/UX-EXAMPLE.md" "docs/ux/UX-EXAMPLE.md"

# Local Mode support (when user chose Local Mode)
if [ "$USE_LOCAL_MODE" = "true" ]; then
    echo ""
    echo -e "${CYAN}Initializing Local Mode...${NC}"
    mkdir -p ".agentx/issues"
    download_file ".agentx/local-issue-manager.ps1" ".agentx/local-issue-manager.ps1"
    download_file ".agentx/local-issue-manager.sh" ".agentx/local-issue-manager.sh"
    chmod +x ".agentx/local-issue-manager.sh" 2>/dev/null
    cat > ".agentx/config.json" <<EOF
{
    "mode": "local",
    "nextIssueNumber": 1,
    "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    echo -e "${GREEN}✓ Local Mode configured${NC}"
    echo -e "${GREEN}✓ Local issue manager ready${NC}"
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

# Replace GitHub username placeholder
echo ""
echo -e "${CYAN}Configuring GitHub username...${NC}"
GITHUB_USERNAME=""
if command -v gh &> /dev/null; then
    GITHUB_USERNAME=$(gh api user --jq '.login' 2>/dev/null || true)
fi
if [ -z "$GITHUB_USERNAME" ] && command -v git &> /dev/null; then
    GITHUB_USERNAME=$(git config user.name 2>/dev/null || true)
fi

if [ -z "$GITHUB_USERNAME" ]; then
    echo -n "  Enter your GitHub username (for CODEOWNERS & security config): "
    read -r GITHUB_USERNAME
fi

if [ -n "$GITHUB_USERNAME" ]; then
    for f in .github/CODEOWNERS .github/agentx-security.yml; do
        if [ -f "$f" ]; then
            sed -i "s/<YOUR_GITHUB_USERNAME>/$GITHUB_USERNAME/g" "$f" 2>/dev/null || \
            sed -i '' "s/<YOUR_GITHUB_USERNAME>/$GITHUB_USERNAME/g" "$f" 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}✓ Configured CODEOWNERS and security for: $GITHUB_USERNAME${NC}"
else
    echo -e "${YELLOW}⚠ No username provided. Replace <YOUR_GITHUB_USERNAME> manually in:${NC}"
    echo "  - .github/CODEOWNERS"
    echo "  - .github/agentx-security.yml"
fi

# Done
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  AgentX installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

if [ "$USE_LOCAL_MODE" = "true" ]; then
    echo -e "${CYAN}🔧 LOCAL MODE ENABLED${NC}"
    echo ""
    echo -e "${YELLOW}AgentX is configured to work without GitHub.${NC}"
    echo ""
    echo -e "${CYAN}Issue Management Commands:${NC}"
    echo "  Create issue:  ./.agentx/local-issue-manager.sh create \"[Type] Description\" \"\" \"type:story\""
    echo "  List issues:   ./.agentx/local-issue-manager.sh list"
    echo "  Update status: ./.agentx/local-issue-manager.sh update <N> \"\" \"In Progress\""
    echo "  Close issue:   ./.agentx/local-issue-manager.sh close <N>"
    echo ""
    echo -e "${CYAN}Aliases (add to your shell profile):${NC}"
    echo '  alias issue="./.agentx/local-issue-manager.sh"'
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "  1. Read AGENTS.md for workflow guidelines"
    echo "  2. Read Skills.md for production code standards"
    echo "  3. Create your first issue:"
    echo '     ./.agentx/local-issue-manager.sh create "[Story] My first task" "" "type:story"'
    echo ""
    echo -e "${YELLOW}  ⚠️  Local Mode Limitations:${NC}"
    echo "  • No GitHub Actions workflows"
    echo "  • No pull request reviews"
    echo "  • Manual agent coordination"
    echo "  • To enable GitHub features, run: git remote add origin <repo-url>"
    echo ""
else
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
    echo '     gh label create "type:devops" --color "8B4789"'
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
fi
