---
description: 'Run the Azure DevOps backlog operations workflow using the canonical contract in .github/agents/internal/ado-ops.agent.md.'
---

Run `pwsh -NoProfile -File .frontier/runtime/frontier.ps1 cursor read .github/agents/internal/ado-ops.agent.md` before taking action.

Treat this command as a thin wrapper over the canonical agent file. Use that file for ADO triage, planning, and execution handoff rules.