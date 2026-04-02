import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddLlmAdapterCommand } from '../../commands/llmAdapters';
import { runAddLlmAdapterCommand } from '../../commands/llmAdaptersCommandInternals';

describe('registerAddLlmAdapterCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.addLlmAdapter command', () => {
    registerAddLlmAdapterCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addLlmAdapter'),
    );
  });
});

describe('runAddLlmAdapterCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let tempRoot: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-llm-adapter-'));
    fs.mkdirSync(path.join(tempRoot, '.agentx'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, '.agentx', 'config.json'),
      JSON.stringify({ provider: 'local', integration: 'local', mode: 'local', created: '2026-04-02T00:00:00.000Z' }, null, 2),
    );

    sandbox.stub(vscode.commands, 'executeCommand').resolves(undefined);
    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    sandbox.restore();
  });

  it('stores OpenAI API settings in workspace config and secret storage', async () => {
    const initializeInternals = await import('../../commands/initializeInternals');
    const setupWizard = await import('../../commands/setupWizard');

    sandbox.stub(initializeInternals, 'promptWorkspaceRoot').resolves(tempRoot);
    sandbox.stub(vscode.window, 'showQuickPick')
      .onFirstCall().resolves({
        label: 'gpt-5.4',
        description: 'Default highest-capability GPT model',
      })
      .onSecondCall().resolves(undefined);
    sandbox.stub(vscode.window, 'showInputBox')
      .onFirstCall().resolves('sk-test-openai-key')
      .onSecondCall().resolves('https://api.openai.com/v1');
    sandbox.stub(setupWizard, 'runCriticalPreCheck').resolves({ passed: true, report: { healthy: true } as never });

    const storedSecrets = new Map<string, string>();
    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
      storeWorkspaceLlmSecret: async (_providerId: 'openai-api' | 'anthropic-api', secret: string) => {
        storedSecrets.set('openai-api', secret);
      },
      deleteWorkspaceLlmSecret: async () => {},
    } as unknown as AgentXContext;

    await runAddLlmAdapterCommand(fakeAgentx, 'openai-api');

    const config = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agentx', 'config.json'), 'utf-8'));
    assert.equal(config.llmProvider, 'openai-api');
    assert.equal(config.llmProviders['openai-api'].defaultModel, 'gpt-5.4');
    assert.equal(config.llmProviders['openai-api'].baseUrl, 'https://api.openai.com/v1');
    assert.equal(storedSecrets.get('openai-api'), 'sk-test-openai-key');
  });

  it('stores Claude subscription config without requiring secrets', async () => {
    const initializeInternals = await import('../../commands/initializeInternals');
    const setupWizard = await import('../../commands/setupWizard');

    sandbox.stub(initializeInternals, 'promptWorkspaceRoot').resolves(tempRoot);
    sandbox.stub(vscode.window, 'showQuickPick').resolves({
      label: 'claude-sonnet-4.6',
      description: 'Default balanced Claude model',
    });
    sandbox.stub(setupWizard, 'runCriticalPreCheck').resolves({ passed: true, report: { healthy: true } as never });

    const fakeAgentx = {
      workspaceRoot: tempRoot,
      firstWorkspaceFolder: tempRoot,
      invalidateCache: sandbox.stub(),
      githubConnected: false,
      adoConnected: false,
      storeWorkspaceLlmSecret: async () => {},
      deleteWorkspaceLlmSecret: async () => {},
    } as unknown as AgentXContext;

    await runAddLlmAdapterCommand(fakeAgentx, 'claude-code');

    const config = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agentx', 'config.json'), 'utf-8'));
    assert.equal(config.llmProvider, 'claude-code');
    assert.equal(config.llmProviders['claude-code'].defaultModel, 'claude-sonnet-4.6');
  });
});