---
description: 'Run the DevOps workflow using the canonical contract in .github/agents/devops.agent.md.'
---

Run `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 cursor read .github/agents/devops.agent.md` before taking action.

Treat this command as a thin wrapper over the canonical agent file. Use that file for pipeline, deployment, and validation requirements.