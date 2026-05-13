# AgentX for Visual Studio

AgentX extension for Visual Studio 2022 (17.9+). Mirrors the VS Code extension and shells out to the shared `.agentx/agentx.ps1` CLI.

## Status

Implements the milestones from the rollout plan:

- M1 Commands: `Ready`, `Initialize`, `Ship`, `Show Status`, `Check Deps`, `Run Workflow`, `Validate Handoff`, `Loop Start/Status/Iterate/Complete/Cancel`.
- M2 Tool Window: WPF panel with Refresh button showing loop status + ready issues.
- M3 Settings: `agentx.autoRefresh`, `agentx.shell`, `agentx.rootPath`, `agentx.searchDepth`, `agentx.skipStartupCheck`, `agentx.skipUpdateCheck`.
- M4 Copilot Chat tool: stubbed under `#if AGENTX_COPILOT_CHAT` -- enable when you opt in to the preview SDK.
- M5 Packaging: `dotnet build -c Release` produces a `.vsix`. CI job added to `azure-pipelines.yml`.

## Build

Requires Visual Studio 2022 17.9+ with the **Visual Studio extension development** workload and the .NET 8 SDK.

```pwsh
pwsh ./vs-extension/scripts/Build.ps1
```

The `.vsix` lands under `vs-extension/AgentX.VisualStudio/bin/Release/`. Double-click to install into VS, or open the solution and press F5 for the experimental instance.

## Layout

```
vs-extension/
  .gitignore
  README.md
  AgentX.VisualStudio.sln
  AgentX.VisualStudio/
    AgentX.VisualStudio.csproj
    AgentXExtension.cs            # Extension entry point
    AgentXCli.cs                  # pwsh -> .agentx/agentx.ps1 bridge
    string-resources.json
    Commands/
      CommandBase.cs              # Shared workspace + output channel + CLI helpers
      ReadyCommand.cs
      InitializeCommand.cs
      LoopCommands.cs             # Start, Status, Iterate, Complete, Cancel
      ShipCommand.cs
      StatusCommand.cs            # ShowStatus, CheckDeps, RunWorkflow, ValidateHandoff
    Services/
      AgentXOutput.cs             # Output window 'AgentX' channel
      WorkspaceResolver.cs        # Setting -> env -> Workspaces() lookup
    Settings/
      AgentXSettings.cs           # Mirrors VS Code agentx.* keys
    ToolWindows/
      AgentXToolWindow.cs
      AgentXToolWindowControl.cs
      AgentXToolWindowControl.xaml
      AgentXToolWindowViewModel.cs
    Chat/
      AgentXChatTool.cs           # Preview Copilot Chat tool (#if AGENTX_COPILOT_CHAT)
  scripts/
    Stamp-Version.ps1             # Mirrors scripts/stamp-version.js
    Build.ps1                     # Stamp + restore + build + locate .vsix
```

## Sharing with the VS Code extension

Both extensions read agent/skill/prompt files from the repo's `.github/` and `packs/agentx-core/` directories and invoke the same `.agentx/agentx.ps1` CLI. No business logic is duplicated.

## Notes / TODOs

- The Visual Studio Extensibility SDK does not yet expose a free-text input dialog. `Loop Start` uses a sensible default summary; refine with subsequent `Loop: Iterate` invocations.
- The Copilot Chat extensibility surface is preview. Enable `AGENTX_COPILOT_CHAT` and add the matching package reference in `AgentX.VisualStudio.csproj` once the SDK stabilizes.
- Marketplace publishing is manual: upload the `.vsix` to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) under the `jnPiyush` publisher.

## Signing the VSIX

The VSIX is unsigned in Preview. Marketplace will accept unsigned VSIX while `Preview="true"` in `extension.vsixmanifest`, but signing is required before flipping to GA.

The signing flow is opt-in and gated on a code-signing certificate provided through CI secret variables.

### Local sign

```pwsh
pwsh ./vs-extension/scripts/Sign-Vsix.ps1 `
    -CertPath C:\path\to\agentx-codesign.pfx `
    -CertPassword $env:VSIX_CERT_PASSWORD
```

The script:

- Defaults `-VsixPath` to the Release output (`vs-extension/AgentX.VisualStudio/bin/Release/net8.0-windows/AgentX.VisualStudio.vsix`).
- Restores `Microsoft.VSSDK.VsixSignTool` into `vs-extension/scripts/.tools/` if it is not already on PATH.
- Skips silently (`exit 0`) when `-CertPath` is empty or the file is missing, so local builds keep working without a cert.
- Timestamps with `http://timestamp.digicert.com` (override with `-TimestampUrl`).

### CI sign

`azure-pipelines.yml` calls `Sign-Vsix.ps1` between the build step and the artifact-staging step. Provide the cert path and password through pipeline secret variables:

| Secret variable      | Purpose                                  |
|----------------------|------------------------------------------|
| `VSIX_CERT_PATH`     | Path to the PFX file inside the CI agent |
| `VSIX_CERT_PASSWORD` | Password for the PFX                     |

When the secrets are not set, the signing task logs `[sign-vsix] no certificate provided -- skipping (Preview unsigned build)` and the pipeline succeeds without signing.

### Pre-GA gate

Before flipping `Preview="false"` in `vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj` (or the equivalent generated entry):

1. Smoke-test sign-off complete - see [docs/ux/vs-extension-smoke-test.md](../docs/ux/vs-extension-smoke-test.md).
2. CI run on `master` produces a **signed** VSIX (signing task did not skip).
3. CHANGELOG.md entry for the GA version is committed.
