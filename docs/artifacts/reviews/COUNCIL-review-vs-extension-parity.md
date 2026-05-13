# Model Council: review-vs-extension-parity

**Convened:** 2026-05-13T01:04:45Z
**Mode:** agent-internal (calling agent adopts each role and writes responses below)
**Purpose pack:** code-review

## Question

Given the VS extension diff at commit 619d259 vs the VS Code reference, and the 8-category review checklist (spec conformance, code quality, testing, security, performance, error handling, documentation, intent preservation), what is the correct Approve / Request Changes / Reject decision? What is the correct severity for each parity finding? What is the strongest case AGAINST the leaning decision (Request Changes)?

## Supporting Context

VS Code surface: 48 commands, 4 sidebar tree views (Work/Status/Templates/Skills), live @agentx chat participant with 20+ intent handlers, status bar item, debounced file watchers (.agentx/config.json, .vscode/mcp.json, .git/config), setup wizard, auto-adapter detection, version sync, companion-extension check, CLI symlink refresh. VS extension surface: 31 [VisualStudioContribution] commands all on Tools menu, 1 floating tool window with 5 tabs, chat tool stubbed behind #if AGENTX_COPILOT_CHAT (no DefineConstants, no PackageReference - dead code), 6 settings, no status bar, no file watchers, no setup wizard, no auto-adapter detection. Build/test status: dotnet build Release SUCCESS 0 warnings 0 errors; 37/37 xUnit tests pass; VSIX 4MB Preview=true. Workspace state: marketplace dryrun report exists in commit 619d259 but staged for deletion in working tree. Leaning decision: REQUEST CHANGES based on missing chat (HIGH), missing sidebar (HIGH), 17-command gap (MAJOR), no live refresh (MAJOR), no status bar (MAJOR), no setup wizard (MAJOR), no version sync (MAJOR). Mitigating: this is a Preview release explicitly scoped per AgentX.VisualStudio.csproj <Preview>true</Preview>; CLI bridge is solid; Status tab structured WPF + fallback well-designed; tests comprehensive. Top 5 findings with file:line: (1) AgentXChatTool.cs all wrapped in #if AGENTX_COPILOT_CHAT, csproj line 30 comments out PackageReference - effectively zero chat surface; (2) AgentXToolWindow.cs ToolWindowPlacement.Floating - never docks; (3) Commands/*.cs all use ToolsMenu placement only - no keyboard shortcuts, no context menus, no Status Bar; (4) AgentXToolWindowControl.cs RefreshAsync only fires on tool window load - no FileSystemWatcher equivalent; (5) WorkspaceResolver.cs depends on Environment.CurrentDirectory only - no VS Solution events subscription so fails when user opens different solution mid-session.

## Council Roster

| Role | Model |
|------|-------|
| Analyst | `openai/gpt-5.4` |
| Strategist | `anthropic/claude-opus-4.7` |
| Skeptic | `google/gemini-3.1-pro` |

## Member Responses

### Analyst -- `openai/gpt-5.4`

## Position

The diff ships a working but partial parity shell. Build/test gates pass cleanly (0/0 + 37/37). The defects that matter are functional-surface absences, not code-quality bugs in what was written. The leaning decision (Request Changes) is correct for "general availability parity" but is too strict for a Preview milestone if the gaps are documented as known limitations. Severity should hinge on whether the user-visible promise of "AgentX in Visual Studio" is met without the chat surface and live refresh; my read: it is not.

## Key Reasoning

* **Spec/Intent (HIGH)** -- [Chat/AgentXChatTool.cs](vs-extension/AgentX.VisualStudio/Chat/AgentXChatTool.cs) is wholly inside `#if AGENTX_COPILOT_CHAT`; [AgentX.VisualStudio.csproj L30](vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj#L30) keeps the Copilot Chat `PackageReference` commented out and there is no `<DefineConstants>AGENTX_COPILOT_CHAT</DefineConstants>` anywhere. The compiler strips the entire chat tool. VS Code's `agentx.chat` participant ([vscode-extension/src/chat/chatParticipant.ts](vscode-extension/src/chat/chatParticipant.ts)) is the dominant interaction surface; absence here is a functional spec gap, not a polish gap.
* **Spec/Intent (HIGH)** -- VS Code declares 4 sidebar tree views ([vscode-extension/package.json L387-L420](vscode-extension/package.json#L387-L420)) backed by `WorkTreeProvider`/`AgentTreeProvider`/`StatusTreeProvider`. The VS extension exposes only [AgentXToolWindow.cs](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindow.cs) with `Placement = ToolWindowPlacement.Floating`, so users get one un-docked window with five tabs. This is a concrete, file-cited drift from the documented surface.
* **Code Quality (MAJOR)** -- VS Code wires 48 commands ([vscode-extension/package.json L979 + grep `"command": "agentx.`](vscode-extension/package.json#L979)); VS extension wires 31 (`Select-String '\[VisualStudioContribution\]' Commands\*.cs` -> 31). The 17-command delta is concentrated in high-leverage flows: setup wizard (`checkEnvironment`), `addRemoteAdapter`, `addLlmAdapter`, `addPlugin`, AI evaluation triplet, task-bundle quartet, bounded-parallel quartet, learning-capture commands, review-finding commands, and `showPendingClarification`. Reproduction: diff the two command lists.
* **Code Quality (MAJOR)** -- [extension.ts L88-L131](vscode-extension/src/extension.ts#L88-L131) wires three `FileSystemWatcher`s with a 500 ms debounced refresh. [AgentXToolWindowControl.cs](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.cs) only fires `RefreshAsync` on tool window load. VS users will see stale state after `agentx config set`, `git remote add`, or `.vscode/mcp.json` edits.
* **Code Quality (MAJOR)** -- [extension.ts L21-L31](vscode-extension/src/extension.ts#L21-L31) creates a `$(hubot) AgentX` status bar that surfaces loop quality state. The VS extension never registers an `IInfoBar`, status bar entry, or `IVsStatusbar` element. Loop state is invisible unless the tool window is open.
* **Testing (PASS, with caveat)** -- 37/37 xUnit tests pass and cover `AgentXCliJson` parser/formatter behaviors thoroughly ([AgentXCliJsonTests.cs](vs-extension/AgentX.VisualStudio.Tests/AgentXCliJsonTests.cs)). However, there are zero tests for command activation, settings read, workspace resolution, or tool window XAML wiring. Coverage is deep where it exists, narrow in scope.
* **Security (PASS)** -- [AgentXCli.cs](vs-extension/AgentX.VisualStudio/AgentXCli.cs) uses `ProcessStartInfo.ArgumentList` (no string concatenation), sets `NO_COLOR=1` and `AGENTX_WORKSPACE_ROOT`, and routes through `pwsh`/`bash` resolvers. No SQL, no secrets in code, no SSRF surface.

## What Could Make Me Wrong

* If the spec intent for the VS extension was explicitly "CLI shell + tool window only, defer chat to a follow-up Preview increment", then the chat absence is a documented descope, not a defect, and HIGH drops to MEDIUM.
* If marketplace policy requires Preview extensions to ship without Copilot Chat (license / SDK availability), the chat finding is a vendor constraint and should be downgraded.
* The 17-command gap could be intentional triage if the missing flows are not yet documented as user-facing in the VS extension's README.

### Strategist -- `anthropic/claude-opus-4.7`

## Position

Request Changes is the right call, but the framing should be "block GA, conditionally allow Preview". The build is sound, the CLI bridge is the load-bearing piece for both surfaces, and the polish quartet executed cleanly. What blocks the implicit promise of "AgentX in Visual Studio" is two missing user surfaces (chat + dockable sidebar) and the live-state plumbing that makes them feel alive. The smallest viable fix is to (a) ship the chat tool behind a real preview flag with feature-gated activation, (b) re-place the tool window to a dockable position, (c) add a status bar item driven by the existing `loop status --json` parser, and (d) add solution-event-driven refresh -- in that order.

## Key Reasoning

* **Block on chat** -- The whole AgentX value proposition in 2026 is conversational orchestration. A VS extension without `@agentx` (or a VS-native equivalent) is an adoption ceiling we will pay for forever. Ship the `Microsoft.VisualStudio.Extensibility.Copilot.Chat` PackageReference, define the build constant, and wire activation to the SDK availability probe similar to VS Code's `if (typeof vscode.chat?.createChatParticipant === 'function')` pattern in [extension.ts L82-L84](vscode-extension/src/extension.ts#L82-L84).
* **Block on docked surface, not on the tool window itself** -- VS Extensibility 17.14 supports `ToolWindowPlacement.DockedRight` (and persisted `DockedTabbedRight`). Switching [AgentXToolWindow.cs](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindow.cs) from `Floating` to a docked default is a single-line change. The 5-tab layout is acceptable -- VS users live with tabbed tool windows constantly. We do NOT need to recreate four separate `IVsTreeView` providers to be at parity; one well-organized tabbed tool window is fine if it's docked and refreshes live.
* **Conditional approve on the command surface** -- 31 of 48 commands is enough to prove the integration. The missing 17 are real, but most map to advanced flows (bounded parallel, task bundles, AI evaluation) that are themselves Preview features in VS Code. Severity MAJOR not Critical: ship a parity matrix in the VS extension README and track each missing command as a story. Do not block Preview on this.
* **Block on no live refresh** -- This one is non-negotiable. Without `IVsRunningDocumentTable` events or a `FileSystemWatcher` on `.agentx/config.json` and `.git/config`, the tool window will lie. A user runs `agentx loop iterate`, looks at the tool window, sees stale state, files a bug. Add `FileSystemWatcher` in `AgentXToolWindowControl.cs.OnInitialized` with a 500 ms debounce mirroring [extension.ts L98-L131](vscode-extension/src/extension.ts#L98-L131).
* **Approve the engineering core** -- [AgentXCli.cs](vs-extension/AgentX.VisualStudio/AgentXCli.cs), [AgentXCliJson.cs](vs-extension/AgentX.VisualStudio/Services/AgentXCliJson.cs), [WorkspaceResolver.cs](vs-extension/AgentX.VisualStudio/Services/WorkspaceResolver.cs), [AgentXSettings.cs](vs-extension/AgentX.VisualStudio/Settings/AgentXSettings.cs), and the structured-WPF Status tab with `InverseBoolToVisibility` fallback are well-designed. The tests are real (37/37). Do not let parity criticism obscure that the foundation is correct.
* **Documentation gap is a real finding** -- The marketplace dryrun report being staged for deletion while the changes log claims it as "Added" is the kind of inconsistency that breaks reviewer trust. Either restore the file or update the changes log to reflect the deletion -- whichever was the actual intent.

## What Could Make Me Wrong

* If the team has explicit operator buy-in that "Preview = CLI bridge + tool window only", then Request Changes overstates the gap and Approve-as-Preview is defensible.
* If the missing 17 commands are intentionally CLI-only (because the user is expected to invoke them through `agentx <verb>` in Terminal), then surface parity is a non-goal and the severity drops.
* If a VS-Copilot-Chat SDK preview was unavailable when this branch shipped, the chat absence is a vendor constraint and should not block our review decision.

### Skeptic -- `google/gemini-3.1-pro`

## Position

Most of the leaning critique is correct in fact but mis-classified in severity. Two specific findings are likely false positives, two are real risks the diff scan missed, and the headline decision should be Request Changes -- but for fewer reasons than the leaning suggests, and with a sharper focus on the failure modes that will actually surface in production.

## Key Reasoning

* **Likely false positive: "command surface gap is MAJOR"** -- 31 vs 48 looks alarming until you read what's missing. The 17-command delta is dominated by `showPlanningLearnings`, `showReviewLearnings`, `showKnowledgeCaptureGuidance`, `showCompoundLoop`, `showWorkflowRolloutScorecard`, `showOperatorEnablementChecklist`, `showBrainstormGuide` -- these are markdown-viewer commands that open static docs. They do not gate any AgentX workflow. Severity is MEDIUM at most. The genuinely missing flows (chat, sidebar, AI eval, task bundles, bounded parallel) are <=8 commands. State the actual missing capability set, not the raw command count.
* **Likely false positive: "no version sync"** -- VS Code's `silentVersionSync` syncs the workspace `version.json` to the extension's bundled version because VS Code extensions ship the entire `.github/agentx/` tree. The VS extension does not ship a parallel asset bundle (no equivalent of `vscode-extension/scripts/copy-assets.js`) -- there is no asset to sync. The "missing version sync" is correctly absent because the underlying coupling does not exist. Drop this finding.
* **Hidden risk #1 (escalate to HIGH): WorkspaceResolver and solution switching** -- [WorkspaceResolver.cs L52-L56](vs-extension/AgentX.VisualStudio/Services/WorkspaceResolver.cs#L52-L56) anchors on `Environment.CurrentDirectory`. In VS, that is the IDE process working directory at launch -- not the active solution. Open VS, load Solution A (a non-AgentX repo), then switch to Solution B (an AgentX repo). The tool window will resolve to A or to nothing. The VS Code equivalent uses `vscode.workspace.workspaceFolders[0]` which fires `onDidChangeWorkspaceFolders`. There is no analogous subscription to VS solution-load events here. This will produce silent wrong-workspace bugs. Promote to HIGH and require subscription to `IVsSolutionEvents` or VS Extensibility's workspace change events.
* **Hidden risk #2 (escalate to HIGH): chat tool source compiles to nothing** -- The Skeptic position is NOT that chat is missing as a feature (the Strategist already said that). The real risk is that [AgentXChatTool.cs](vs-extension/AgentX.VisualStudio/Chat/AgentXChatTool.cs) sits in the source tree as dead code: `#if AGENTX_COPILOT_CHAT` with no `<DefineConstants>` means the compiler never sees it, so the file is silently rotting. Any future contributor will read the file, assume it ships, and be wrong. Either delete the file with a TODO note in [AgentX.VisualStudio.csproj L30](vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj#L30), or activate the build constant. "Stubbed dead code in production tree" is its own quality finding distinct from "missing feature".
* **Real risk Analyst undercounted: AsyncRelayCommand thread safety** -- [AsyncRelayCommand.cs L40-L57](vs-extension/AgentX.VisualStudio/ToolWindows/AsyncRelayCommand.cs#L40-L57) sets `_isRunning = true`, raises `CanExecuteChanged`, awaits, then sets `_isRunning = false`. If `Execute` is called twice in rapid succession on different threads (button + keyboard binding) before the first `RaiseCanExecuteChanged` propagates through WPF, both calls can pass `CanExecute` and start the CLI twice. WPF generally serializes UI events to the dispatcher thread so this is rare, but a `Refresh` keyboard binding fired during a click would expose it. Severity MINOR; recommend an `Interlocked.CompareExchange` guard.
* **Real risk Analyst undercounted: error swallowing in CLI streaming** -- [CommandBase.cs (RunCliAsync)](vs-extension/AgentX.VisualStudio/Commands/CommandBase.cs) (and the equivalent path in `AgentXCli.cs`) writes streamed output to the channel via fire-and-forget `_ = WriteLineAsync(...)`. A `TaskCanceledException` mid-stream will not surface to the user; the operation appears to silently succeed. Promote to MINOR with a structured-error path.
* **Genuine blocker confirmed**: The "no live refresh" finding is correctly HIGH/MAJOR. Without it the entire tool window misleads. This is the failure that will generate the most user-visible support load.
* **The Preview flag does not absolve us** -- `<Preview>true</Preview>` lets us ship with rough edges; it does not let us ship a tool window that lies, a workspace resolver that points at the wrong folder, and dead chat code in the source tree. Those are correctness issues, not polish.

## What Could Make Me Wrong

* If VS Extensibility 17.14's out-of-process model intentionally constrains current-directory semantics so that solution-load events ARE the working-directory change, my "wrong workspace on solution switch" risk evaporates. I have not verified this against the SDK docs.
* If the team plans to delete `AgentXChatTool.cs` in the next commit and re-add it when the SDK is GA, my "dead code rotting" framing is paranoid.
* If the structured-status fallback path in [AgentXToolWindowControl.xaml](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.xaml) populates from cached state on every CLI invocation (not only on tool window load), my "no live refresh" complaint is partially answered. I read the code as load-only; if I misread the trigger, downgrade to MEDIUM.

## Synthesis

### Consensus on Blocking Defects

All three members agree these block GA-grade approval (Strategist allows two of them as Preview-deferrable; Analyst and Skeptic do not). Lock at the agreed severity:

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | Copilot Chat surface is not shipped (chat tool source is dead-code-stubbed) | **HIGH** | [AgentXChatTool.cs](vs-extension/AgentX.VisualStudio/Chat/AgentXChatTool.cs) entire file inside `#if AGENTX_COPILOT_CHAT`; [csproj L30](vs-extension/AgentX.VisualStudio/AgentX.VisualStudio.csproj#L30) PackageReference commented out; no `<DefineConstants>AGENTX_COPILOT_CHAT</DefineConstants>` |
| 2 | Tool window placement is `Floating` -- never docks alongside Solution Explorer | **MAJOR** | [AgentXToolWindow.cs](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindow.cs) `Placement = ToolWindowPlacement.Floating` |
| 3 | No live refresh on workspace state changes (CLI config, MCP config, git remote) | **HIGH** | [AgentXToolWindowControl.cs](vs-extension/AgentX.VisualStudio/ToolWindows/AgentXToolWindowControl.cs) `RefreshAsync` only invoked from button handlers + `OnInitialized`; no `FileSystemWatcher`. Compare [vscode-extension/src/extension.ts L98-L131](vscode-extension/src/extension.ts#L98-L131) |
| 4 | WorkspaceResolver does not subscribe to VS solution-load events | **HIGH** (Skeptic-promoted) | [WorkspaceResolver.cs L52-L56](vs-extension/AgentX.VisualStudio/Services/WorkspaceResolver.cs#L52-L56) anchors on `Environment.CurrentDirectory`; no `IVsSolutionEvents` subscription. Solution switch leaves the tool window pointed at the original launch directory |
| 5 | No status bar / quality-state indicator | **MAJOR** | [vscode-extension/src/extension.ts L21-L31](vscode-extension/src/extension.ts#L21-L31) creates `$(hubot) AgentX` status bar; VS extension never registers an `IVsStatusbar` element |

### Divergences on Severity or Decision

| Topic | Analyst | Strategist | Skeptic | Resolution |
|-------|---------|------------|---------|------------|
| 17-command gap severity | MAJOR | MAJOR (advisory in Preview) | MEDIUM (most missing commands are doc viewers) | **Resolved as MEDIUM with caveat**: classify the 8 functional commands missing (chat, addRemoteAdapter, addLlmAdapter, addPlugin, scaffoldAIEvaluationContract, runAIEvaluation, createTaskBundle, startBoundedParallelDelivery) as MEDIUM each. The 9 doc-viewer commands are MINOR. |
| Setup wizard / `checkEnvironment` | MAJOR | MAJOR | (not addressed) | **Resolved as MAJOR** -- onboarding is a load-bearing UX surface; without `checkEnvironment` the user must read README to bootstrap |
| Version sync / companion check | MAJOR | (not addressed) | False positive (no asset bundle to sync) | **Resolved: drop "version sync" as a finding**, re-classify "companion-extension check" as MEDIUM (Azure Tools companion guidance is real) |
| Decision verb | Request Changes | Request Changes (Preview-conditional) | Request Changes (with sharper findings) | **Final: Request Changes** |

### Hidden Risks and False Positives Surfaced

**Promote into review document (new findings)**:

1. **AgentXChatTool.cs is dead-code-stubbed in the production source tree** (Skeptic) -- distinct from the missing-feature finding. Severity MINOR (code hygiene); fix by either deleting the file with a TODO note in the csproj or actually defining `AGENTX_COPILOT_CHAT`. Reproduction: `dotnet build` succeeds and the file's symbols never appear in the resulting DLL.
2. **AsyncRelayCommand re-entrancy guard is non-atomic** (Skeptic) -- [AsyncRelayCommand.cs L40-L57](vs-extension/AgentX.VisualStudio/ToolWindows/AsyncRelayCommand.cs#L40-L57). Severity MINOR; fix with `Interlocked.CompareExchange`.
3. **CLI streaming swallows write-channel exceptions** (Skeptic + partial Analyst) -- fire-and-forget `_ = Output.WriteLineAsync(...)` pattern. Severity MINOR; fix by awaiting writes inside the streaming callback or surfacing channel errors.
4. **Workspace state discrepancy: marketplace dryrun report staged for deletion** (Analyst) -- `git status` shows `D docs/artifacts/reviews/2026-05-12-vs-extension-marketplace-dryrun.md` while the changes log claims it under "Added (new files)". Severity MINOR; fix by reverting the deletion or amending the changes log.

**Drop / downgrade**:

* "No version sync" -- removed (Skeptic-justified false positive).
* "17-command gap is MAJOR" -- downgraded to MEDIUM for 8 functional commands + MINOR for 9 doc-viewer commands.

### Net Adjustment to Review Decision

| Aspect | Pre-Council | Post-Council |
|--------|-------------|--------------|
| Decision | Request Changes | Request Changes (unchanged) |
| HIGH findings | 2 (chat, sidebar) | 3 (chat shipped state, no live refresh, workspace solution switching) |
| MAJOR findings | 5 (commands, refresh, status bar, setup wizard, version sync) | 3 (tool window placement, status bar, setup wizard) |
| MEDIUM findings | 2 | 3 (functional command gap, companion check, settings parity) |
| MINOR findings | 1 | 5 (doc-viewer command gap, dead chat code, AsyncRelayCommand atomicity, fire-and-forget write errors, dryrun report deletion) |
| Per-category verdicts | Mixed | Mixed: Spec Conformance FAIL, Intent Preservation FAIL, Testing PASS, Security PASS, Code Quality PASS-with-issues, Performance PASS, Error Handling PASS-with-issues, Documentation FAIL |

The council confirms Request Changes. The fix list contracts (drop version sync, downgrade command count) but the new HIGH on workspace-resolver-on-solution-switch is more dangerous than the original two HIGH findings put together because it produces silently wrong CLI invocations.


