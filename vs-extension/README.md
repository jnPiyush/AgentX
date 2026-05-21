# AgentX for Visual Studio

AgentX extension for Visual Studio 2022 (17.9+). Mirrors the VS Code extension and shells out to the shared `.agentx/agentx.ps1` CLI.

## Status

Implements the milestones from the rollout plan:

- M1 Commands: `Ready`, `Initialize`, `Ship`, `Show Status`, `Check Deps`, `Run Workflow`, `Validate Handoff`, `Loop Start/Status/Iterate/Complete/Cancel/Rollback`.
- M2 Tool Window: WPF panel with Refresh button showing loop status + ready issues.
- M3 Settings: `agentx.autoRefresh`, `agentx.shell`, `agentx.rootPath`, `agentx.searchDepth`, `agentx.skipStartupCheck`, `agentx.skipUpdateCheck`.
- M4 Copilot Chat tool: **stub only**. The `Microsoft.VisualStudio.Extensibility.Copilot.Chat` package is not yet published on public NuGet, and the VS Extensibility SDK does not expose a chat-participant surface today, so the stub cannot be activated. See [Why don't I see @agentx in Visual Studio Copilot Chat?](#why-dont-i-see-agentx-in-visual-studio-copilot-chat) below.
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

## Why don't I see @agentx in Visual Studio Copilot Chat?

**Short answer**: Visual Studio does not currently support third-party Copilot Chat participants the way VS Code does. After you install the AgentX VSIX, the extension is active and its commands and tool window are available, but the chat window does not show an `@agentx` participant or AgentX agents -- because the public Visual Studio Extensibility SDK does not yet expose a chat-participant surface (no `Microsoft.VisualStudio.Extensibility.Copilot.Chat` package on nuget.org).

**Technical details**:

- The VS Code extension registers `@agentx` via `vscode.chat.createChatParticipant`, a public API. See [vscode-extension/src/chat/chatParticipant.ts](../vscode-extension/src/chat/chatParticipant.ts).
- The Visual Studio Extensibility SDK (`Microsoft.VisualStudio.Extensibility` 17.14.x) does **not** ship a `ChatTool` / `ChatParticipant` surface today. The forward-looking package `Microsoft.VisualStudio.Extensibility.Copilot.Chat` referenced in `AgentX.VisualStudio.csproj` is **not published on any public NuGet feed**; `dotnet restore` with `-p:EnableCopilotChat=true` fails with NU1101.
- [Chat/AgentXChatTool.cs](AgentX.VisualStudio/Chat/AgentXChatTool.cs) is intentionally kept as a forward-looking stub so the chat surface can be enabled with a one-line flip the day Microsoft ships the SDK. Until then, the stub is compiled out via `#if AGENTX_COPILOT_CHAT` and does not affect runtime behavior.
- Track package availability at [microsoft/VSExtensibility](https://github.com/microsoft/VSExtensibility) and watch for new versions of `Microsoft.VisualStudio.Extensibility.*` on nuget.org.

**What to use instead today** (all fully working surfaces in VS):

| Surface | How to open | What you get |
|---------|-------------|--------------|
| AgentX Tool Window | `View` -> `Other Windows` -> `AgentX: Show Tool Window` | Loop status, ready issues, refresh button |
| AgentX commands | `Tools` menu, or `Ctrl+Q` Command Palette: type `AgentX:` | `Ready`, `Initialize`, `Ship`, `Show Status`, `Check Deps`, `Run Workflow`, `Validate Handoff`, `Loop Start/Status/Iterate/Complete/Cancel/Rollback`, `Check Environment`, plus the per-classification `Workflow - Feature/Epic/Story/Bug/Spike/DevOps/Docs/Iterative Loop` shortcuts |
| Direct CLI | Open a terminal in your repo root | `pwsh ./.agentx/agentx.ps1 ready`, `loop status`, `workflow engineer`, etc. |

If you want chat-driven AgentX orchestration today, use the VS Code extension. The two extensions share the same `.agentx/agentx.ps1` CLI, the same `.github/agentx/` assets, and the same loop state, so you can switch IDEs without losing context.

## Notes / TODOs

- The Visual Studio Extensibility SDK does not yet expose a free-text input dialog. `Loop Start` uses a sensible default summary; refine with subsequent `Loop: Iterate` invocations.
- The Copilot Chat extensibility surface is not yet publicly available -- see [Why don't I see @agentx in Visual Studio Copilot Chat?](#why-dont-i-see-agentx-in-visual-studio-copilot-chat) above. Re-evaluate when Microsoft publishes `Microsoft.VisualStudio.Extensibility.Copilot.Chat` (or an equivalent) on nuget.org.
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
