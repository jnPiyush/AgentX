# VS Extension Parity Fixes - Change Log (2026-05-13)

State managed through `.copilot-tracking/` files. Next agent: Task Implementor; user will switch when Task Planner is done.

## Files Created

- `vs-extension/AgentX.VisualStudio/Services/LoopStatusNotifier.cs`
- `vs-extension/AgentX.VisualStudio/Services/DependencyChecker.cs`
- `vs-extension/AgentX.VisualStudio/Commands/CheckEnvironmentCommand.cs`
- `.copilot-tracking/plans/2026-05-13/vs-extension-parity-fixes-plan.instructions.md`
- `.copilot-tracking/details/2026-05-13/vs-extension-parity-fixes-details.md`
- `.copilot-tracking/changes/2026-05-13/vs-extension-parity-fixes-changes.md`

## Files Modified

- `vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj` (H-1)
- `vs-extension/AgentX.VisualStudio/Chat/AgentXChatTool.cs` (H-1)
- `vs-extension/AgentX.VisualStudio/Services/WorkspaceResolver.cs` (H-3)
- `vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.cs` (H-3, H-4, Maj-2)
- `vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindow.cs` (Maj-1)
- `vs-extension/AgentX.VisualStudio/Settings/AgentXSettings.cs` (Maj-2)
- `vs-extension/AgentX.VisualStudio/string-resources.json` (Maj-2, Maj-3)

## Outcomes

- Build: 0 warnings / 0 errors.
- Tests: 37/37 pass (TRX at `.agentx/state/loop-evidence/iter-maj2/test-report-iter-maj2.trx`).
- 4 of 6 findings fully shipped (H-1, H-3, H-4, Maj-3).
- 2 of 6 partial due to SDK 17.14 OOP limits (Maj-1, Maj-2) -- documented inline and in details.

## Not Done

- Med-2 version drift (csproj `8.4.45` Preview=true vs VS Code 8.4.50) -- out of scope for this remediation.
- Standalone unit tests for LoopStatusNotifier and DependencyChecker.Render -- skipped this iteration; the existing 37-test suite covers JSON parsing and CLI plumbing that the new code consumes.
