# AgentX Visual Studio Extension - Smoke Test Checklist

**Audience**: anyone validating a fresh build of the AgentX VS extension before publishing or before flipping `Preview=false`.

**Build under test**: `vs-extension/AgentX.VisualStudio/bin/Release/net8.0-windows/AgentX.VisualStudio.vsix`

**Expected version**: matches `version.json` (currently `8.4.45`).

> Screenshots referenced below should be captured during a real run and saved under `docs/ux/assets/vs-extension/<section>-<state>.png`. Placeholders are accepted for the first publish; replace with real captures during the next manual smoke pass.

---

## 1. Environment Prerequisites

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Visual Studio 2022 17.14 or later installed | `Help -> About` shows `17.14.x` or higher | `01-env-vs-version.png` | |
| `Microsoft.VisualStudio.Component.CoreEditor` workload component installed | Listed under `Help -> About -> Installed Products` | `01-env-coreeditor.png` | |
| PowerShell 7.x available on PATH (`pwsh`) | `pwsh -v` prints `7.x` | `01-env-pwsh.png` | |
| AgentX CLI bootstrapped in workspace | `.agentx\agentx-cli.ps1` and `.agentx\agentx.ps1` exist | `01-env-cli.png` | |

---

## 2. Install

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Double-click the VSIX | VSIX Installer launches and lists `AgentX - Multi-Agent Orchestration` | `02-install-installer.png` | |
| Read displayed metadata | DisplayName, Publisher (`Piyush Jain`), Version (`8.4.45.0`), License (Apache-2.0), Preview badge | `02-install-metadata.png` | |
| Click `Install` | Installer reports success; VS instances close as required | `02-install-success.png` | |
| Restart VS | New process launches without error | `02-install-restart.png` | |
| Open `Extensions -> Manage Extensions -> Installed` | `AgentX - Multi-Agent Orchestration` listed; version matches | `02-install-listed.png` | |

---

## 3. First Open

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Open the AgentX-bootstrapped repository | VS recognizes the workspace; no startup errors | `03-open-workspace.png` | |
| Open the AgentX tool window: `View -> Other Windows -> AgentX` | Tool window appears, docked or floating | `03-open-toolwindow.png` | |
| Confirm 5 tabs: Status / Workflows / Loop / Council / Agents | All five tabs visible and selectable | `03-open-tabs.png` | |
| Auto-refresh fires on first show | Status tab populates without manual `Refresh` click | `03-open-autorefresh.png` | |
| Confirm workspace path is detected | Header shows the repository root | `03-open-workspaceroot.png` | |

---

## 4. Status Tab

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Loop Status panel renders structured properties | `State`, `Iteration`, `Issue`, `Prompt`, `Last iteration` rows present | `04-status-loopstatus.png` | |
| Recent history displays the latest iterations | Up to 5 entries, newest last | `04-status-history.png` | |
| Ready Issues list shows issue cards | `#<number>`, label chips, title, state per row | `04-status-ready.png` | |
| Agent State list shows alphabetical agents | `Name`, status badge, `#<issue>`, last-activity (local time) | `04-status-agents.png` | |
| Force a malformed CLI output (rename `agentx-cli.ps1`) and click `Refresh` | Each section falls back to formatted text in a fallback TextBox; no exception | `04-status-fallback.png` | |
| Click `Refresh` | Spinner shows briefly; data reloads | `04-status-refresh.png` | |
| `Tools -> AgentX: Show Agent Status` (or Ctrl+Q `AgentX: Show Agent Status`) | Output pane prints `agentx state` followed by a `Workflow shortcuts available (Tools menu / Ctrl+Q):` trailer listing all 8 `AgentX: Workflow - {Feature,Epic,Story,Bug,Spike,DevOps,Docs,Iterative Loop}` shortcuts | `04-status-workflow-trailer.png` | |

---

## 5. Workflows Tab

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| 8 workflows are listed (feature, epic, story, bug, spike, devops, docs, iterative-loop) | Buttons render for each | `05-workflows-list.png` | |
| Click `feature` and confirm | Output pane shows CLI output; status updates | `05-workflows-run.png` | |
| Cancel mid-run if available | Process terminates cleanly | `05-workflows-cancel.png` | |

---

## 6. Loop Tab

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Loop start button enabled when no loop active | Prompt box accepts text | `06-loop-start.png` | |
| `Start Loop` with a sample prompt | Loop becomes active; Status tab reflects state | `06-loop-active.png` | |
| `Iterate` with a summary | Iteration counter increments | `06-loop-iterate.png` | |
| `Complete Loop` | Loop transitions to inactive | `06-loop-complete.png` | |
| `Rollback Loop` (when active) | Loop reset to a prior iteration | `06-loop-rollback.png` | |
| After `Rollback Loop` (active loop, iteration > 1) | Iteration counter decrements by 1 (the Tools menu invokes `loop rollback` with no count argument; `-n <count>` is available from the terminal); the most recent `History` entry is dropped; Status tab auto-refreshes to reflect the new iteration and history | `06-loop-rollback-after.png` | |
| `Tools -> AgentX: Rollback Loop` from the menu | Same effect as the tool-window `Rollback Loop` button; `Output` pane prints the CLI exit line | `06-loop-rollback-tools.png` | |

---

## 7. Council Tab

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| 5 roles listed: research, prd-scope, adr-options, ai-design, code-review | Buttons render for each | `07-council-list.png` | |
| Click `code-review` | Output pane streams CLI text | `07-council-run.png` | |

---

## 8. Agents Tab

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| `Add Agent` and `Add Skill` controls visible | Both buttons enabled | `08-agents-controls.png` | |
| Trigger `Add Agent` happy path | Output pane reflects scaffold | `08-agents-add.png` | |

---

## 9. Output / Log

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Output pane shows interleaved CLI output | Lines append in order; no truncation in scrollback | `09-output-stream.png` | |
| Errors are surfaced in red or with `[FAIL]` prefix | Distinguishable from informational lines | `09-output-error.png` | |

---

## 10. Auto-Refresh and Background Activity

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| Open another tool window, then re-open AgentX | Status auto-refreshes on focus | `10-autorefresh-focus.png` | |
| External `agentx loop iterate` from terminal | AgentX tool window picks up the change on next refresh | `10-autorefresh-external.png` | |

---

## 11. Uninstall

| Step | Expected | Screenshot | Pass/Fail |
|------|----------|------------|-----------|
| `Extensions -> Manage Extensions` -> select `AgentX - Multi-Agent Orchestration` -> `Uninstall` | Marked for uninstall on next restart | `11-uninstall-marked.png` | |
| Restart VS | VSIX Installer runs and removes the extension cleanly | `11-uninstall-success.png` | |
| Re-open VS | AgentX tool window no longer in `View -> Other Windows` | `11-uninstall-gone.png` | |

---

## Sign-off

| Field        | Value           |
|--------------|-----------------|
| Date         |                 |
| Tester       |                 |
| VS version   |                 |
| Build SHA    |                 |
| VSIX version |                 |
| Result       | Pass / Fail     |
| Notes        |                 |

When this checklist passes end-to-end, the team may flip `Preview=false` in `vs-extension/AgentX.VisualStudio/source.extension.vsixmanifest` (or the equivalent generated entry) and bump `version.json`.
