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
import { silentVersionSync } from './utils/versionChecker';
import { checkCompanionExtensions } from './utils/companionExtensions';
import { getQualityStateDisplay } from './utils/loopStateChecker';
import { readHarnessState } from './utils/harnessState';

let agentxContext: AgentXContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 agentxContext = new AgentXContext(context);
 const sidebarProviders = createSidebarProviders(agentxContext);

 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(hubot) AgentX';
 statusBar.tooltip = 'AgentX - Multi-Agent Orchestration';
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
  statusBar.tooltip = `AgentX - Multi-Agent Orchestration\n${qualityState}`;

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

 // Register chat participant (Copilot Chat integration -- only when API available)
 if (typeof vscode.chat?.createChatParticipant === 'function') {
  registerChatParticipant(context, agentxContext);
 }

 // Auto-discover AgentX when config or MCP files change
 const configWatcher = vscode.workspace.createFileSystemWatcher('**/.agentx/config.json');
 const mcpWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/mcp.json');
 const gitConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.git/config');
 const onConfigChange = () => {
  agentxContext.invalidateCache();
  clearInstructionCache();
    updateUiState().then(() => {
     if (agentxContext.workspaceRoot) {
        refreshSidebarProviders(sidebarProviders);
     }
    });
 };
 const onGitRemoteChange = () => {
   void syncAutoAdapters()
    .catch(() => { /* ignore */ })
    .finally(() => onConfigChange());
 };
 configWatcher.onDidCreate(onConfigChange);
 configWatcher.onDidChange(onConfigChange);
 configWatcher.onDidDelete(onConfigChange);
 mcpWatcher.onDidCreate(onConfigChange);
 mcpWatcher.onDidChange(onConfigChange);
 mcpWatcher.onDidDelete(onConfigChange);
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
