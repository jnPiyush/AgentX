## v8.4.45 - Visual Studio Extension (Preview)

First Marketplace-ready Preview of the AgentX Visual Studio extension. Reuses the AgentX CLI surface that ships with the VS Code extension and exposes it through a docked tool window inside Visual Studio 2022 17.14+.

### Added

- **`vs-extension/AgentX.VisualStudio/`** - new VisualStudio.Extensibility (out-of-process, modern) project targeting `net8.0-windows` with WPF, Apache-2.0, amd64 + arm64.
  - 5-tab tool window (Status, Workflows, Loop, Council, Agents) with auto-refresh and command wiring to `Initialize`, `Ready`, `Loop start/iterate/complete`, `Council`, `Workflow`, `Maintenance`, `Ship`.
  - Status tab now renders structured WPF panels for Loop Status, Ready Issues, and Agent State backed by typed DTOs (`LoopStatusDto`, `LoopHistoryDto`, `ReadyIssueDto`, `AgentStateDto`, `AgentStateRow`) parsed from `agentx-cli ConvertTo-Json` via `TryParseLoopStatus`, `TryParseReadyIssues`, `TryParseAgentState`. Each panel falls back to a formatted `TextBox` when JSON is missing or malformed (driven by `InverseBoolToVisibilityConverter`).
  - Marketplace metadata: DisplayName, Description (<200 chars), Tags, Icon, License (`LICENSE`), MoreInfo, ReleaseNotes, Preview = `true`.
  - Targets: `Microsoft.VisualStudio.Community 17.14+`, prerequisite `Microsoft.VisualStudio.Component.CoreEditor`.
- **`vs-extension/AgentX.VisualStudio.Tests/`** - xUnit 2.9.0 + FluentAssertions 6.12.0 with **linked source** (avoids the `VSEXT0004` constraint on referencing extension projects).
  - 22 baseline `Format*` tests + **15 new `TryParse*` tests** = **37 total** covering happy / empty / malformed / null-and-whitespace JSON paths, alphabetical agent ordering, and timestamp formatting.
  - 6 captured fixtures under `Fixtures/` driven from real `agentx-cli ConvertTo-Json` output.
- **`vs-extension/scripts/Build.ps1`** and **`vs-extension/scripts/Stamp-Version.ps1`** - build helpers; `Stamp-Version.ps1` reads `version.json` and writes `Directory.Build.props` so MSBuild stamps the same version that the VS Code extension ships.
- **`vs-extension/scripts/Sign-Vsix.ps1`** - opt-in `vsixsigntool` wrapper. Skips silently when no cert is provided; intended to be called from CI once a code-signing cert is supplied through Azure DevOps secret variables.
- **`docs/artifacts/reviews/2026-05-12-vs-extension-marketplace-dryrun.md`** - Marketplace publish dry-run report (CONDITIONAL PASS).
- **`docs/ux/vs-extension-smoke-test.md`** - 11-section smoke-test checklist with screenshot conventions and a sign-off block; this is the gate that controls flipping `Preview=false`.
- **`docs/ux/assets/vs-extension/README.md`** - placeholder/asset-folder guidance for the smoke-test screenshot artifacts.

### Modified

- **`azure-pipelines.yml`** - Stages the `AgentX.VisualStudio.vsix` build artifact so the produced VSIX is downloadable from CI runs. Includes a commented signing stage prepared to plug in a code-signing cert.
- **`vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj`** - Documents the optional signing properties (`SignVsix`, `VsixCertPath`, `VsixCertPassword`, `VsixTimestampUrl`) consumed by `Sign-Vsix.ps1`.
- **`vs-extension/README.md`** - Adds a "Signing the VSIX" section documenting how to plug in a real cert.

### Why this matters

Visual Studio users get parity with the VS Code experience: the same CLI, the same workflows, the same loop discipline, surfaced through a native tool window with structured Status panels and 37 automated unit tests around the JSON parsing path. The Preview release lets early users install via VSIX while the smoke-test checklist drives the GA gate.

### Verification

- Build (Release): `dotnet build .\vs-extension\AgentX.VisualStudio.sln -c Release` -> SUCCESS, 0 warnings, 0 errors.
- Tests (Release): `dotnet test .\vs-extension\AgentX.VisualStudio.sln -c Release` -> **37/37 pass** in 346 ms.
- VSIX: `vs-extension/AgentX.VisualStudio/bin/Release/net8.0-windows/AgentX.VisualStudio.vsix` (~4.0 MB) extracted and inspected; manifest, catalog, icon, license validated against marketplace schema 2.0.0. Payload: 141 entries, install footprint ~9.5 MB.
- Marketplace dry-run: CONDITIONAL PASS. No blocking findings. Watch items: smoke-test sign-off, optional signing, this CHANGELOG entry.

### Install

Download `AgentX.VisualStudio.vsix` from the build artifact and install via Visual Studio 2022 17.14+: `Extensions -> Manage Extensions -> Install from VSIX`. The extension appears as `AgentX - Multi-Agent Orchestration` and registers a tool window under `View -> Other Windows -> AgentX`.

### Known limitations

- Shipped as **Preview** (`Preview="true"`). The flip to GA is gated on the [smoke-test sign-off](docs/ux/vs-extension-smoke-test.md), an optional signed VSIX, and confirmation that this CHANGELOG entry is reachable via the Marketplace ReleaseNotes URL.
- VSIX is **unsigned** in this Preview build. Signing scaffolding is in place (`vs-extension/scripts/Sign-Vsix.ps1` + commented CI stage) but requires a code-signing cert provided through pipeline secrets.
