import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerInitializeCommand } from './commands/initialize';
import { registerStatusCommand } from './commands/status';
import { registerReadyQueueCommand } from './commands/readyQueue';
import { registerWorkflowCommand } from './commands/workflow';
import { registerDepsCommand } from './commands/deps';
import { registerDigestCommand } from './commands/digest';
import { registerLoopCommand } from './commands/loopCommand';
import { registerTodoDemoCommand } from './commands/todoDemo';
import { registerHookEventsCommand } from './commands/hookEvents';
import { AgentTreeProvider } from './views/agentTreeProvider';
import { ReadyQueueTreeProvider } from './views/readyQueueTreeProvider';
import { WorkflowTreeProvider } from './views/workflowTreeProvider';
import { SettingsTreeProvider, registerEditSettingCommand } from './views/settingsTreeProvider';
import { TemplateTreeProvider } from './views/templateTreeProvider';
import { DocsTreeProvider } from './views/docsTreeProvider';
import { SourceTreeProvider } from './views/sourceTreeProvider';
import { AgentXContext } from './agentxContext';
import { registerChatParticipant } from './chat/chatParticipant';
import { clearInstructionCache } from './chat/agentContextLoader';
import {
 runSetupWizard,
 runSilentInstall,
} from './commands/setupWizard';
import { AgentEventBus } from './utils/eventBus';
import { ThinkingLog } from './utils/thinkingLog';
import { ContextCompactor } from './utils/contextCompactor';
import { ChannelRouter, VsCodeChatChannel, CliChannel } from './utils/channelRouter';
import { TaskScheduler } from './utils/taskScheduler';
import { stripAnsi } from './utils/stripAnsi';
import { PluginManager } from './utils/pluginManager';
import { GitStorageProvider } from './utils/gitStorageProvider';
import { promptIfUpdateAvailable } from './utils/versionChecker';
import { StructuredLogger } from './utils/structuredLogger';
import { ObservationExtractor } from './memory/observationExtractor';
import { JsonObservationStore } from './memory/observationStore';
import { OutcomeTracker } from './memory/outcomeTracker';
import { SessionRecorder } from './memory/sessionRecorder';
import { MemoryHealth } from './memory/memoryHealth';

let agentxContext: AgentXContext;
let eventBus: AgentEventBus;
let thinkingLog: ThinkingLog;
let contextCompactor: ContextCompactor;
let channelRouter: ChannelRouter;
let taskScheduler: TaskScheduler;
let pluginManager: PluginManager | undefined;
let gitStorageProvider: GitStorageProvider | undefined;
let structuredLogger: StructuredLogger | undefined;

function parseCommandArgs(raw: string): string[] {
 const args: string[] = [];
 const re = /"([^"]*)"|(\S+)/g;
 let match: RegExpExecArray | null;
 while ((match = re.exec(raw)) !== null) {
  args.push(match[1] ?? match[2]);
 }
 return args;
}

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

 // Initialize Git storage provider when workspace root is available.
 // Reads config.json persistence setting to decide whether to use Git backend.
 if (agentxContext.workspaceRoot) {
  try {
   const configPath = path.join(agentxContext.workspaceRoot, '.agentx', 'config.json');
   let useGit = false;
   if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw);
    useGit = cfg.persistence === 'git';
   }
   if (useGit) {
    gitStorageProvider = new GitStorageProvider({
     workspaceRoot: agentxContext.workspaceRoot,
    });
    // Lazy init -- the branch is created on first write.
    console.log('AgentX: Git storage provider initialized (orphan branch: agentx/data).');
   }
  } catch (err) {
   console.warn('AgentX: Git storage provider initialization skipped:', err);
  }
 }

 // Initialize structured disk logger for persistent JSON Lines logging
 if (agentxDir) {
  structuredLogger = new StructuredLogger({
   logDir: path.join(agentxDir, 'logs'),
  });
  // Wire event bus to disk logger -- log key agent lifecycle events
  eventBus.on('agent-started', (e) => {
   structuredLogger!.info(e.agent, `Agent started on issue #${e.issueNumber ?? 'N/A'}`, {
    issueNumber: e.issueNumber ?? 0,
   });
  });
  eventBus.on('agent-completed', (e) => {
   structuredLogger!.info(e.agent, `Agent completed on issue #${e.issueNumber ?? 'N/A'}`, {
    issueNumber: e.issueNumber ?? 0,
    durationMs: e.durationMs,
   });
  });
  eventBus.on('thinking-log', (e) => {
   structuredLogger!.log({
    level: 'debug',
    agentName: e.agent ?? 'system',
    message: e.label ?? '',
    toolName: e.kind === 'tool-call' ? e.detail : undefined,
   });
  });
 }

 // Wire memory pipeline: extract observations from compaction summaries
 if (agentxDir) {
  const memoryDir = path.join(agentxDir, 'memory');
  const observationStore = new JsonObservationStore(memoryDir);
  const observationExtractor = new ObservationExtractor();
  const outcomeTracker = new OutcomeTracker(memoryDir);
  const sessionRecorder = new SessionRecorder(memoryDir);
  const memoryHealth = new MemoryHealth(memoryDir);

  eventBus.on('context-compacted', (e) => {
   if (!e.summary) { return; }
   try {
    const observations = observationExtractor.extractObservations(
     e.summary,
     e.agent ?? 'unknown',
     0, // Issue number not available from event -- will be enriched later
     `session-${Date.now()}`,
    );
    if (observations.length > 0) {
     observationStore.store(observations).catch((err) => {
      console.warn('AgentX: Failed to persist observations:', err);
     });
    }
   } catch (err) {
    console.warn('AgentX: Observation extraction failed:', err);
   }
  });

  // Phase 1: Memory Health command
  context.subscriptions.push(
   vscode.commands.registerCommand('agentx.memoryHealth', async () => {
    const channel = vscode.window.createOutputChannel('AgentX Memory Health');
    channel.clear();
    channel.show(true);
    channel.appendLine('=== AgentX Memory Health Report ===');
    channel.appendLine('Scanning...');

    try {
     const report = await memoryHealth.scan();
     channel.clear();
     channel.appendLine('=== AgentX Memory Health Report ===');
     channel.appendLine(`Scan time: ${report.scanTime} (${report.durationMs}ms)`);
     channel.appendLine('');
     channel.appendLine(`Observations: ${report.observations.total} total | ${report.observations.stale} stale (> 90 days)`);
     channel.appendLine(`Outcomes:     ${report.outcomes.total} total    | ${report.outcomes.stale} stale`);
     channel.appendLine(`Sessions:     ${report.sessions.total} total    | ${report.sessions.stale} stale`);
     channel.appendLine(`Disk usage:   ${formatBytes(report.diskSizeBytes)}`);
     channel.appendLine('');

     if (report.issues.length > 0) {
      channel.appendLine('Issues Found:');
      for (const issue of report.issues) {
       channel.appendLine(`  ${issue}`);
      }
      channel.appendLine('');
      channel.appendLine('Status: NEEDS REPAIR');
      channel.appendLine('');

      const fix = await vscode.window.showWarningMessage(
       `Memory health: ${report.issues.length} issue(s) found. Run repair?`,
       'Repair',
       'Dismiss',
      );
      if (fix === 'Repair') {
       channel.appendLine('Repairing...');
       const repairResult = await memoryHealth.repair();
       channel.appendLine('');
       channel.appendLine('=== AgentX Memory Health Repair ===');
       for (const action of repairResult.actions) {
        channel.appendLine(action);
       }
       channel.appendLine('');
       channel.appendLine(`Status: ${repairResult.healthyAfterRepair ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
      }
     } else {
      channel.appendLine('Status: HEALTHY');
     }
    } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     channel.appendLine(`[FAIL] Scan failed: ${msg}`);
    }
   }),
  );

  // Phase 1: Session History command
  context.subscriptions.push(
   vscode.commands.registerCommand('agentx.sessionHistory', async () => {
    try {
     const sessions = await sessionRecorder.list(50);
     if (sessions.length === 0) {
      vscode.window.showInformationMessage('AgentX: No sessions recorded yet.');
      return;
     }

     const items = sessions.map((s) => ({
      label: `${s.endTime.substring(0, 10)} | ${s.agent} | Issue #${s.issueNumber ?? 'N/A'}`,
      description: s.summaryPreview,
      detail: `${s.messageCount} messages`,
      sessionId: s.id,
     }));

     const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a session to view',
      title: 'AgentX Session History',
     });

     if (!picked) { return; }

     const full = await sessionRecorder.getById(picked.sessionId);
     if (!full) {
      vscode.window.showWarningMessage('AgentX: Session record not found.');
      return;
     }

     const doc = await vscode.workspace.openTextDocument({
      language: 'json',
      content: JSON.stringify(full, null, 2),
     });
     vscode.window.showTextDocument(doc, { preview: true });
    } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     vscode.window.showErrorMessage(`AgentX Session History: ${msg}`);
    }
   }),
  );

  // Phase 1: Resume Session command
  context.subscriptions.push(
   vscode.commands.registerCommand('agentx.resumeSession', async () => {
    try {
     const recent = await sessionRecorder.getMostRecent();
     if (!recent) {
      vscode.window.showInformationMessage('AgentX: No sessions to resume.');
      return;
     }

     const lines: string[] = [
      `## Session Resume (${recent.endTime.substring(0, 16).replace('T', ' ')})`,
      `**Agent**: ${recent.agent} | **Issue**: #${recent.issueNumber ?? 'N/A'}`,
      '',
      '### Summary',
      recent.summary,
      '',
     ];

     if (recent.decisions.length > 0) {
      lines.push('### Decisions');
      for (const d of recent.decisions) { lines.push(`- ${d}`); }
      lines.push('');
     }

     if (recent.filesChanged.length > 0) {
      lines.push('### Files Changed');
      for (const f of recent.filesChanged) { lines.push(`- ${f}`); }
      lines.push('');
     }

     if (recent.actions.length > 0) {
      lines.push('### Actions Taken');
      for (const a of recent.actions) { lines.push(`- ${a}`); }
      lines.push('');
     }

     const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: lines.join('\n'),
     });
     vscode.window.showTextDocument(doc, { preview: true });
    } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     vscode.window.showErrorMessage(`AgentX Resume Session: ${msg}`);
    }
   }),
  );
 }

 // Start scheduler when enabled tasks exist
 if (taskScheduler.getEnabledTasks().length > 0) {
  taskScheduler.start(async (task) => {
   const parts = parseCommandArgs(task.command);
   const subcommand = parts[0];
   if (!subcommand) {
    console.warn(`AgentX Scheduler: task '${task.id}' has no command.`);
    return;
   }
   await agentxContext.runCli(subcommand, parts.slice(1));
  });
 }

 // Store services on context for access by other modules
 agentxContext.setServices({ channelRouter, taskScheduler, pluginManager, gitStorageProvider });

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
 const templateProvider = new TemplateTreeProvider(agentxContext);
 const workflowProvider = new WorkflowTreeProvider(agentxContext);
 const settingsProvider = new SettingsTreeProvider();
 const docsProvider = new DocsTreeProvider(agentxContext);
 const sourceProvider = new SourceTreeProvider(agentxContext);

 vscode.window.registerTreeDataProvider('agentx-agents', agentTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-ready', readyQueueProvider);
 vscode.window.registerTreeDataProvider('agentx-docs', docsProvider);
 vscode.window.registerTreeDataProvider('agentx-source', sourceProvider);
 vscode.window.registerTreeDataProvider('agentx-templates', templateProvider);
 vscode.window.registerTreeDataProvider('agentx-workflows', workflowProvider);
 vscode.window.registerTreeDataProvider('agentx-settings', settingsProvider);

 // Register commands
 registerInitializeCommand(context, agentxContext);
 registerStatusCommand(context, agentxContext);
 registerReadyQueueCommand(context, agentxContext, readyQueueProvider);
 registerWorkflowCommand(context, agentxContext);
 registerDepsCommand(context, agentxContext);
 registerDigestCommand(context, agentxContext);
 registerLoopCommand(context, agentxContext);
 registerTodoDemoCommand(context, agentxContext);
 registerHookEventsCommand(context, eventBus);
 registerEditSettingCommand(context, settingsProvider);

 // Show issue detail command (used by ready queue tree item click)
 let issueChannel: vscode.OutputChannel | undefined;
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.showIssue', async (issueNumber: string) => {
  if (!issueNumber) { return; }
  try {
   // CLI subcommand is "issue get <num>" (not "show")
   const output = await agentxContext.runCli('issue', ['get', issueNumber]);
   const cleaned = stripAnsi(output);

   if (!issueChannel) {
    issueChannel = vscode.window.createOutputChannel('AgentX Issue Detail');
   }
   issueChannel.clear();

   // Try to render a human-friendly view from JSON
   try {
    const issue = JSON.parse(cleaned);
    issueChannel.appendLine(`=== Issue #${issue.number}: ${issue.title} ===`);
    issueChannel.appendLine('');
    issueChannel.appendLine(`  Status : ${issue.status ?? 'unknown'}`);
    issueChannel.appendLine(`  State  : ${issue.state ?? 'unknown'}`);
    if (issue.labels && issue.labels.length > 0) {
     issueChannel.appendLine(`  Labels : ${issue.labels.join(', ')}`);
    }
    if (issue.created) {
     issueChannel.appendLine(`  Created: ${issue.created}`);
    }
    if (issue.updated) {
     issueChannel.appendLine(`  Updated: ${issue.updated}`);
    }
    if (issue.body) {
     issueChannel.appendLine('');
     issueChannel.appendLine('--- Body ---');
     issueChannel.appendLine(issue.body);
    }
    if (issue.comments && issue.comments.length > 0) {
     issueChannel.appendLine('');
     issueChannel.appendLine('--- Comments ---');
     for (const c of issue.comments) {
      issueChannel.appendLine(`  [${c.created ?? '?'}] ${c.body}`);
     }
    }
   } catch {
    // Fallback: show raw CLI output
    issueChannel.appendLine(`=== Issue #${issueNumber} ===\n`);
    issueChannel.appendLine(cleaned);
   }

   issueChannel.show(true);
  } catch (err: unknown) {
   const message = err instanceof Error ? err.message : String(err);
   vscode.window.showErrorMessage(`Failed to load issue #${issueNumber}: ${message}`);
  }
 })
 );

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
 templateProvider.refresh();
 workflowProvider.refresh();
 settingsProvider.refresh();
 docsProvider.refresh();
 sourceProvider.refresh();
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

 // Install plugin from local directory
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.installPlugin', async () => {
  if (!pluginManager) {
   vscode.window.showWarningMessage('AgentX: Not initialized. Plugins unavailable.');
   return;
  }

  const picked = await vscode.window.showOpenDialog({
   canSelectMany: false,
   canSelectFiles: false,
   canSelectFolders: true,
   openLabel: 'Install Plugin from Folder',
   title: 'Select Plugin Folder (must contain plugin.json)',
  });

  if (!picked || picked.length === 0) { return; }

  try {
   const installed = pluginManager.installFromDir(picked[0].fsPath);
   vscode.window.showInformationMessage(
    `AgentX: Installed plugin '${installed.manifest.name}' v${installed.manifest.version}.`
   );
  } catch (err: unknown) {
   const msg = err instanceof Error ? err.message : String(err);
   vscode.window.showErrorMessage(`AgentX Install Error: ${msg}`);
  }
 })
 );

 // Remove installed plugin
 context.subscriptions.push(
 vscode.commands.registerCommand('agentx.removePlugin', async () => {
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
    pluginName: p.manifest.name,
   })),
   { placeHolder: 'Select plugin to remove', title: 'AgentX - Remove Plugin' }
  );

  if (!pick) { return; }

  const confirm = await vscode.window.showWarningMessage(
   `Remove plugin '${pick.pluginName}'?`,
   { modal: true },
   'Remove'
  );
  if (confirm !== 'Remove') { return; }

  const removed = pluginManager.remove(pick.pluginName);
  if (removed) {
   vscode.window.showInformationMessage(`AgentX: Removed plugin '${pick.pluginName}'.`);
  } else {
   vscode.window.showWarningMessage(`AgentX: Plugin '${pick.pluginName}' was not found.`);
  }
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

 // Non-blocking startup dependency install - runs silently after activation
 // Automatically installs missing required dependencies without user prompts.
 // Respects the agentx.skipStartupCheck setting
 const skipStartupCheck = vscode.workspace
 .getConfiguration('agentx')
 .get<boolean>('skipStartupCheck', false);
 if (!skipStartupCheck) {
 // Delay slightly so it does not block extension activation
 setTimeout(async () => {
 try {
 const mode = agentxContext.getMode();
 // Silently install all missing required dependencies
 await runSilentInstall(mode);
 } catch (err) {
 // Startup check should never crash the extension
 console.warn('AgentX: Startup silent install failed:', err);
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
 docsProvider.refresh();
 sourceProvider.refresh();
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

/** Format byte count as human-readable string. */
function formatBytes(bytes: number): string {
 if (bytes < 1024) { return `${bytes} B`; }
 if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
