# VS Extension Parity Fixes - Implementation Details (2026-05-13)

State managed through `.copilot-tracking/` files. Next agent: Task Implementor.

## Files Modified

### H-1 Copilot Chat opt-in
- `vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj`
  - Added `<EnableCopilotChat>` MSBuild property (default false).
  - Conditional `<DefineConstants>$(DefineConstants);AGENTX_COPILOT_CHAT</DefineConstants>`.
  - Conditional `<PackageReference Include="Microsoft.VisualStudio.Extensibility.Copilot.Chat" Version="17.14.40608" />`.
- `vs-extension/AgentX.VisualStudio/Chat/AgentXChatTool.cs`
  - Whole class wrapped in `#if AGENTX_COPILOT_CHAT ... #endif`.

### H-3 WorkspaceResolver lifecycle
- `vs-extension/AgentX.VisualStudio/Services/WorkspaceResolver.cs`
  - Added `private static readonly object _gate`, `_lastResolved`.
  - Added `event EventHandler<WorkspaceRootChangedEventArgs>? WorkspaceRootChanged`.
  - Added `Reset()` to clear the cached root.
  - `ResolveCoreAsync` now compares against `_lastResolved` and raises the event via `NotifyIfChanged`.
  - `WorkspaceRootChangedEventArgs` exposes `PreviousRoot` and `CurrentRoot`.
  - `TryGetWorkspaceFolder` reflection probe documented as returning null on SDK 17.14.

### H-4 Watcher debounce + Dispose
- `vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.cs`
  - Per-watcher `Timer` with 500ms `AutoReset = false`, `Stop()` + `Start()` on each event.
  - Class declares `: RemoteUserControl, IDisposable`.
  - `public new void Dispose()` (resolves CS0108 since base `Dispose` is non-virtual).
  - Watches `.agentx/config.json`, `.agentx/state/loop-state.json`, `.vscode/mcp.json`, `.git/config`.
  - Subscribes to `WorkspaceResolver.WorkspaceRootChanged` and rewires watchers when root flips.

### Maj-1 Tool window placement (PARTIAL)
- `vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindow.cs`
  - `Placement = ToolWindowPlacement.DockedTo(SolutionExplorerToolWindowGuid)` where the GUID is `3ae79031-e1bc-11d0-8f78-00a0c9110057` (Solution Explorer).
  - SDK 17.14 OOP `ToolWindowPlacement` only exposes `DocumentWell`, `Floating`, and `DockedTo(Guid)` -- there is no `DockedRight` enum. Documented in XML doc on the class.

### Maj-2 Loop status notifier (PARTIAL)
- `vs-extension/AgentX.VisualStudio/Settings/AgentXSettings.cs`
  - Added `[VisualStudioContribution] public static Setting.Boolean ShowLoopStatusNotifications` (id `showLoopStatusNotifications`, default true).
  - Added `public static async Task<bool> ReadShowLoopStatusNotificationsAsync(...)` returning true on failure.
- `vs-extension/AgentX.VisualStudio/string-resources.json`
  - Added `AgentX.Settings.ShowLoopStatusNotifications.DisplayName` and `.Description`.
- `vs-extension/AgentX.VisualStudio/Services/LoopStatusNotifier.cs` (NEW)
  - `UpdateAsync(extensibility, status, enabled, ct)` tracks last-seen `Active` flag and last terminal status.
  - Emits `Shell().ShowPromptAsync($"AgentX loop COMPLETE/BLOCKED at iteration N (issue #X).", PromptOptions.OK, ct)` only on `active -> complete` or `active -> blocked`.
  - `Reset()` clears state when the workspace root changes.
  - SDK 17.14 OOP has no `IVsStatusbar`, so this is the closest parity to the VS Code `$(hubot) AgentX` status-bar item.
- `vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.cs`
  - Holds `private readonly LoopStatusNotifier _loopNotifier = new();`.
  - `RefreshAsync` reads the setting and calls `_loopNotifier.UpdateAsync(...)` after parsing `loopStatusModel`.
  - `OnWorkspaceRootChanged` calls `_loopNotifier.Reset()` before triggering refresh.

### Maj-3 Environment health check
- `vs-extension/AgentX.VisualStudio/Services/DependencyChecker.cs` (NEW, ~200 lines)
  - `Severity` enum (`Required`, `Recommended`, `Optional`).
  - `ProbeResult` record + `EnvironmentReport` record (`HasWarnings`).
  - `CheckAllAsync(workspaceRoot, ct)` with 5s linked CTS timeout.
  - `Render(EnvironmentReport)` produces ASCII `[PASS]`/`[FAIL]`/`[WARN]` markers.
- `vs-extension/AgentX.VisualStudio/Commands/CheckEnvironmentCommand.cs` (NEW)
  - `[VisualStudioContribution] internal sealed class CheckEnvironmentCommand : AgentXCommand`.
  - Placed under `CommandPlacement.KnownPlacements.ToolsMenu`.
  - Renders the report via `Shell().ShowPromptAsync(report, PromptOptions.OK, ct)`.
- `vs-extension/AgentX.VisualStudio/string-resources.json`
  - Added `AgentX.CheckEnvironment.DisplayName`.

## Build & Test Evidence

- `dotnet build .\AgentX.VisualStudio.sln -c Release`: 0 Warning(s), 0 Error(s).
- `dotnet test ... --logger "trx;LogFileName=test-report-iter-maj2.trx"`: Passed 37, Failed 0, Skipped 0.
- TRX path: `.agentx/state/loop-evidence/iter-maj2/test-report-iter-maj2.trx`.

## SDK 17.14 OOP Limitations Documented

| Limitation | Workaround |
|------------|------------|
| No `DockedRight` enum on `ToolWindowPlacement` | Use `DockedTo(SolutionExplorerToolWindowGuid)` |
| No `IVsStatusbar` from OOP | `Shell().ShowPromptAsync` on terminal transitions only |
| `IVsSolution` events unavailable | Reflection probe + cache-invalidation event on `WorkspaceResolver` |
