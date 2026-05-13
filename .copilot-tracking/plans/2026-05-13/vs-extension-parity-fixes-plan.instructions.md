---
description: Plan to remediate the 6 blocking findings (3 HIGH + 3 Major) from REVIEW-vs-extension-parity.md.
applyTo: vs-extension/**
---

# VS Extension Parity Fixes Plan (2026-05-13)

All session state for this remediation is tracked through files under `.copilot-tracking/` per the user mandate.
Next agent instructions will be Task Implementor and the user will switch to it when they are done with Task Planner.

## Source

- Review: `docs/artifacts/reviews/REVIEW-vs-extension-parity.md`
- Findings addressed in priority order: H-1, H-3, H-4, Maj-1, Maj-2, Maj-3.

## Findings and Decisions

| Finding | Title | Decision | Status |
|---------|-------|----------|--------|
| H-1 | Copilot Chat NuGet not opt-in | Add `EnableCopilotChat` MSBuild property; conditional `AGENTX_COPILOT_CHAT` symbol; conditional package ref; wrap `AgentXChatTool` in `#if AGENTX_COPILOT_CHAT`. | DONE |
| H-3 | Workspace root cache not invalidated | Add `WorkspaceRootChanged` event + `Reset()` to `WorkspaceResolver`; subscribe in tool window; clear watchers + reset notifier on change. | DONE |
| H-4 | File watchers not debounced + not disposed | 500ms debounce per watcher (`AutoReset = false`, Stop+Start); `IDisposable` on tool window control with `public new void Dispose()`. | DONE |
| Maj-1 | Tool window not docked right | Use `ToolWindowPlacement.DockedTo(SolutionExplorerToolWindowGuid)`. SDK 17.14 OOP exposes only `DocumentWell`, `Floating`, `DockedTo(Guid)` -- no `DockedRight` enum. Documented as PARTIAL. | PARTIAL |
| Maj-2 | No persistent loop status indicator | Add `ShowLoopStatusNotifications` boolean setting (default true) + `LoopStatusNotifier` service that emits `Shell().ShowPromptAsync` only on `active -> complete` or `active -> blocked`. SDK 17.14 OOP has no `IVsStatusbar`, so transient prompt is the closest parity. Documented as PARTIAL. | PARTIAL |
| Maj-3 | No environment health check command | Add `DependencyChecker` service with severity-tiered probes; add `CheckEnvironmentCommand` under Tools menu; render report via `Shell().ShowPromptAsync`. | DONE |

## Verification Strategy

- `dotnet build .\AgentX.VisualStudio.sln -c Release` MUST be 0 warn / 0 err.
- `dotnet test .\AgentX.VisualStudio.sln -c Release --no-build` MUST be >=37 pass / 0 fail.
- TRX evidence captured per loop iteration under `.agentx/state/loop-evidence/iter-*`.
- Quality loop: >=5 iterations, >=1 summary containing `review`, then `loop complete`.
