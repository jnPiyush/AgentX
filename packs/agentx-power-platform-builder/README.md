# AgentX Power Platform Builder Pack (MVP)

Tier-1 pack that lets AgentX generate **unpacked Microsoft Power Platform solution source trees** from a PRD-LOWCODE. The maker then runs `pac solution pack` and `pac solution import` to deploy into a Dataverse environment.

## What This Pack Contains

| Asset | Location | Purpose |
|-------|----------|---------|
| Agent | `agents/low-code-builder.agent.md` | Specialist agent that emits the source tree |
| Skill | `.github/skills/low-code/solution-anatomy/SKILL.md` | Solution.xml, publisher, prefix, RootComponents |
| Skill | `.github/skills/low-code/dataverse-schema/SKILL.md` | Entity.xml, columns, choices, relationships |
| Skill | `.github/skills/low-code/power-automate-flow-json/SKILL.md` | Workflows/*-FLOW.json triggers, actions, connections |
| Skill | `.github/skills/low-code/pac-cli/SKILL.md` | pac solution pack/unpack/check, import flow |
| Template | `templates/PRD-LOWCODE-TEMPLATE.md` | PRD variant with Tables/Flows/Roles/DLP sections |
| Template | `templates/SOLUTION-MANIFEST-TEMPLATE.md` | Solution.xml skeleton |
| Example | `examples/lowcode-issue-tracker/` | End-to-end working example a maker can pack + import in ~10 min |

## How to Use

1. Draft a PRD-LOWCODE in `docs/artifacts/prd/` (use the template).
2. Invoke the low-code-builder agent and point it at the PRD.
3. The agent writes `solutions/<solution-name>/` with the unpacked source tree.
4. Install pac if needed: `dotnet tool install --global Microsoft.PowerApps.CLI.Tool`
5. Pack + import:
   `
   cd solutions/<solution-name>
   pac auth create --environment https://<your-env>.crm.dynamics.com --name <env-name>
   pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged
   pac solution import --path build/solution.zip --async --publish-changes --activate-plugins
   `
6. On first import, the maker portal will prompt to bind each connection reference to a real connection.

## What This Pack Does NOT Do (Yet)

- Canvas app source (`CanvasApps/.../*.fx.yaml`) -- deferred to Phase 2
- Copilot Studio bot source (`Bots/<bot>/*.yaml`) -- deferred to Phase 2
- Custom security role authoring beyond out-of-box -- deferred
- ALM pipelines (CI/CD for pac) -- deferred to DevOps pack

The MVP proves the packaging + tables + flow path. Phase 2 layers canvas and Copilot Studio on top.

## Working Example

See `examples/lowcode-issue-tracker/` for a complete unpacked solution:

- 1 table (`agx_issue`) with Title, Description, Status, Priority, AssignedTo, DueDate
- 1 cloud flow (`agx_NotifyOnIssueCreated`) that emails when a new issue is created
- 1 connection reference for Outlook
- README with the exact pack + import commands

## Related

- `.github/agents/architect.agent.md` -- use the `low-code-vs-pro-code` skill to decide platform fit BEFORE invoking this pack.
- `.github/templates/ARCH-REVIEW-TEMPLATE.md` -- Platform Approach section.