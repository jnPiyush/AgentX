# AgentX Solution Scaffold

This folder contains a Power Platform unpacked solution scaffold aligned to the documented solution architecture and low-code skills.

## Folder Goals

- Keep all solution assets inside `solution/`
- Provide starter components for skills in `.github/skills/low-code/`
- Keep source unpacked and deterministic under `solution/src/`

## Included Skill-Mapped Components

| Skill | Component in this scaffold |
|------|-----------------------------|
| solution-anatomy | `src/Other/Solution.xml`, `src/Other/Customizations.xml`, `src/[Content_Types].xml` |
| dataverse-schema | `src/Entities/agx_workitem/Entity.xml`, `src/Other/Relationships.xml` |
| power-automate-flow-json | `src/Workflows/agx_NotifyWorkItemCreated-11111111-2222-3333-4444-555555555555.json` |
| environment-variables | `src/EnvironmentVariables/agx_NotificationFromAddress.xml`, `src/connectionreferences.json` |
| canvas-app-yaml | `src/CanvasApps/agx_WorkItemApp_template/CanvasManifest.json`, `Src/HomeScreen.fx.yaml` |
| model-driven-app | `src/AppModules/agx_WorkItemAdmin/AppModule.xml`, `src/SiteMaps/agx_workitem_sitemap.xml` |
| power-pages | `src/Portals/agx_portal/README.txt` |
| pcf-controls | `src/CodeComponents/agx_RatingControl/ControlManifest.Input.xml` |
| dataverse-plugins | `src/PluginAssemblies/Agx.WorkItems.Plugins/README.txt`, `src/SdkMessageProcessingSteps/agx_precreate_workitem.xml` |
| security-roles | `src/Roles/agx_WorkItemReporter/role.xml` |
| copilot-studio-agents | `src/Bots/agx_workitem_copilot/bot.yaml`, `topics/`, `knowledge/` |

See `BUILD-FINAL-SOLUTION.md` for step-by-step build and packaging instructions.
