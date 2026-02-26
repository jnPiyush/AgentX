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
import { PluginManager } from './utils/pluginManager';
import { promptIfUpdateAvailable } from './utils/versionChecker';

let agentxContext: AgentXContext;
let eventBus: AgentEventBus;
let thinkingLog: ThinkingLog;
let contextCompactor: ContextCompactor;
let channelRouter: ChannelRouter;
let taskScheduler: TaskScheduler;
let pluginManager: PluginManager | undefined;

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

 // Initialize plugin manager
 if (agentxDir) {
  pluginManager = new PluginManager(agentxDir, eventBus);
 }

 // Store services on context for access by other modules
 agentxContext.setServices({ channelRouter, taskScheduler, pluginManager });

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

 // List installed plugins
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.listPlugins', async () => {
  if (!pluginManager) {
   vscode.window.showWarningMessage('AgentX: Not initialized. Plugins unavailable.');
   return;
  }
  const plugins = pluginManager.list();
  if (plugins.length === 0) {
   vscode.window.showInformationMessage(
    'AgentX: No plugins installed. Use "AgentX: Install Plugin" to add plugins.'
   );
   return;
  }
  const channel = vscode.window.createOutputChannel('AgentX Plugins');
  channel.clear();
  channel.appendLine('AgentX Installed Plugins\n');
  for (const p of plugins) {
   channel.appendLine(
    `[${p.manifest.type}] ${p.manifest.name} v${p.manifest.version} - ${p.manifest.description}`
   );
   if (p.manifest.requires && p.manifest.requires.length > 0) {
    channel.appendLine(`  Requires: ${p.manifest.requires.join(', ')}`);
   }
  }
  channel.show(true);
 })
 );

 // Run a plugin
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.runPlugin', async () => {
  if (!pluginManager) {
   vscode.window.showWarningMessage('AgentX: Not initialized. Plugins unavailable.');
   return;
  }
  const plugins = pluginManager.list();
  if (plugins.length === 0) {
   vscode.window.showInformationMessage('AgentX: No plugins installed.');
   return;
  }
  const pick = await vscode.window.showQuickPick(
   plugins.map((p) => ({
    label: p.manifest.name,
    description: `v${p.manifest.version} [${p.manifest.type}]`,
    detail: p.manifest.description,
    plugin: p,
   })),
   { placeHolder: 'Select a plugin to run', title: 'AgentX - Run Plugin' }
  );
  if (!pick) { return; }

  // Collect arguments if the plugin defines any
  const args: Record<string, string> = {};
  if (pick.plugin.manifest.args) {
   for (const arg of pick.plugin.manifest.args) {
    const value = await vscode.window.showInputBox({
     prompt: `${arg.name}: ${arg.description}`,
     value: arg.default ?? '',
     placeHolder: arg.required ? '(required)' : '(optional, press Enter to skip)',
    });
    if (value === undefined) { return; } // cancelled
    if (value.trim()) { args[arg.name] = value.trim(); }
   }
  }

  // Run in terminal
  const shell = agentxContext.getShell();
  const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');
  try {
   const cmd = pluginManager.buildRunCommand(
    pick.plugin.manifest.name,
    args,
    isPwsh ? 'pwsh' : 'bash',
   );
   const terminal = vscode.window.createTerminal(`AgentX: ${pick.plugin.manifest.name}`);
   terminal.show();
   terminal.sendText(cmd);
  } catch (err: unknown) {
   const msg = err instanceof Error ? err.message : String(err);
   vscode.window.showErrorMessage(`AgentX Plugin Error: ${msg}`);
  }
 })
 );

 // Scaffold a new plugin
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.scaffoldPlugin', async () => {
  if (!pluginManager) {
   vscode.window.showWarningMessage('AgentX: Not initialized.');
   return;
  }
  const name = await vscode.window.showInputBox({
   prompt: 'Plugin name (kebab-case)',
   placeHolder: 'my-plugin',
   validateInput: (v) => /^[a-z][a-z0-9-]*$/.test(v) ? undefined : 'Must be kebab-case (e.g., my-plugin)',
  });
  if (!name) { return; }

  const type = await vscode.window.showQuickPick(
   ['tool', 'skill', 'agent', 'channel', 'workflow'],
   { placeHolder: 'Plugin type', title: 'AgentX - Plugin Type' }
  );
  if (!type) { return; }

  const description = await vscode.window.showInputBox({
   prompt: 'Short description',
   placeHolder: 'What does this plugin do?',
  });
  if (!description) { return; }

  try {
   const dir = pluginManager.scaffold(name, type as any, description);
   vscode.window.showInformationMessage(`AgentX: Plugin '${name}' scaffolded at ${dir}`);
   // Open the plugin.json for editing
   const doc = await vscode.workspace.openTextDocument(path.join(dir, 'plugin.json'));
   vscode.window.showTextDocument(doc);
  } catch (err: unknown) {
   const msg = err instanceof Error ? err.message : String(err);
   vscode.window.showErrorMessage(`AgentX: ${msg}`);
  }
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

 // Version mismatch check - detect outdated framework files and prompt to upgrade
 setTimeout(async () => {
 try {
 const root = agentxContext.workspaceRoot;
 if (!root) { return; }
 const initialized = await agentxContext.checkInitialized();
 if (!initialized) { return; }
 const extVersion = context.extension.packageJSON?.version ?? '';
 if (!extVersion) { return; }
 await promptIfUpdateAvailable(root, extVersion, context.globalState);
 } catch (err) {
 console.warn('AgentX: Version check failed:', err);
 }
 }, 5000);

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
