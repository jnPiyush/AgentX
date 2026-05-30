# AgentX Power Platform Builder Pack

Pack that lets AgentX generate **unpacked Microsoft Power Platform solution source trees** from a PRD-LOWCODE. The maker then runs `pac solution pack` and `pac solution import` to deploy into a Dataverse environment. Coverage spans Tier-1 (data + flows), Tier-2 (apps, RPA, portals, PCF, plugins, security, ALM), and Tier-3 (Copilot Studio agents).

## What This Pack Contains

| Asset | Location | Purpose |
|-------|----------|---------|
| Agent | `agents/low-code-builder.agent.md` | Specialist agent that emits the source tree |
| Skill (T1) | `.github/skills/low-code/solution-anatomy/SKILL.md` | Solution.xml, publisher, prefix, RootComponents |
| Skill (T1) | `.github/skills/low-code/dataverse-schema/SKILL.md` | Entity.xml, columns, choices, relationships |
| Skill (T1) | `.github/skills/low-code/power-automate-flow-json/SKILL.md` | Workflows/*-FLOW.json triggers, actions, connections |
| Skill (T1) | `.github/skills/low-code/pac-cli/SKILL.md` | pac solution pack/unpack/check, import flow |
| Skill (T2) | `.github/skills/low-code/canvas-app-yaml/SKILL.md` | Canvas app `.fx.yaml` control tree, Power Fx, manifest |
| Skill (T2) | `.github/skills/low-code/model-driven-app/SKILL.md` | AppModule, SiteMap, FormXml, SavedQuery views |
| Skill (T2) | `.github/skills/low-code/power-pages/SKILL.md` | Power Pages site source, Liquid, table permissions |
| Skill (T2) | `.github/skills/low-code/pcf-controls/SKILL.md` | PCF code components: manifest + index.ts lifecycle |
| Skill (T2) | `.github/skills/low-code/power-automate-desktop/SKILL.md` | Desktop/RPA flows: actions, selectors, error handling |
| Skill (T2) | `.github/skills/low-code/dataverse-plugins/SKILL.md` | Server-side C# plugins + SdkMessageProcessingStep |
| Skill (T2) | `.github/skills/low-code/security-roles/SKILL.md` | Security roles, privilege depth, field security |
| Skill (T2) | `.github/skills/low-code/environment-variables/SKILL.md` | Environment variables + connection references (ALM) |
| Skill (T3) | `.github/skills/low-code/copilot-studio-agents/SKILL.md` | Copilot Studio topics, knowledge, actions, channels |
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

- ALM pipelines (CI/CD for pac solution import) -- deferred to a DevOps pack
- AI Builder models and Power Fx component libraries -- deferred (Tier-4)
- Managed-solution build/release governance -- deferred

Covered now: Tier-1 (data + flows), Tier-2 (canvas + model-driven apps, desktop/RPA flows, Power Pages, PCF controls, Dataverse plugins, security roles, environment variables), and Tier-3 (Copilot Studio agents).

> Note: Copilot Studio and PCF source schemas are newer/less stable than Dataverse source, and `pac copilot` / `pac pcf` paths evolve quickly -- always verify against a live export before packing.

## Working Example

See `examples/lowcode-issue-tracker/` for a complete unpacked solution:

- 1 table (`agx_issue`) with Title, Description, Status, Priority, AssignedTo, DueDate
- 1 cloud flow (`agx_NotifyOnIssueCreated`) that emails when a new issue is created
- 1 connection reference for Outlook
- README with the exact pack + import commands

## Related

- `.github/agents/architect.agent.md` -- use the `low-code-vs-pro-code` skill to decide platform fit BEFORE invoking this pack.
- `.github/templates/ARCH-REVIEW-TEMPLATE.md` -- Platform Approach section.