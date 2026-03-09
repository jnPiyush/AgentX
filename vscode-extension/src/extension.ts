import * as vscode from 'vscode';
import { registerInitializeCommand } from './commands/initialize';
import { registerStatusCommand } from './commands/status';
import { registerWorkflowCommand } from './commands/workflow';
import { registerDepsCommand } from './commands/deps';
import { registerDigestCommand } from './commands/digest';
import { registerLoopCommand } from './commands/loopCommand';
import { registerShowIssueCommand } from './commands/showIssue';
import { registerPendingClarificationCommand } from './commands/pendingClarification';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { WorkTreeProvider } from './views/workTreeProvider';
import { WorkflowTreeProvider } from './views/workflowTreeProvider';
import { TemplateTreeProvider } from './views/templateTreeProvider';
import { QualityTreeProvider } from './views/qualityTreeProvider';
import { IntegrationTreeProvider } from './views/integrationTreeProvider';
import { AgentXContext } from './agentxContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import { runSetupWizard, runSilentInstall } from './commands/setupWizard';
import { silentVersionSync } from './utils/versionChecker';
import { checkCompanionExtensions } from './utils/companionExtensions';
import { getQualityStateDisplay } from './utils/loopStateChecker';
import { readHarnessState } from './utils/harnessState';

let agentxContext: AgentXContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 agentxContext = new AgentXContext(context);

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

 // Register sidebar tree view providers (VS Code-only value)
 const workTreeProvider = new WorkTreeProvider(agentxContext);
 const agentTreeProvider = new AgentTreeProvider(agentxContext);
 const workflowTreeProvider = new WorkflowTreeProvider(agentxContext);
 const templateProvider = new TemplateTreeProvider(agentxContext);
 const qualityTreeProvider = new QualityTreeProvider(agentxContext);
 const integrationTreeProvider = new IntegrationTreeProvider(agentxContext);

 vscode.window.registerTreeDataProvider('agentx-work', workTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-agents', agentTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-workflow', workflowTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-templates', templateProvider);
 vscode.window.registerTreeDataProvider('agentx-quality', qualityTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-integrations', integrationTreeProvider);

 // Register commands
 registerInitializeCommand(context, agentxContext);
 registerStatusCommand(context, agentxContext);
 registerWorkflowCommand(context, agentxContext);
 registerDepsCommand(context, agentxContext);
 registerDigestCommand(context, agentxContext);
 registerLoopCommand(context, agentxContext);

 // Show issue detail (used by agent tree item click)
 registerShowIssueCommand(context, agentxContext);
 registerPendingClarificationCommand(context, agentxContext);

 // Refresh all views
 context.subscriptions.push(
  vscode.commands.registerCommand('agentx.refresh', () => {
   agentxContext.invalidateCache();
   workTreeProvider.refresh();
   agentTreeProvider.refresh();
   workflowTreeProvider.refresh();
   templateProvider.refresh();
   qualityTreeProvider.refresh();
   integrationTreeProvider.refresh();
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
 const onConfigChange = () => {
  agentxContext.invalidateCache();
  clearInstructionCache();
    updateUiState().then(() => {
     if (agentxContext.workspaceRoot) {
        workTreeProvider.refresh();
        agentTreeProvider.refresh();
        workflowTreeProvider.refresh();
        templateProvider.refresh();
        qualityTreeProvider.refresh();
        integrationTreeProvider.refresh();
     }
    });
 };
 configWatcher.onDidCreate(onConfigChange);
 configWatcher.onDidDelete(onConfigChange);
 mcpWatcher.onDidCreate(onConfigChange);
 mcpWatcher.onDidChange(onConfigChange);
 mcpWatcher.onDidDelete(onConfigChange);
 context.subscriptions.push(configWatcher, mcpWatcher);

 // Silently sync workspace version.json to match extension version (non-blocking)
 silentVersionSync(
  agentxContext.workspaceRoot ?? '',
  context.extension.packageJSON.version,
  context.extensionPath
 ).catch(() => { /* ignore */ });

 // Run silent install (non-blocking)
 runSilentInstall(agentxContext).catch(() => { /* ignore */ });

 // Check companion extensions are installed (non-blocking)
 checkCompanionExtensions().catch(() => { /* ignore */ });

 // Set initial context flags
 void updateUiState();

 console.log('AgentX extension activated.');
}

export function deactivate() {
 console.log('AgentX extension deactivated.');
}
