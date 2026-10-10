---
description: 'Run the GitHub backlog operations workflow using the canonical contract in .github/agents/internal/github-ops.agent.md.'
---

Run `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 cursor read .github/agents/internal/github-ops.agent.md` before taking action.

Treat this command as a thin wrapper over the canonical agent file. Use that file for GitHub triage, routing, and backlog-management rules.