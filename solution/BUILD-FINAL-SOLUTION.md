# Step-by-Step: Build the Final Solution

## 1) Confirm prerequisites

1. Install Power Platform CLI:
   - `dotnet tool install --global Microsoft.PowerApps.CLI.Tool`
2. Verify CLI:
   - `pac --version`
3. Open this folder:
   - `cd /home/runner/work/AgentX/AgentX/solution`

## 2) Finalize solution metadata

1. Update `src/Other/Solution.xml`:
   - `UniqueName`
   - `Version`
   - `Publisher` values
   - `RootComponents`
2. Keep one consistent prefix (example: `agx_`) across all assets.

## 3) Finalize Dataverse schema

1. Update `src/Entities/agx_workitem/Entity.xml` with production columns.
2. Add or update relationships in `src/Other/Relationships.xml`.
3. Register any added entities/attributes in `Solution.xml` RootComponents.

## 4) Finalize flow and connection references

1. Update `src/Workflows/agx_NotifyWorkItemCreated-11111111-2222-3333-4444-555555555555.json`.
2. Keep the workflow GUID stable unless intentionally renaming.
3. Ensure all connectors exist in `src/connectionreferences.json`.

## 5) Finalize optional Tier-2 and Tier-3 components

1. Canvas app: update `src/CanvasApps/...` files.
2. Model-driven app: update `src/AppModules/...` and `src/SiteMaps/...`.
3. Portal: replace placeholder in `src/Portals/...` with real exported source.
4. PCF control: complete code component manifest and implementation.
5. Plugin and step registration: complete plugin assembly assets and step metadata.
6. Roles and environment variables: finalize XML files under `src/Roles/` and `src/EnvironmentVariables/`.
7. Copilot Studio bot: complete bot, topics, and knowledge assets under `src/Bots/`.

## 6) Validate package structure

Run from `/home/runner/work/AgentX/AgentX/solution`:

1. `pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged --allowDelete true`
2. Fix any reported schema or manifest errors.
3. Re-run until exit code is 0.

## 7) Import into target environment

1. `pac auth create --environment https://<your-env>.crm.dynamics.com --name <env-name>`
2. `pac solution pack --zipfile build/solution.zip --folder ./src --packagetype Unmanaged`
3. `pac solution import --path build/solution.zip --async --publish-changes --activate-plugins`

## 8) Post-import checks

1. Bind connection references in maker portal.
2. Publish all customizations.
3. Create a test `agx_workitem` row and validate flow execution.
4. Validate app navigation, role access, and bot behavior.
