import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import { handleSlashCommand } from '../../chat/commandHandlers';
import { createMockResponseStream } from '../mocks/vscode';

/**
 * Build a minimal ChatRequest-like object.
 */
function makeRequest(command: string, prompt = ''): any {
  return { command, prompt };
}

/**
 * Build a minimal AgentXContext stub with a controllable runCli.
 */
function makeFakeAgentx(cliOutput?: string, cliError?: Error) {
  return {
    runCli: sinon.stub().callsFake(async () => {
      if (cliError) { throw cliError; }
      return cliOutput ?? '';
    }),
    listAgents: sinon.stub().resolves([]),
  } as any;
}

const fakeContext: any = { history: [] };
const fakeToken: any = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => {} }),
};

describe('commandHandlers - handleSlashCommand', () => {

  // --- Unknown command --------------------------------------------------

  it('should respond with error for unknown commands', async () => {
    const response = createMockResponseStream();
    const agentx = makeFakeAgentx();
    const result = await handleSlashCommand(
      makeRequest('foobar'), fakeContext, response as any, fakeToken, agentx
    );

    assert.ok(response.getMarkdown().includes('Unknown command'));
    assert.equal((result.metadata as any).command, 'foobar');
  });

  // --- /ready -----------------------------------------------------------

  describe('/ready', () => {
    it('should display CLI output when items are found', async () => {
      const agentx = makeFakeAgentx('#1 [Story] Add health check (p0)');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('ready'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Ready Queue'));
      assert.ok(response.getMarkdown().includes('#1'));
      sinon.assert.calledOnce(agentx.runCli);
      sinon.assert.calledWith(agentx.runCli, 'ready');
    });

    it('should display empty message when no work found', async () => {
      const agentx = makeFakeAgentx('');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('ready'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('No unblocked work'));
    });

    it('should display error message when CLI fails', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('CLI crashed'));
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('ready'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Error'));
      assert.ok(response.getMarkdown().includes('CLI crashed'));
    });
  });

  // --- /workflow --------------------------------------------------------

  describe('/workflow', () => {
    it('should show usage when no type is provided', async () => {
      const agentx = makeFakeAgentx();
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('workflow', ''), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Usage'));
      sinon.assert.notCalled(agentx.runCli);
    });

    it('should show usage for invalid workflow type', async () => {
      const agentx = makeFakeAgentx();
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('workflow', 'invalid'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Usage'));
    });

    it('should execute valid workflow type', async () => {
      const agentx = makeFakeAgentx('Step 1: PM creates PRD\nStep 2: Architect reviews');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('workflow', 'feature'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Workflow: feature'));
      sinon.assert.calledOnce(agentx.runCli);
      sinon.assert.calledWith(agentx.runCli, 'workflow', ['feature']);
    });

    it('should accept all valid workflow types', async () => {
      const types = ['feature', 'epic', 'story', 'bug', 'spike', 'devops', 'docs'];
      for (const t of types) {
        const agentx = makeFakeAgentx('output');
        const response = createMockResponseStream();
        await handleSlashCommand(
          makeRequest('workflow', t), fakeContext, response as any, fakeToken, agentx
        );
        sinon.assert.calledOnce(agentx.runCli);
      }
    });

    it('should handle CLI error gracefully', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('workflow failed'));
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('workflow', 'feature'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Error'));
      assert.ok(response.getMarkdown().includes('workflow failed'));
    });
  });

  // --- /status ----------------------------------------------------------

  describe('/status', () => {
    it('should display CLI state output', async () => {
      const agentx = makeFakeAgentx('engineer: working on #42');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('status'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Agent Status'));
      assert.ok(response.getMarkdown().includes('engineer'));
    });

    it('should fall back to listAgents when CLI fails', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('nope'));
      agentx.listAgents = sinon.stub().resolves([
        { name: 'Engineer', model: 'Claude', maturity: 'stable', mode: 'agent', fileName: 'engineer.agent.md', description: '' },
      ]);
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('status'), fakeContext, response as any, fakeToken, agentx
      );

      const md = response.getMarkdown();
      assert.ok(md.includes('Engineer'), 'should show agent from listAgents fallback');
    });

    it('should show no agents message when listAgents returns empty', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('nope'));
      agentx.listAgents = sinon.stub().resolves([]);
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('status'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('No agents found'));
    });
  });

  // --- /deps ------------------------------------------------------------

  describe('/deps', () => {
    it('should show usage when no issue number provided', async () => {
      const agentx = makeFakeAgentx();
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('deps', ''), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Usage'));
    });

    it('should show usage for non-numeric input', async () => {
      const agentx = makeFakeAgentx();
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('deps', 'abc'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Usage'));
    });

    it('should accept a bare number', async () => {
      const agentx = makeFakeAgentx('Blocked-by: #10\nBlocks: #15');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('deps', '42'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('#42'));
      sinon.assert.calledWith(agentx.runCli, 'deps', ['42']);
    });

    it('should accept a hash-prefixed number', async () => {
      const agentx = makeFakeAgentx('No dependencies');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('deps', '#7'), fakeContext, response as any, fakeToken, agentx
      );

      sinon.assert.calledWith(agentx.runCli, 'deps', ['7']);
    });

    it('should handle CLI error', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('issue not found'));
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('deps', '99'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Error'));
    });
  });

  // --- /digest ----------------------------------------------------------

  describe('/digest', () => {
    it('should display digest output', async () => {
      const agentx = makeFakeAgentx('## Weekly Summary\n5 issues closed');
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('digest'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Weekly Digest'));
      assert.ok(response.getMarkdown().includes('5 issues closed'));
    });

    it('should handle CLI error', async () => {
      const agentx = makeFakeAgentx(undefined, new Error('digest failed'));
      const response = createMockResponseStream();

      await handleSlashCommand(
        makeRequest('digest'), fakeContext, response as any, fakeToken, agentx
      );

      assert.ok(response.getMarkdown().includes('Error'));
    });
  });

  // --- Metadata ---------------------------------------------------------

  describe('metadata', () => {
    it('should always set initialized: true in metadata', async () => {
      const commands = ['ready', 'status', 'digest'];
      for (const cmd of commands) {
        const agentx = makeFakeAgentx('ok');
        const response = createMockResponseStream();
        const result = await handleSlashCommand(
          makeRequest(cmd), fakeContext, response as any, fakeToken, agentx
        );
        assert.equal((result.metadata as any).initialized, true);
      }
    });

    it('should set command name in metadata', async () => {
      const agentx = makeFakeAgentx('ok');
      const response = createMockResponseStream();
      const result = await handleSlashCommand(
        makeRequest('ready'), fakeContext, response as any, fakeToken, agentx
      );
      assert.equal((result.metadata as any).command, 'ready');
    });

    it('should set workflowType in metadata for /workflow', async () => {
      const agentx = makeFakeAgentx('ok');
      const response = createMockResponseStream();
      const result = await handleSlashCommand(
        makeRequest('workflow', 'bug'), fakeContext, response as any, fakeToken, agentx
      );
      assert.equal((result.metadata as any).workflowType, 'bug');
    });

    it('should set issueNumber in metadata for /deps', async () => {
      const agentx = makeFakeAgentx('ok');
      const response = createMockResponseStream();
      const result = await handleSlashCommand(
        makeRequest('deps', '42'), fakeContext, response as any, fakeToken, agentx
      );
      assert.equal((result.metadata as any).issueNumber, '42');
    });
  });
});
