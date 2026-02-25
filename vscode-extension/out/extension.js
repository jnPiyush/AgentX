"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const initialize_1 = require("./commands/initialize");
const status_1 = require("./commands/status");
const readyQueue_1 = require("./commands/readyQueue");
const workflow_1 = require("./commands/workflow");
const deps_1 = require("./commands/deps");
const digest_1 = require("./commands/digest");
const loopCommand_1 = require("./commands/loopCommand");
const agentTreeProvider_1 = require("./views/agentTreeProvider");
const readyQueueTreeProvider_1 = require("./views/readyQueueTreeProvider");
const workflowTreeProvider_1 = require("./views/workflowTreeProvider");
const agentxContext_1 = require("./agentxContext");
const chatParticipant_1 = require("./chat/chatParticipant");
const agentContextLoader_1 = require("./chat/agentContextLoader");
const setupWizard_1 = require("./commands/setupWizard");
const eventBus_1 = require("./utils/eventBus");
const thinkingLog_1 = require("./utils/thinkingLog");
const contextCompactor_1 = require("./utils/contextCompactor");
const channelRouter_1 = require("./utils/channelRouter");
const taskScheduler_1 = require("./utils/taskScheduler");
const pluginManager_1 = require("./utils/pluginManager");
let agentxContext;
let eventBus;
let thinkingLog;
let contextCompactor;
let channelRouter;
let taskScheduler;
let pluginManager;
function activate(context) {
    console.log('AgentX extension activating...');
    // Initialize core infrastructure
    eventBus = new eventBus_1.AgentEventBus();
    thinkingLog = new thinkingLog_1.ThinkingLog(eventBus);
    contextCompactor = new contextCompactor_1.ContextCompactor(eventBus);
    agentxContext = new agentxContext_1.AgentXContext(context, eventBus, thinkingLog, contextCompactor);
    // Initialize channel router with default channels
    channelRouter = new channelRouter_1.ChannelRouter(eventBus);
    channelRouter.register(new channelRouter_1.VsCodeChatChannel());
    channelRouter.register(new channelRouter_1.CliChannel());
    // Initialize task scheduler
    const agentxDir = agentxContext.workspaceRoot
        ? path.join(agentxContext.workspaceRoot, '.agentx')
        : undefined;
    taskScheduler = new taskScheduler_1.TaskScheduler(eventBus, agentxDir);
    // Initialize plugin manager
    if (agentxDir) {
        pluginManager = new pluginManager_1.PluginManager(agentxDir, eventBus);
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
    const agentTreeProvider = new agentTreeProvider_1.AgentTreeProvider(agentxContext);
    const readyQueueProvider = new readyQueueTreeProvider_1.ReadyQueueTreeProvider(agentxContext);
    const workflowProvider = new workflowTreeProvider_1.WorkflowTreeProvider(agentxContext);
    vscode.window.registerTreeDataProvider('agentx-agents', agentTreeProvider);
    vscode.window.registerTreeDataProvider('agentx-ready', readyQueueProvider);
    vscode.window.registerTreeDataProvider('agentx-workflows', workflowProvider);
    // Register commands
    (0, initialize_1.registerInitializeCommand)(context, agentxContext);
    (0, status_1.registerStatusCommand)(context, agentxContext);
    (0, readyQueue_1.registerReadyQueueCommand)(context, agentxContext, readyQueueProvider);
    (0, workflow_1.registerWorkflowCommand)(context, agentxContext);
    (0, deps_1.registerDepsCommand)(context, agentxContext);
    (0, digest_1.registerDigestCommand)(context, agentxContext);
    (0, loopCommand_1.registerLoopCommand)(context, agentxContext);
    // Register chat participant (Copilot Chat integration)
    if (typeof vscode.chat?.createChatParticipant === 'function') {
        (0, chatParticipant_1.registerChatParticipant)(context, agentxContext);
    }
    // Refresh command
    context.subscriptions.push(vscode.commands.registerCommand('agentx.refresh', () => {
        agentxContext.invalidateCache();
        agentTreeProvider.refresh();
        readyQueueProvider.refresh();
        workflowProvider.refresh();
        (0, agentContextLoader_1.clearInstructionCache)();
        // Re-check initialization state after cache clear
        agentxContext.checkInitialized().then((initialized) => {
            vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
        });
        vscode.window.showInformationMessage('AgentX: Refreshed all views.');
    }));
    // Environment health check command
    context.subscriptions.push(vscode.commands.registerCommand('agentx.checkEnvironment', () => {
        const mode = agentxContext.getMode();
        (0, setupWizard_1.runSetupWizard)(mode);
    }));
    // Show thinking log output channel
    context.subscriptions.push(vscode.commands.registerCommand('agentx.showThinkingLog', () => {
        thinkingLog.show();
    }));
    // Show context budget report
    context.subscriptions.push(vscode.commands.registerCommand('agentx.contextBudget', () => {
        const report = contextCompactor.formatBudgetReport();
        const channel = vscode.window.createOutputChannel('AgentX Context Budget');
        channel.clear();
        channel.appendLine(report);
        channel.show(true);
    }));
    // List scheduled tasks
    context.subscriptions.push(vscode.commands.registerCommand('agentx.listSchedules', async () => {
        const tasks = taskScheduler.getTasks();
        if (tasks.length === 0) {
            vscode.window.showInformationMessage('AgentX: No scheduled tasks. Add tasks to .agentx/schedules.json.');
            return;
        }
        const lines = tasks.map((t) => `${t.enabled ? '[ON]' : '[OFF]'} ${t.id}: "${t.schedule}" - ${t.description}`);
        const channel = vscode.window.createOutputChannel('AgentX Schedules');
        channel.clear();
        channel.appendLine('AgentX Scheduled Tasks\n');
        for (const line of lines) {
            channel.appendLine(line);
        }
        channel.show(true);
    }));
    // List installed plugins
    context.subscriptions.push(vscode.commands.registerCommand('agentx.listPlugins', async () => {
        if (!pluginManager) {
            vscode.window.showWarningMessage('AgentX: Not initialized. Plugins unavailable.');
            return;
        }
        const plugins = pluginManager.list();
        if (plugins.length === 0) {
            vscode.window.showInformationMessage('AgentX: No plugins installed. Use "AgentX: Install Plugin" to add plugins.');
            return;
        }
        const channel = vscode.window.createOutputChannel('AgentX Plugins');
        channel.clear();
        channel.appendLine('AgentX Installed Plugins\n');
        for (const p of plugins) {
            channel.appendLine(`[${p.manifest.type}] ${p.manifest.name} v${p.manifest.version} - ${p.manifest.description}`);
            if (p.manifest.requires && p.manifest.requires.length > 0) {
                channel.appendLine(`  Requires: ${p.manifest.requires.join(', ')}`);
            }
        }
        channel.show(true);
    }));
    // Run a plugin
    context.subscriptions.push(vscode.commands.registerCommand('agentx.runPlugin', async () => {
        if (!pluginManager) {
            vscode.window.showWarningMessage('AgentX: Not initialized. Plugins unavailable.');
            return;
        }
        const plugins = pluginManager.list();
        if (plugins.length === 0) {
            vscode.window.showInformationMessage('AgentX: No plugins installed.');
            return;
        }
        const pick = await vscode.window.showQuickPick(plugins.map((p) => ({
            label: p.manifest.name,
            description: `v${p.manifest.version} [${p.manifest.type}]`,
            detail: p.manifest.description,
            plugin: p,
        })), { placeHolder: 'Select a plugin to run', title: 'AgentX - Run Plugin' });
        if (!pick) {
            return;
        }
        // Collect arguments if the plugin defines any
        const args = {};
        if (pick.plugin.manifest.args) {
            for (const arg of pick.plugin.manifest.args) {
                const value = await vscode.window.showInputBox({
                    prompt: `${arg.name}: ${arg.description}`,
                    value: arg.default ?? '',
                    placeHolder: arg.required ? '(required)' : '(optional, press Enter to skip)',
                });
                if (value === undefined) {
                    return;
                } // cancelled
                if (value.trim()) {
                    args[arg.name] = value.trim();
                }
            }
        }
        // Run in terminal
        const shell = agentxContext.getShell();
        const isPwsh = shell === 'pwsh' || (shell === 'auto' && process.platform === 'win32');
        try {
            const cmd = pluginManager.buildRunCommand(pick.plugin.manifest.name, args, isPwsh ? 'pwsh' : 'bash');
            const terminal = vscode.window.createTerminal(`AgentX: ${pick.plugin.manifest.name}`);
            terminal.show();
            terminal.sendText(cmd);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`AgentX Plugin Error: ${msg}`);
        }
    }));
    // Scaffold a new plugin
    context.subscriptions.push(vscode.commands.registerCommand('agentx.scaffoldPlugin', async () => {
        if (!pluginManager) {
            vscode.window.showWarningMessage('AgentX: Not initialized.');
            return;
        }
        const name = await vscode.window.showInputBox({
            prompt: 'Plugin name (kebab-case)',
            placeHolder: 'my-plugin',
            validateInput: (v) => /^[a-z][a-z0-9-]*$/.test(v) ? undefined : 'Must be kebab-case (e.g., my-plugin)',
        });
        if (!name) {
            return;
        }
        const type = await vscode.window.showQuickPick(['tool', 'skill', 'agent', 'channel', 'workflow'], { placeHolder: 'Plugin type', title: 'AgentX - Plugin Type' });
        if (!type) {
            return;
        }
        const description = await vscode.window.showInputBox({
            prompt: 'Short description',
            placeHolder: 'What does this plugin do?',
        });
        if (!description) {
            return;
        }
        try {
            const dir = pluginManager.scaffold(name, type, description);
            vscode.window.showInformationMessage(`AgentX: Plugin '${name}' scaffolded at ${dir}`);
            // Open the plugin.json for editing
            const doc = await vscode.workspace.openTextDocument(path.join(dir, 'plugin.json'));
            vscode.window.showTextDocument(doc);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`AgentX: ${msg}`);
        }
    }));
    // Set initialized context for menu visibility
    agentxContext.checkInitialized().then((initialized) => {
        vscode.commands.executeCommand('setContext', 'agentx.initialized', initialized);
    });
    // Non-blocking startup health check - runs after activation
    // Respects the agentx.skipStartupCheck setting
    const skipStartupCheck = vscode.workspace
        .getConfiguration('agentx')
        .get('skipStartupCheck', false);
    if (!skipStartupCheck) {
        // Delay the check slightly so it does not block extension activation
        setTimeout(async () => {
            try {
                const mode = agentxContext.getMode();
                // Run critical pre-check - auto-installs missing required deps
                await (0, setupWizard_1.runCriticalPreCheck)(mode, /* blocking */ false);
            }
            catch (err) {
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
        (0, agentContextLoader_1.clearInstructionCache)();
        agentxContext.checkInitialized().then((initialized) => {
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
function deactivate() {
    // Cleanup handled by disposables registered in activate()
    console.log('AgentX extension deactivated.');
}
//# sourceMappingURL=extension.js.map