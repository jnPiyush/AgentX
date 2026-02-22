import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { AgentXFollowupProvider } from '../../chat/followupProvider';
import { AgentXChatMetadata } from '../../chat/commandHandlers';

// The vscode mock is loaded via register.ts - we just need the types

describe('AgentXFollowupProvider', () => {
  let provider: AgentXFollowupProvider;
  const fakeContext = {} as any; // AgentXContext not used by followup logic
  const fakeToken = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) } as any;
  const fakeChatContext = { history: [] } as any;

  beforeEach(() => {
    provider = new AgentXFollowupProvider(fakeContext);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return empty array when metadata is undefined', () => {
    const result = provider.provideFollowups(
      { metadata: undefined },
      fakeChatContext,
      fakeToken
    );
    assert.deepEqual(result, []);
  });

  it('should suggest initialization when not initialized', () => {
    const meta: AgentXChatMetadata = { initialized: false };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.ok(result[0].label.toLowerCase().includes('initialization'));
  });

  it('should provide workflow followup after ready command', () => {
    const meta: AgentXChatMetadata = { command: 'ready', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
    // Should have a workflow suggestion
    const hasWorkflow = result.some((f: any) => f.command === 'workflow');
    assert.ok(hasWorkflow, 'should suggest starting a workflow after ready');
  });

  it('should provide ready queue followup after workflow command', () => {
    const meta: AgentXChatMetadata = { command: 'workflow', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    const hasReady = result.some((f: any) => f.command === 'ready');
    assert.ok(hasReady, 'should suggest ready queue after workflow');
  });

  it('should provide ready followup after status command', () => {
    const meta: AgentXChatMetadata = { command: 'status', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    const hasReady = result.some((f: any) => f.command === 'ready');
    assert.ok(hasReady, 'should suggest ready queue after status');
  });

  it('should provide followups after deps command', () => {
    const meta: AgentXChatMetadata = { command: 'deps', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  it('should provide followups after digest command', () => {
    const meta: AgentXChatMetadata = { command: 'digest', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  // --- Agent-specific followups -----------------------------------------

  it('should suggest epic workflow for product-manager agent', () => {
    const meta: AgentXChatMetadata = { agentName: 'product-manager', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    const hasEpic = result.some((f: any) =>
      f.command === 'workflow' && f.prompt === 'epic'
    );
    assert.ok(hasEpic, 'should suggest epic workflow for PM');
  });

  it('should suggest spike workflow for architect agent', () => {
    const meta: AgentXChatMetadata = { agentName: 'architect', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    const hasSpike = result.some((f: any) =>
      f.command === 'workflow' && f.prompt === 'spike'
    );
    assert.ok(hasSpike, 'should suggest spike for architect');
  });

  it('should suggest story/bug workflow for engineer agent', () => {
    const meta: AgentXChatMetadata = { agentName: 'engineer', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    const hasStory = result.some((f: any) =>
      f.command === 'workflow' && f.prompt === 'story'
    );
    const hasBug = result.some((f: any) =>
      f.command === 'workflow' && f.prompt === 'bug'
    );
    assert.ok(hasStory, 'should suggest story workflow for engineer');
    assert.ok(hasBug, 'should suggest bug workflow for engineer');
  });

  it('should suggest devops workflow for devops agent', () => {
    const meta: AgentXChatMetadata = { agentName: 'devops', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    const hasDevops = result.some((f: any) =>
      f.command === 'workflow' && f.prompt === 'devops'
    );
    assert.ok(hasDevops, 'should suggest devops workflow for devops agent');
  });

  it('should provide generic followups for unknown agent', () => {
    const meta: AgentXChatMetadata = { agentName: 'unknown-agent', initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  it('should provide generic followups when no agent or command', () => {
    const meta: AgentXChatMetadata = { initialized: true };
    const result = provider.provideFollowups(
      { metadata: meta },
      fakeChatContext,
      fakeToken
    ) as any[];

    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 2, 'should suggest multiple default followups');
  });
});
