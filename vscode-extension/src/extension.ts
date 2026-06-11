import * as vscode from 'vscode';
import { registerAgentXCommands } from './commands/registry';
import {
 createSidebarProviders,
 refreshSidebarProviders,
 registerSidebarProviders,
} from './views/registry';
import { AgentXContext } from './agentxContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import { runSetupWizard } from './commands/setupWizard';
import { syncDetectedAdoAdapter, syncDetectedGitHubAdapter } from './commands/adaptersCommandInternals';
import { readCliAssetState, refreshCopilotCliSymlinks } from './commands/initializeInternals';
import { silentVersionSync } from './utils/versionChecker';
import { checkCompanionExtensions } from './utils/companionExtensions';
import {
 enableInAgentsWindow,
 maybePromptForAgentsWindow,
} from './utils/agentsWindowOptIn';
import { getQualityStateDisplay } from './utils/loopStateChecker';
import { readHarnessState } from './utils/harnessState';

let agentxContext: AgentXContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 agentxContext = new AgentXContext(context);
 const sidebarProviders = createSidebarProviders(agentxContext);

 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(hubot) AgentX';
 statusBar.tooltip = 'AgentX - Digital Force for Software Delivery';
 statusBar.command = 'agentx.showStatus';
 statusBar.show();
 context.subscriptions.push(statusBar);

 const updateUiState = async (): Promise<void> => {
  const initialized = await agentxContext.checkInitialized();
  const root = agentxContext.workspaceRoot;
  const qualityState = root ? getQualityStateDisplay(root) : 'No workspace';
  const harnessState = root ? readHarnessState(root) : undefined;
  const harnessActive = harnessState
   ? harnessState.threads.some((thread) => thread.status === 'active')
   : false;

  statusBar.text = '$(hubot) AgentX';
  statusBar.tooltip = `AgentX - Digital Force for Software Delivery\n${qualityState}`;

  await vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
  await vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentxContext.githubConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentxContext.adoConnected);
  await vscode.commands.executeCommand('setContext', 'agentx.harnessActive', harnessActive);
 };

 const syncAutoAdapters = async (): Promise<void> => {
   const githubChanged = await syncDetectedGitHubAdapter(agentxContext);
   const adoChanged = await syncDetectedAdoAdapter(agentxContext);
   const changed = githubChanged || adoChanged;
  if (changed) {
   clearInstructionCache();
   refreshSidebarProviders(sidebarProviders);
  }
 };

 // Register sidebar tree view providers (VS Code-only value)
 registerSidebarProviders(sidebarProviders);

 // Register commands
 registerAgentXCommands(context, agentxContext);

 // Refresh all views
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.refresh', () => {
   agentxContext.invalidateCache();
   refreshSidebarProviders(sidebarProviders);
   clearInstructionCache();
    void updateUiState();
   vscode.window.showInformationMessage('AgentX: Refreshed all views.');
  })
 );

 // Environment health check
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.checkEnvironment', () => {
   runSetupWizard(agentxContext);
  })
 );

 // Manual opt-in into the VS Code Agents Window. Power-user command that
 // performs the same idempotent merge as the activation prompt, with no
 // questions asked. See utils/agentsWindowOptIn.ts and
 // docs/execution/contracts/CONTRACT-400-agents-window-slice2.md.
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.enableInAgentsWindow', async () => {
   try {
    await enableInAgentsWindow();
    const reload = 'Reload Window';
    const later = 'Later';
    const choice = await vscode.window.showInformationMessage(
     'AgentX is now enabled in the Agents Window. Reload the window to apply?',
     reload,
     later,
    );
    if (choice === reload) {
     await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
   } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AgentX: failed to enable in Agents Window: ${message}`);
   }
  }),
 );

 // Register chat participant (Copilot Chat integration -- only when API available)
 if (typeof vscode.chat?.createChatParticipant === 'function') {
  registerChatParticipant(context, agentxContext);
 }

 // Auto-discover AgentX when config or MCP files change
 const configWatcher = vscode.workspace.createFileSystemWatcher('**/.agentx/config.json');
 const mcpWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/mcp.json');
 const gitConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.git/config');

 // Debounce refreshes. .git/config in particular is touched frequently by
 // VS Code's git extension, gh, and Copilot, which would otherwise trigger
 // a refresh storm (each refresh re-runs `gh issue list`, ~2-5s).
 let refreshTimer: NodeJS.Timeout | undefined;
 const scheduleRefresh = () => {
  if (refreshTimer) { clearTimeout(refreshTimer); }
  refreshTimer = setTimeout(() => {
   refreshTimer = undefined;
   agentxContext.invalidateCache();
   clearInstructionCache();
   void updateUiState().then(() => {
    if (agentxContext.workspaceRoot) {
     refreshSidebarProviders(sidebarProviders);
    }
   });
  }, 500);
 };

 // Only refresh on git remote changes when adapter detection actually
 // produced a change. syncAutoAdapters already triggers its own refresh
 // (see line ~57) when it detects a new GitHub/ADO remote.
 const onGitRemoteChange = () => {
  void syncAutoAdapters().catch(() => { /* ignore */ });
 };
 configWatcher.onDidCreate(scheduleRefresh);
 configWatcher.onDidChange(scheduleRefresh);
 configWatcher.onDidDelete(scheduleRefresh);
 mcpWatcher.onDidCreate(scheduleRefresh);
 mcpWatcher.onDidChange(scheduleRefresh);
 mcpWatcher.onDidDelete(scheduleRefresh);
 gitConfigWatcher.onDidCreate(onGitRemoteChange);
 gitConfigWatcher.onDidChange(onGitRemoteChange);
 gitConfigWatcher.onDidDelete(onGitRemoteChange);
 context.subscriptions.push(configWatcher, mcpWatcher, gitConfigWatcher);

 // Silently sync workspace version.json to match extension version (non-blocking)
 silentVersionSync(
  agentxContext.workspaceRoot ?? '',
  context.extension.packageJSON.version,
  context.extensionPath
 ).catch(() => { /* ignore */ });

 // Check companion extensions are installed (non-blocking)
 checkCompanionExtensions(agentxContext.workspaceRoot).catch(() => { /* ignore */ });

 // One-time prompt: opt every install/upgrade into the VS Code Agents
 // Window. Self-gates on globalState; safe to call on every activation.
 void maybePromptForAgentsWindow(
  context,
  context.extension.packageJSON.version,
 ).catch(() => { /* ignore */ });

 // Refresh CLI symlinks if the workspace was initialized in symlink mode.
 // The extension version folder changes on upgrade, so any stale junctions
 // need to be re-pointed at the current bundle.
 try {
  const wsRoot = agentxContext.workspaceRoot;
  if (wsRoot) {
   const cliState = readCliAssetState(wsRoot);
   if (cliState && cliState.mode === 'symlink') {
    refreshCopilotCliSymlinks(context.extensionUri.fsPath, wsRoot);
   }
  }
 } catch { /* non-fatal */ }

 // Set initial context flags
 void syncAutoAdapters()
  .catch(() => { /* ignore */ })
  .finally(() => {
   void updateUiState();
  });

 console.log('AgentX extension activated.');
}

export function deactivate() {
 console.log('AgentX extension deactivated.');
}
