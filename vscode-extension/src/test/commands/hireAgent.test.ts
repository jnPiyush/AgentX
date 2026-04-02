import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerHireAgentCommand } from '../../commands/hireAgent';
import {
  generateAgentContent,
  promptAgentDetails,
  resolveAgentOutputDir,
} from '../../commands/hireAgentInternals';

// ---------------------------------------------------------------------------
// generateAgentContent unit tests
// ---------------------------------------------------------------------------

describe('generateAgentContent', () => {
  it('produces valid frontmatter with all required fields', () => {
    const content = generateAgentContent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent for validation',
      model: 'gpt-4.1',
      role: 'Engineer',
      constraints: ['Follow workspace standards'],
    });

    assert.ok(content.startsWith('---\n'), 'should start with frontmatter delimiter');
    assert.ok(content.includes('name: Test Agent'), 'should include name field');
    assert.ok(content.includes('description: "A test agent for validation"'), 'should include description');
    assert.ok(content.includes('model: "gpt-4.1"'), 'should include model');
    assert.ok(content.includes('**Role**: Engineer'), 'should include role in body');
    assert.ok(content.includes('Follow workspace standards'), 'should include constraints');
  });

  it('includes all constraint items', () => {
    const content = generateAgentContent({
      id: 'multi',
      name: 'Multi Constraint',
      description: 'Agent with multiple constraints',
      model: 'claude-sonnet-4',
      role: 'Analyst',
      constraints: ['Constraint A', 'Constraint B', 'Constraint C'],
    });

    assert.ok(content.includes('Constraint A'));
    assert.ok(content.includes('Constraint B'));
    assert.ok(content.includes('Constraint C'));
  });
});

// ---------------------------------------------------------------------------
// resolveAgentOutputDir unit tests
// ---------------------------------------------------------------------------

describe('resolveAgentOutputDir', () => {
  it('resolves to .github/agents under the workspace root', () => {
    const result = resolveAgentOutputDir('/workspace');
    assert.equal(result, path.join('/workspace', '.github', 'agents'));
  });
});

// ---------------------------------------------------------------------------
// registerHireAgentCommand registration test
// ---------------------------------------------------------------------------

describe('registerHireAgentCommand', () => {
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

  it('registers the agentx.hireAgent command', () => {
    registerHireAgentCommand(fakeContext, fakeAgentx);
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.hireAgent'),
    );
  });
});

// ---------------------------------------------------------------------------
// hireAgent command execution tests
// ---------------------------------------------------------------------------

describe('hireAgent command - execution', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;
  let commandCallback: () => Promise<void>;
  let tmpDir: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-hire-test-'));

    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    fakeAgentx = { workspaceRoot: tmpDir } as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        commandCallback = cb as () => Promise<void>;
        return { dispose: () => { /* noop */ } };
      },
    );

    sandbox.stub(vscode.commands, 'executeCommand').resolves();
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
    sandbox.stub(vscode.window, 'showTextDocument').resolves();

    registerHireAgentCommand(fakeContext, fakeAgentx);
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows warning when no workspace is open', async () => {
    (fakeAgentx as any).workspaceRoot = undefined;
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.ok(warnStub.calledOnce);
  });

  it('returns silently when user cancels the wizard', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);
    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await commandCallback();

    assert.ok(infoStub.notCalled, 'should not show success message when user cancels');
  });

  it('writes agent file and shows success when wizard completes', async () => {
    const inputStub = sandbox.stub(vscode.window, 'showInputBox');
    inputStub.onFirstCall().resolves('My Test Agent');
    inputStub.onSecondCall().resolves('Performs test automation tasks');

    const pickStub = sandbox.stub(vscode.window, 'showQuickPick') as sinon.SinonStub;
    pickStub.onFirstCall().resolves({ label: 'Engineer', description: 'Code implementation' });
    pickStub.onSecondCall().resolves({ label: 'GPT-4.1', value: 'gpt-4.1' });

    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await commandCallback();

    const agentFile = path.join(tmpDir, '.github', 'agents', 'my-test-agent.agent.md');
    assert.ok(fs.existsSync(agentFile), 'agent file should be created');

    const content = fs.readFileSync(agentFile, 'utf-8');
    assert.ok(content.includes('name: My Test Agent'), 'should include name in frontmatter');
    assert.ok(infoStub.calledOnce, 'should show success message');
  });
});
