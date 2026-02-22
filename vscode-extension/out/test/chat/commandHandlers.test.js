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
const assert_1 = require("assert");
const sinon = __importStar(require("sinon"));
const commandHandlers_1 = require("../../chat/commandHandlers");
const vscode_1 = require("../mocks/vscode");
/**
 * Build a minimal ChatRequest-like object.
 */
function makeRequest(command, prompt = '') {
    return { command, prompt };
}
/**
 * Build a minimal AgentXContext stub with a controllable runCli.
 */
function makeFakeAgentx(cliOutput, cliError) {
    return {
        runCli: sinon.stub().callsFake(async () => {
            if (cliError) {
                throw cliError;
            }
            return cliOutput ?? '';
        }),
        listAgents: sinon.stub().resolves([]),
    };
}
const fakeContext = { history: [] };
const fakeToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => { } }),
};
describe('commandHandlers - handleSlashCommand', () => {
    // --- Unknown command --------------------------------------------------
    it('should respond with error for unknown commands', async () => {
        const response = (0, vscode_1.createMockResponseStream)();
        const agentx = makeFakeAgentx();
        const result = await (0, commandHandlers_1.handleSlashCommand)(makeRequest('foobar'), fakeContext, response, fakeToken, agentx);
        assert_1.strict.ok(response.getMarkdown().includes('Unknown command'));
        assert_1.strict.equal(result.metadata.command, 'foobar');
    });
    // --- /ready -----------------------------------------------------------
    describe('/ready', () => {
        it('should display CLI output when items are found', async () => {
            const agentx = makeFakeAgentx('#1 [Story] Add health check (p0)');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('ready'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Ready Queue'));
            assert_1.strict.ok(response.getMarkdown().includes('#1'));
            sinon.assert.calledOnce(agentx.runCli);
            sinon.assert.calledWith(agentx.runCli, 'ready');
        });
        it('should display empty message when no work found', async () => {
            const agentx = makeFakeAgentx('');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('ready'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('No unblocked work'));
        });
        it('should display error message when CLI fails', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('CLI crashed'));
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('ready'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Error'));
            assert_1.strict.ok(response.getMarkdown().includes('CLI crashed'));
        });
    });
    // --- /workflow --------------------------------------------------------
    describe('/workflow', () => {
        it('should show usage when no type is provided', async () => {
            const agentx = makeFakeAgentx();
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', ''), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Usage'));
            sinon.assert.notCalled(agentx.runCli);
        });
        it('should show usage for invalid workflow type', async () => {
            const agentx = makeFakeAgentx();
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', 'invalid'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Usage'));
        });
        it('should execute valid workflow type', async () => {
            const agentx = makeFakeAgentx('Step 1: PM creates PRD\nStep 2: Architect reviews');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', 'feature'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Workflow: feature'));
            sinon.assert.calledOnce(agentx.runCli);
            sinon.assert.calledWith(agentx.runCli, 'workflow', { Type: 'feature' });
        });
        it('should accept all valid workflow types', async () => {
            const types = ['feature', 'epic', 'story', 'bug', 'spike', 'devops', 'docs'];
            for (const t of types) {
                const agentx = makeFakeAgentx('output');
                const response = (0, vscode_1.createMockResponseStream)();
                await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', t), fakeContext, response, fakeToken, agentx);
                sinon.assert.calledOnce(agentx.runCli);
            }
        });
        it('should handle CLI error gracefully', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('workflow failed'));
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', 'feature'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Error'));
            assert_1.strict.ok(response.getMarkdown().includes('workflow failed'));
        });
    });
    // --- /status ----------------------------------------------------------
    describe('/status', () => {
        it('should display CLI state output', async () => {
            const agentx = makeFakeAgentx('engineer: working on #42');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('status'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Agent Status'));
            assert_1.strict.ok(response.getMarkdown().includes('engineer'));
        });
        it('should fall back to listAgents when CLI fails', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('nope'));
            agentx.listAgents = sinon.stub().resolves([
                { name: 'Engineer', model: 'Claude', maturity: 'stable', mode: 'agent', fileName: 'engineer.agent.md', description: '' },
            ]);
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('status'), fakeContext, response, fakeToken, agentx);
            const md = response.getMarkdown();
            assert_1.strict.ok(md.includes('Engineer'), 'should show agent from listAgents fallback');
        });
        it('should show no agents message when listAgents returns empty', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('nope'));
            agentx.listAgents = sinon.stub().resolves([]);
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('status'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('No agents found'));
        });
    });
    // --- /deps ------------------------------------------------------------
    describe('/deps', () => {
        it('should show usage when no issue number provided', async () => {
            const agentx = makeFakeAgentx();
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', ''), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Usage'));
        });
        it('should show usage for non-numeric input', async () => {
            const agentx = makeFakeAgentx();
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', 'abc'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Usage'));
        });
        it('should accept a bare number', async () => {
            const agentx = makeFakeAgentx('Blocked-by: #10\nBlocks: #15');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', '42'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('#42'));
            sinon.assert.calledWith(agentx.runCli, 'deps', { IssueNumber: '42' });
        });
        it('should accept a hash-prefixed number', async () => {
            const agentx = makeFakeAgentx('No dependencies');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', '#7'), fakeContext, response, fakeToken, agentx);
            sinon.assert.calledWith(agentx.runCli, 'deps', { IssueNumber: '7' });
        });
        it('should handle CLI error', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('issue not found'));
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', '99'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Error'));
        });
    });
    // --- /digest ----------------------------------------------------------
    describe('/digest', () => {
        it('should display digest output', async () => {
            const agentx = makeFakeAgentx('## Weekly Summary\n5 issues closed');
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('digest'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Weekly Digest'));
            assert_1.strict.ok(response.getMarkdown().includes('5 issues closed'));
        });
        it('should handle CLI error', async () => {
            const agentx = makeFakeAgentx(undefined, new Error('digest failed'));
            const response = (0, vscode_1.createMockResponseStream)();
            await (0, commandHandlers_1.handleSlashCommand)(makeRequest('digest'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.ok(response.getMarkdown().includes('Error'));
        });
    });
    // --- Metadata ---------------------------------------------------------
    describe('metadata', () => {
        it('should always set initialized: true in metadata', async () => {
            const commands = ['ready', 'status', 'digest'];
            for (const cmd of commands) {
                const agentx = makeFakeAgentx('ok');
                const response = (0, vscode_1.createMockResponseStream)();
                const result = await (0, commandHandlers_1.handleSlashCommand)(makeRequest(cmd), fakeContext, response, fakeToken, agentx);
                assert_1.strict.equal(result.metadata.initialized, true);
            }
        });
        it('should set command name in metadata', async () => {
            const agentx = makeFakeAgentx('ok');
            const response = (0, vscode_1.createMockResponseStream)();
            const result = await (0, commandHandlers_1.handleSlashCommand)(makeRequest('ready'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.equal(result.metadata.command, 'ready');
        });
        it('should set workflowType in metadata for /workflow', async () => {
            const agentx = makeFakeAgentx('ok');
            const response = (0, vscode_1.createMockResponseStream)();
            const result = await (0, commandHandlers_1.handleSlashCommand)(makeRequest('workflow', 'bug'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.equal(result.metadata.workflowType, 'bug');
        });
        it('should set issueNumber in metadata for /deps', async () => {
            const agentx = makeFakeAgentx('ok');
            const response = (0, vscode_1.createMockResponseStream)();
            const result = await (0, commandHandlers_1.handleSlashCommand)(makeRequest('deps', '42'), fakeContext, response, fakeToken, agentx);
            assert_1.strict.equal(result.metadata.issueNumber, '42');
        });
    });
});
//# sourceMappingURL=commandHandlers.test.js.map