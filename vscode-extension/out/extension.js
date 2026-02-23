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
const initialize_1 = require("./commands/initialize");
const status_1 = require("./commands/status");
const readyQueue_1 = require("./commands/readyQueue");
const workflow_1 = require("./commands/workflow");
const deps_1 = require("./commands/deps");
const digest_1 = require("./commands/digest");
const agentTreeProvider_1 = require("./views/agentTreeProvider");
const readyQueueTreeProvider_1 = require("./views/readyQueueTreeProvider");
const workflowTreeProvider_1 = require("./views/workflowTreeProvider");
const agentxContext_1 = require("./agentxContext");
const chatParticipant_1 = require("./chat/chatParticipant");
const agentContextLoader_1 = require("./chat/agentContextLoader");
const setupWizard_1 = require("./commands/setupWizard");
let agentxContext;
function activate(context) {
    console.log('AgentX extension activating...');
    agentxContext = new agentxContext_1.AgentXContext(context);
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
                // Also check Copilot Chat configuration
                const suggestions = await (0, setupWizard_1.checkCopilotChatConfig)();
                if (suggestions.length > 0) {
                    await (0, setupWizard_1.applyCopilotConfigFixes)(suggestions);
                }
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
    console.log('AgentX extension deactivated.');
}
//# sourceMappingURL=extension.js.map