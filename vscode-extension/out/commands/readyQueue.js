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
exports.registerReadyQueueCommand = registerReadyQueueCommand;
const vscode = __importStar(require("vscode"));
/**
 * Register the AgentX: Show Ready Queue command.
 * Runs `.agentx/agentx.ps1 ready` and displays unblocked work.
 */
function registerReadyQueueCommand(context, agentx, readyQueueProvider) {
 const cmd = vscode.commands.registerCommand('agentx.readyQueue', async () => {
 if (!await agentx.checkInitialized()) {
 vscode.window.showWarningMessage('AgentX is not initialized. Run "AgentX: Initialize Project" first.');
 return;
 }
 try {
 const output = await agentx.runCli('ready');
 if (!output || output.includes('No ')) {
 vscode.window.showInformationMessage('AgentX: No unblocked work in the ready queue.');
 }
 else {
 // Show in output channel
 const channel = vscode.window.createOutputChannel('AgentX Ready Queue');
 channel.clear();
 channel.appendLine('=== AgentX Ready Queue ===\n');
 channel.appendLine(output);
 channel.show();
 }
 }
 catch (err) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`AgentX ready queue failed: ${message}`);
 }
 readyQueueProvider.refresh();
 });
 context.subscriptions.push(cmd);
}
//# sourceMappingURL=readyQueue.js.map