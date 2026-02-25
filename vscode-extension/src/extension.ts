import * as vscode from 'vscode';
import * as path from 'path';
import { registerInitializeCommand } from './commands/initialize';
import { registerStatusCommand } from './commands/status';
import { registerReadyQueueCommand } from './commands/readyQueue';
import { registerWorkflowCommand } from './commands/workflow';
import { registerDepsCommand } from './commands/deps';
import { registerDigestCommand } from './commands/digest';
import { registerLoopCommand } from './commands/loopCommand';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { ReadyQueueTreeProvider } from './views/readyQueueTreeProvider';
import { WorkflowTreeProvider } from './views/workflowTreeProvider';
import { AgentXContext } from './agentxContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import {
 runSetupWizard,
 runStartupCheck,
 runCriticalPreCheck,
} from './commands/setupWizard';
import { AgentEventBus } from './utils/eventBus';
import { ThinkingLog } from './utils/thinkingLog';
import { ContextCompactor } from './utils/contextCompactor';
import { ChannelRouter, VsCodeChatChannel, CliChannel } from './utils/channelRouter';
import { TaskScheduler } from './utils/taskScheduler';

let agentxContext: AgentXContext;
let eventBus: AgentEventBus;
let thinkingLog: ThinkingLog;
let contextCompactor: ContextCompactor;
let channelRouter: ChannelRouter;
let taskScheduler: TaskScheduler;

export function activate(context: vscode.ExtensionContext) {
 console.log('AgentX extension activating...');

 // Initialize core infrastructure
 eventBus = new AgentEventBus();
 thinkingLog = new ThinkingLog(eventBus);
 contextCompactor = new ContextCompactor(eventBus);

 agentxContext = new AgentXContext(context, eventBus, thinkingLog, contextCompactor);

 // Initialize channel router with default channels
 channelRouter = new ChannelRouter(eventBus);
 channelRouter.register(new VsCodeChatChannel());
 channelRouter.register(new CliChannel());

 // Initialize task scheduler
 const agentxDir = agentxContext.workspaceRoot
  ? path.join(agentxContext.workspaceRoot, '.agentx')
  : undefined;
 taskScheduler = new TaskScheduler(eventBus, agentxDir);

 // Store services on context for access by other modules
 agentxContext.setServices({ channelRouter, taskScheduler });

 // Register disposables
 context.subscriptions.push({
  dispose: () => {
   eventBus.dispose();
   thinkingLog.dispose();
   channelRouter.stopAll();
   taskScheduler.dispose();
  }
 });

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
 registerLoopCommand(context, agentxContext);

 // Register chat participant (Copilot Chat integration)
 if (typeof vscode.chat?.createChatParticipant === 'function') {
 registerChatParticipant(context, agentxContext);
 }

 // Refresh command
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.refresh', () => {
 agentxContext.invalidateCache();
 agentTreeProvider.refresh();
 readyQueueProvider.refresh();
 workflowProvider.refresh();
 clearInstructionCache();
 // Re-check initialization state after cache clear
 agentxContext.checkInitialized().then((initialized: boolean) => {
 vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
 });
 vscode.window.showInformationMessage('AgentX: Refreshed all views.');
 })
 );

 // Environment health check command
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.checkEnvironment', () => {
 const mode = agentxContext.getMode();
 runSetupWizard(mode);
 })
 );

 // Show thinking log output channel
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.showThinkingLog', () => {
  thinkingLog.show();
 })
 );

 // Show context budget report
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.contextBudget', () => {
  const report = contextCompactor.formatBudgetReport();
  const channel = vscode.window.createOutputChannel('AgentX Context Budget');
  channel.clear();
  channel.appendLine(report);
  channel.show(true);
 })
 );

 // List scheduled tasks
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.listSchedules', async () => {
  const tasks = taskScheduler.getTasks();
  if (tasks.length === 0) {
   vscode.window.showInformationMessage(
    'AgentX: No scheduled tasks. Add tasks to .agentx/schedules.json.'
   );
   return;
  }
  const lines = tasks.map((t) =>
   `${t.enabled ? '[ON]' : '[OFF]'} ${t.id}: "${t.schedule}" - ${t.description}`
  );
  const channel = vscode.window.createOutputChannel('AgentX Schedules');
  channel.clear();
  channel.appendLine('AgentX Scheduled Tasks\n');
  for (const line of lines) { channel.appendLine(line); }
  channel.show(true);
 })
 );

 // Set initialized context for menu visibility
 agentxContext.checkInitialized().then((initialized: boolean) => {
 vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
 });

 // Non-blocking startup health check - runs after activation
 // Respects the agentx.skipStartupCheck setting
 const skipStartupCheck = vscode.workspace
 .getConfiguration('agentx')
 .get<boolean>('skipStartupCheck', false);
 if (!skipStartupCheck) {
 // Delay the check slightly so it does not block extension activation
 setTimeout(async () => {
 try {
 const mode = agentxContext.getMode();
 // Run critical pre-check - auto-installs missing required deps
 await runCriticalPreCheck(mode, /* blocking */ false);
 } catch (err) {
 // Startup check should never crash the extension
 console.warn('AgentX: Startup environment check failed:', err);
 }
 }, 3000);
 }

 // Watch for AGENTS.md appearing/disappearing in subfolders so the
 // extension auto-discovers AgentX when initialized in a nested path.
 const agentsWatcher = vscode.workspace.createFileSystemWatcher('**/AGENTS.md');
 const onAgentsChange = () => {
 agentxContext.invalidateCache();
 clearInstructionCache();
 agentxContext.checkInitialized().then((initialized: boolean) => {
 vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
 if (initialized) {
 agentTreeProvider.refresh();
 readyQueueProvider.refresh();
 workflowProvider.refresh();
 }
 });
 };
 agentsWatcher.onDidCreate(onAgentsChange);
 agentsWatcher.onDidDelete(onAgentsChange);
 context.subscriptions.push(agentsWatcher);

 // Status bar item
 const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
 statusBar.text = '$(hubot) AgentX';
 statusBar.tooltip = 'AgentX - Multi-Agent Orchestration';
 statusBar.command = 'agentx.showStatus';
 statusBar.show();
 context.subscriptions.push(statusBar);

 console.log('AgentX extension activated.');
}

export function deactivate() {
 // Cleanup handled by disposables registered in activate()
 console.log('AgentX extension deactivated.');
}
