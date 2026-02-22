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
const followupProvider_1 = require("../../chat/followupProvider");
// The vscode mock is loaded via register.ts - we just need the types
describe('AgentXFollowupProvider', () => {
    let provider;
    const fakeContext = {}; // AgentXContext not used by followup logic
    const fakeToken = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => { } }) };
    const fakeChatContext = { history: [] };
    beforeEach(() => {
        provider = new followupProvider_1.AgentXFollowupProvider(fakeContext);
    });
    afterEach(() => {
        sinon.restore();
    });
    it('should return empty array when metadata is undefined', () => {
        const result = provider.provideFollowups({ metadata: undefined }, fakeChatContext, fakeToken);
        assert_1.strict.deepEqual(result, []);
    });
    it('should suggest initialization when not initialized', () => {
        const meta = { initialized: false };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.equal(result.length, 1);
        assert_1.strict.ok(result[0].label.toLowerCase().includes('initialization'));
    });
    it('should provide workflow followup after ready command', () => {
        const meta = { command: 'ready', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.ok(result.length >= 1);
        // Should have a workflow suggestion
        const hasWorkflow = result.some((f) => f.command === 'workflow');
        assert_1.strict.ok(hasWorkflow, 'should suggest starting a workflow after ready');
    });
    it('should provide ready queue followup after workflow command', () => {
        const meta = { command: 'workflow', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        const hasReady = result.some((f) => f.command === 'ready');
        assert_1.strict.ok(hasReady, 'should suggest ready queue after workflow');
    });
    it('should provide ready followup after status command', () => {
        const meta = { command: 'status', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        const hasReady = result.some((f) => f.command === 'ready');
        assert_1.strict.ok(hasReady, 'should suggest ready queue after status');
    });
    it('should provide followups after deps command', () => {
        const meta = { command: 'deps', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.ok(result.length >= 1);
    });
    it('should provide followups after digest command', () => {
        const meta = { command: 'digest', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.ok(result.length >= 1);
    });
    // --- Agent-specific followups -----------------------------------------
    it('should suggest epic workflow for product-manager agent', () => {
        const meta = { agentName: 'product-manager', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        const hasEpic = result.some((f) => f.command === 'workflow' && f.prompt === 'epic');
        assert_1.strict.ok(hasEpic, 'should suggest epic workflow for PM');
    });
    it('should suggest spike workflow for architect agent', () => {
        const meta = { agentName: 'architect', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        const hasSpike = result.some((f) => f.command === 'workflow' && f.prompt === 'spike');
        assert_1.strict.ok(hasSpike, 'should suggest spike for architect');
    });
    it('should suggest story/bug workflow for engineer agent', () => {
        const meta = { agentName: 'engineer', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        const hasStory = result.some((f) => f.command === 'workflow' && f.prompt === 'story');
        const hasBug = result.some((f) => f.command === 'workflow' && f.prompt === 'bug');
        assert_1.strict.ok(hasStory, 'should suggest story workflow for engineer');
        assert_1.strict.ok(hasBug, 'should suggest bug workflow for engineer');
    });
    it('should suggest devops workflow for devops agent', () => {
        const meta = { agentName: 'devops', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        const hasDevops = result.some((f) => f.command === 'workflow' && f.prompt === 'devops');
        assert_1.strict.ok(hasDevops, 'should suggest devops workflow for devops agent');
    });
    it('should provide generic followups for unknown agent', () => {
        const meta = { agentName: 'unknown-agent', initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.ok(result.length >= 1);
    });
    it('should provide generic followups when no agent or command', () => {
        const meta = { initialized: true };
        const result = provider.provideFollowups({ metadata: meta }, fakeChatContext, fakeToken);
        assert_1.strict.ok(Array.isArray(result));
        assert_1.strict.ok(result.length >= 2, 'should suggest multiple default followups');
    });
});
//# sourceMappingURL=followupProvider.test.js.map