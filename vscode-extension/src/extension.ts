import * as vscode from 'vscode';
import { registerInitializeCommand } from './commands/initialize';
import { registerStatusCommand } from './commands/status';
import { registerWorkflowCommand } from './commands/workflow';
import { registerDepsCommand } from './commands/deps';
import { registerDigestCommand } from './commands/digest';
import { registerLoopCommand } from './commands/loopCommand';
import { registerShowIssueCommand } from './commands/showIssue';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { TemplateTreeProvider } from './views/templateTreeProvider';
import { AgentXContext } from './agentxContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import { runSetupWizard, runSilentInstall } from './commands/setupWizard';
import { silentVersionSync } from './utils/versionChecker';

let agentxContext: AgentXContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 agentxContext = new AgentXContext(context);

 // Register sidebar tree view providers (VS Code-only value)
 const agentTreeProvider = new AgentTreeProvider(agentxContext);
 const templateProvider = new TemplateTreeProvider(agentxContext);

 vscode.window.registerTreeDataProvider('agentx-agents', agentTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-templates', templateProvider);

 // Register commands
 registerInitializeCommand(context, agentxContext);
 registerStatusCommand(context, agentxContext);
 registerWorkflowCommand(context, agentxContext);
 registerDepsCommand(context, agentxContext);
 registerDigestCommand(context, agentxContext);
 registerLoopCommand(context, agentxContext);

 // Show issue detail (used by agent tree item click)
 registerShowIssueCommand(context, agentxContext);

 // Refresh all views
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.refresh', () => {
   agentxContext.invalidateCache();
   agentTreeProvider.refresh();
   templateProvider.refresh();
   clearInstructionCache();
   agentxContext.checkInitialized().then((initialized: boolean) => {
    vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
    vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentxContext.githubConnected);
    vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentxContext.adoConnected);
   });
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
 const onConfigChange = () => {
  agentxContext.invalidateCache();
  clearInstructionCache();
  agentxContext.checkInitialized().then((initialized: boolean) => {
   vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
   vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentxContext.githubConnected);
   vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentxContext.adoConnected);
   if (initialized) {
    agentTreeProvider.refresh();
   }
  });
 };
 configWatcher.onDidCreate(onConfigChange);
 configWatcher.onDidDelete(onConfigChange);
 mcpWatcher.onDidCreate(onConfigChange);
 mcpWatcher.onDidChange(onConfigChange);
 mcpWatcher.onDidDelete(onConfigChange);
 context.subscriptions.push(configWatcher, mcpWatcher);

 // Status bar
 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(hubot) AgentX';
 statusBar.tooltip = 'AgentX - Multi-Agent Orchestration';
 statusBar.command = 'agentx.showStatus';
 statusBar.show();
 context.subscriptions.push(statusBar);

 // Silently sync workspace version.json to match extension version (non-blocking)
 silentVersionSync(
  agentxContext.workspaceRoot ?? '',
  context.extension.packageJSON.version,
  context.extensionPath
 ).catch(() => { /* ignore */ });

 // Run silent install (non-blocking)
 runSilentInstall(agentxContext).catch(() => { /* ignore */ });

 // Set initial context flags
 agentxContext.checkInitialized().then((initialized: boolean) => {
  vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
  vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentxContext.githubConnected);
  vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentxContext.adoConnected);
 });

 console.log('AgentX extension activated.');
}

export function deactivate() {
 console.log('AgentX extension deactivated.');
}
