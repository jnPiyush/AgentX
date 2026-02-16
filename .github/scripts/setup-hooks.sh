#!/usr/bin/env bash
# Setup Git hooks for AgentX workflow enforcement
# Run this script from the repository root after cloning

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${CYAN}-------------------------------------------------------${NC}"
echo -e "${CYAN} AgentX Git Hooks Setup${NC}"
echo -e "${CYAN}-------------------------------------------------------${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
 echo -e "${RED}[FAIL] Error: Not a git repository${NC}"
 echo " Please run this script from the root of your git repository."
 exit 1
fi

# Check if hook source files exist
HOOKS_DIR=".github/hooks"
if [ ! -d "$HOOKS_DIR" ]; then
 echo -e "${RED}[FAIL] Error: Hooks directory not found${NC}"
 echo " Expected: $HOOKS_DIR"
 echo " Did you run the AgentX installer first?"
 exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

echo -e "${CYAN}Installing Git hooks...${NC}"
echo ""

# Install pre-commit hook (bash version)
if [ -f "$HOOKS_DIR/pre-commit" ]; then
 cp "$HOOKS_DIR/pre-commit" ".git/hooks/pre-commit"
 chmod +x ".git/hooks/pre-commit"
 echo -e "${GREEN}[PASS] Installed: pre-commit hook${NC}"
else
 echo -e "${YELLOW}[WARN] Skipped: pre-commit hook (source not found)${NC}"
fi

# Install pre-commit hook (PowerShell version for Windows)
if [ -f "$HOOKS_DIR/pre-commit.ps1" ]; then
 cp "$HOOKS_DIR/pre-commit.ps1" ".git/hooks/pre-commit.ps1"
 echo -e "${GREEN}[PASS] Installed: pre-commit.ps1 hook${NC}"
else
 echo -e "${YELLOW}[WARN] Skipped: pre-commit.ps1 hook (source not found)${NC}"
fi

# Install commit-msg hook
if [ -f "$HOOKS_DIR/commit-msg" ]; then
 cp "$HOOKS_DIR/commit-msg" ".git/hooks/commit-msg"
 chmod +x ".git/hooks/commit-msg"
 echo -e "${GREEN}[PASS] Installed: commit-msg hook${NC}"
else
 echo -e "${YELLOW}[WARN] Skipped: commit-msg hook (source not found)${NC}"
fi

echo ""
echo -e "${GREEN}-------------------------------------------------------${NC}"
echo -e "${GREEN} Git hooks installed successfully!${NC}"
echo -e "${GREEN}-------------------------------------------------------${NC}"
echo ""
echo "Hooks enforce AgentX workflow compliance:"
echo " - Issue number required in commit messages"
echo " - No secrets in code"
echo " - No destructive commands"
echo " - Code formatting (if tools available)"
echo ""
echo "To bypass in emergencies, use: git commit -m 'message [skip-issue]'"
echo ""
