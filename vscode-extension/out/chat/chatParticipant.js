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
exports.registerChatParticipant = registerChatParticipant;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const commandHandlers_1 = require("./commandHandlers");
const agentRouter_1 = require("./agentRouter");
const followupProvider_1 = require("./followupProvider");
const PARTICIPANT_ID = 'agentx.chat';
/**
 * Register the @agentx chat participant in Copilot Chat.
 */
function registerChatParticipant(context, agentx) {
    const handler = async (request, chatContext, response, token) => {
        // Check initialization
        const initialized = await agentx.checkInitialized();
        if (!initialized) {
            return handleNotInitialized(response);
        }
        // Slash command -> dispatch to command handler
        if (request.command) {
            return (0, commandHandlers_1.handleSlashCommand)(request, chatContext, response, token, agentx);
        }
        // Natural language -> classify and route to agent
        return (0, agentRouter_1.routeNaturalLanguage)(request, chatContext, response, token, agentx);
    };
    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.png'));
    participant.followupProvider = new followupProvider_1.AgentXFollowupProvider(agentx);
    context.subscriptions.push(participant);
}
function handleNotInitialized(response) {
    response.markdown('**AgentX is not initialized in this workspace.**\n\n'
        + 'To get started, run the initialization command:\n\n');
    response.button({
        command: 'agentx.initialize',
        title: 'Initialize AgentX',
    });
    response.markdown('\nOnce initialized, you can:\n'
        + '- Ask me to route work to the right agent\n'
        + '- Use `/ready` to see unblocked work\n'
        + '- Use `/workflow feature` to run a workflow\n'
        + '- Use `/status` to check agent states\n'
        + '- Use `/deps 42` to check issue dependencies\n'
        + '- Use `/digest` to generate a weekly digest\n');
    return { metadata: { initialized: false } };
}
//# sourceMappingURL=chatParticipant.js.map