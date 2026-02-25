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
exports.registerWorkflowCommand = registerWorkflowCommand;
const vscode = __importStar(require("vscode"));
/**
 * Register the AgentX: Run Workflow command.
 * Lets user pick a workflow type and runs it.
 */
function registerWorkflowCommand(context, agentx) {
    const cmd = vscode.commands.registerCommand('agentx.runWorkflow', async () => {
        if (!await agentx.checkInitialized()) {
            vscode.window.showWarningMessage('AgentX is not initialized.');
            return;
        }
        const workflowType = await vscode.window.showQuickPick([
            { label: 'feature', description: 'PM -> UX -> Architect -> Engineer -> Reviewer' },
            { label: 'epic', description: 'Full epic workflow with PRD and breakdown' },
            { label: 'story', description: 'Engineer -> Reviewer (spec ready)' },
            { label: 'bug', description: 'Engineer -> Reviewer (direct)' },
            { label: 'spike', description: 'Architect research spike' },
            { label: 'devops', description: 'DevOps pipeline workflow' },
            { label: 'docs', description: 'Documentation update' },
        ], { placeHolder: 'Select workflow type', title: 'AgentX Workflow' });
        if (!workflowType) {
            return;
        }
        try {
            const output = await agentx.runCli('workflow', [workflowType.label]);
            const channel = vscode.window.createOutputChannel('AgentX Workflow');
            channel.clear();
            channel.appendLine(`=== AgentX Workflow: ${workflowType.label} ===\n`);
            channel.appendLine(output);
            channel.show();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Workflow failed: ${message}`);
        }
    });
    context.subscriptions.push(cmd);
}
//# sourceMappingURL=workflow.js.map