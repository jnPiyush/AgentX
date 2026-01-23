#!/bin/bash
# Install AgentX git hooks

echo ""
echo "AgentX - AI Agent Guidelines for Production Code"
echo ""

# Check for git
if [ ! -d ".git" ]; then
    echo "Error: Not a git repository. Run 'git init' first."
    exit 1
fi

# Install git hooks
echo "Installing git hooks..."

if [ -d ".github/hooks" ]; then
    for hook in pre-commit commit-msg; do
        if [ -f ".github/hooks/$hook" ]; then
            cp ".github/hooks/$hook" ".git/hooks/$hook"
            chmod +x ".git/hooks/$hook"
            echo "  Installed $hook hook"
        fi
    done
fi

echo ""
echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Read AGENTS.md for workflow guidelines"
echo "  2. Read Skills.md for production code standards"
echo "  3. Create GitHub labels (see README.md)"
echo ""
