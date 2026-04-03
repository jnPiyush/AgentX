import { strict as assert } from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddAgentCommand } from '../../commands/addAgent';
import { resolveAgentOutputDir } from '../../commands/addAgentInternals';
import { buildAgentContentFallback } from '../../commands/scaffoldGeneration';

describe('buildAgentContentFallback', () => {
  it('produces valid frontmatter with role-specific sections', () => {
    const content = buildAgentContentFallback({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Handles security reviews for application changes',
      model: 'gpt-4.1',
      role: 'Engineer',
      constraints: ['Follow workspace standards', 'Validate changes before delivery'],
    });

    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes('name: Test Agent'));
    assert.ok(content.includes('## Mission'));
    assert.ok(content.includes('## Responsibilities'));
    assert.ok(content.includes('## Self-Review Checklist'));
  });
});

describe('resolveAgentOutputDir', () => {
  it('resolves to .github/agents under the workspace root', () => {
    const result = resolveAgentOutputDir('/workspace');
    assert.equal(result, path.join('/workspace', '.github', 'agents'));
  });
});

describe('registerAddAgentCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    fakeAgentx = { workspaceRoot: '/tmp/workspace' } as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
  });

  afterEach(() => { sandbox.restore(); });

  it('registers the agentx.addAgent command', () => {
    registerAddAgentCommand(fakeContext, fakeAgentx);
    assert.ok((vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addAgent'));
  });
});

describe('addAgent command - execution', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;
  let commandCallback: () => Promise<void>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fakeContext = { subscriptions: [], extensionUri: { fsPath: '/ext' } } as unknown as vscode.ExtensionContext;
    fakeAgentx = { workspaceRoot: '/tmp/workspace' } as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        commandCallback = cb as () => Promise<void>;
        return { dispose: () => { /* noop */ } };
      },
    );

    registerAddAgentCommand(fakeContext, fakeAgentx);
  });

  afterEach(() => { sandbox.restore(); });

  it('shows warning when no workspace is open', async () => {
    (fakeAgentx as any).workspaceRoot = undefined;
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.ok(warnStub.calledOnce);
  });

  it('opens a terminal and runs agentx hire when invoked', async () => {
    const sendTextStub = sandbox.stub();
    const fakeTerminal = { show: sandbox.stub(), sendText: sendTextStub };
    sandbox.stub(vscode.window, 'createTerminal').returns(fakeTerminal as any);

    await commandCallback();

    assert.ok((vscode.window.createTerminal as sinon.SinonStub).calledOnce);
    assert.ok(sendTextStub.calledWith('cd "/tmp/workspace"'));
    const hireCalls = sendTextStub.args.filter((args: string[]) => args[0].includes('hire'));
    assert.ok(hireCalls.length > 0, 'should invoke the add-agent CLI flow');
  });
});
