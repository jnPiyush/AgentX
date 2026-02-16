import * as vscode from 'vscode';
import { registerInitializeCommand } from './commands/initialize';
import { registerStatusCommand } from './commands/status';
import { registerReadyQueueCommand } from './commands/readyQueue';
import { registerWorkflowCommand } from './commands/workflow';
import { registerDepsCommand } from './commands/deps';
import { registerDigestCommand } from './commands/digest';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { ReadyQueueTreeProvider } from './views/readyQueueTreeProvider';
import { WorkflowTreeProvider } from './views/workflowTreeProvider';
import { AgentXContext } from './agentxContext';

let agentxContext: AgentXContext;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 agentxContext = new AgentXContext(context);

 // Register tree view providers
 const agentTreeProvider = new AgentTreeProvider(agentxContext);
 const readyQueueProvider = new ReadyQueueTreeProvider(agentxContext);
 const workflowProvider = new WorkflowTreeProvider(agentxContext);

 vscode.window.registerTreeDataProvider('agentx-agents', agentTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-ready', readyQueueProvider);
 vscode.window.registerTreeDataProvider('agentx-workflows', workflowProvider);

 // Register commands
 registerInitializeCommand(context, agentxContext);
 registerStatusCommand(context, agentxContext);
 registerReadyQueueCommand(context, agentxContext, readyQueueProvider);
 registerWorkflowCommand(context, agentxContext);
 registerDepsCommand(context, agentxContext);
 registerDigestCommand(context, agentxContext);

 // Refresh command
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.refresh', () => {
 agentTreeProvider.refresh();
 readyQueueProvider.refresh();
 workflowProvider.refresh();
 vscode.window.showInformationMessage('AgentX: Refreshed all views.');
 })
 );

 // Set initialized context for menu visibility
 agentxContext.checkInitialized().then((initialized: boolean) => {
 vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
 });

 // Status bar item
 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(organization) AgentX';
 statusBar.tooltip = 'AgentX - Multi-Agent Orchestration';
 statusBar.command = 'agentx.showStatus';
 statusBar.show();
 context.subscriptions.push(statusBar);

 console.log('AgentX extension activated.');
}

export function deactivate() {
 console.log('AgentX extension deactivated.');
}
