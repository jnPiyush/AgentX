## v8.4.50 - Visual Studio Extension Preview Assets

This release attaches the **AgentX Visual Studio Extension Preview** VSIX to the existing v8.4.50 tag. The release continues the work originally tagged at this version with the marketplace-ready Preview from PR [#344](https://github.com/jnPiyush/AgentX/pull/344) (story [#345](https://github.com/jnPiyush/AgentX/issues/345)).

### Asset

- **`AgentX.VisualStudio.vsix`** - Visual Studio 2022 (17.14+) extension, ~3.84 MB
  - Built from `agentx_vsextension` HEAD `6b18c07` on `net8.0-windows`, Release configuration
  - Stamped version 8.4.50 (mirrors `version.json`)
  - Apache-2.0, marketplace `Preview="true"`, unsigned (Preview)

### What is in the VSIX

- 5-tab WPF tool window (Status, Workflows, Loop, Council, Agents) with auto-refresh and structured Status panels backed by typed DTOs (`LoopStatusDto`, `ReadyIssueDto`, `AgentStateDto`)
- Command palette wiring for `Initialize`, `Ready`, `Loop start/iterate/complete`, `Council`, `Workflow`, `Maintenance`, `Ship`, plus `Show Status` with workflow shortcuts trailer
- `AgentXCli` PowerShell wrapper + `WorkspaceResolver`
- Copilot Chat tool stub (`AgentXChatTool`) gated behind `EnableCopilotChat` (Chat surface intentionally disabled in this Preview - see commit `3b2f7d6`)
- Marketplace metadata: DisplayName, Description (<200 chars), Tags, Icon, License, MoreInfo, ReleaseNotes pointed at this entry

### Validation (HEAD `6b18c07`)

- Build (Release): 0 warnings, 0 errors
- Tests (Release, xUnit + FluentAssertions): **63/63 pass in ~3.2s** (TD-017 baseline locked at 63 via `agentx loop baseline -c 63`)
- Marketplace dry-run: **CONDITIONAL PASS** (see `docs/artifacts/reviews/2026-05-12-vs-extension-marketplace-dryrun.md`)
- Quality loop: completed with Subagent Review iteration

### Install

1. Download `AgentX.VisualStudio.vsix` from the assets below.
2. Visual Studio 2022 17.14+: `Extensions -> Manage Extensions -> Install from VSIX` (or double-click the file).
3. Open the tool window: `View -> Other Windows -> AgentX`.

### Known limitations (Preview)

- **Unsigned VSIX.** Signing scaffolding is in `vs-extension/scripts/Sign-Vsix.ps1` and is a no-op when no certificate is provided; flipping to a signed build is the first of two GA gates.
- **Smoke-test not yet executed by a human.** The 11-section checklist in `docs/ux/vs-extension-smoke-test.md` and the screenshot capture conventions in `docs/ux/assets/vs-extension/` are the second GA gate; run results have not yet been recorded and screenshots have not yet been captured.
- **Copilot Chat surface disabled.** The chat tool is registered but feature-gated off because the public NuGet preview of `Microsoft.VisualStudio.Extensibility.Copilot.Chat 17.14.x` is not yet available; the stub will light up once the public package ships (commit `3b2f7d6`).

### Source

- PR: [#344 - Added Visual Studio Extension for AgentX](https://github.com/jnPiyush/AgentX/pull/344)
- Story: [#345 - Create Visual Studio Extension for AgentX](https://github.com/jnPiyush/AgentX/issues/345)
- Original 8.4.45 Preview notes: [`release-notes-8.4.45.md`](https://github.com/jnPiyush/AgentX/blob/master/release-notes-8.4.45.md)
- Changelog: https://github.com/jnPiyush/AgentX/compare/v8.4.49...v8.4.50
