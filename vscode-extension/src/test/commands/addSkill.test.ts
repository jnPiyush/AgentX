import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddSkillCommand } from '../../commands/addSkill';

describe('registerAddSkillCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: AgentXContext;
  let commandCallback: () => Promise<void>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    fakeAgentx = {
      workspaceRoot: '/tmp/workspace',
      hasCliRuntime: sandbox.stub().returns(false),
    } as unknown as AgentXContext;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, cb: (...args: unknown[]) => unknown) => {
        commandCallback = cb as () => Promise<void>;
        return { dispose: () => { /* noop */ } };
      },
    );
  });

  afterEach(() => { sandbox.restore(); });

  it('registers the agentx.addSkill command', () => {
    registerAddSkillCommand(fakeContext, fakeAgentx);
    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addSkill'),
    );
  });

  it('returns silently when user dismisses the picker', async () => {
    registerAddSkillCommand(fakeContext, fakeAgentx);
    sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    await commandCallback();

    assert.ok(execStub.notCalled, 'should not execute any command when picker is dismissed');
  });

  it('delegates to agentx.addPlugin when registry option is selected', async () => {
    registerAddSkillCommand(fakeContext, fakeAgentx);
    const pickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'Install from Plugin Registry', value: 'registry' } as any,
    );
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    await commandCallback();

    assert.ok(pickStub.calledOnce);
    assert.ok(execStub.calledWith('agentx.addPlugin'), 'should delegate to addPlugin command');
  });

  it('shows warning when scaffold is selected but no workspace is open', async () => {
    (fakeAgentx as any).workspaceRoot = undefined;
    registerAddSkillCommand(fakeContext, fakeAgentx);
    sandbox.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'Scaffold Custom Skill', value: 'scaffold' } as any,
    );
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.ok(warnStub.calledOnce);
  });

  it('shows info when scaffold is selected but CLI runtime is missing', async () => {
    (fakeAgentx as any).workspaceRoot = '/tmp/workspace';
    registerAddSkillCommand(fakeContext, fakeAgentx);
    sandbox.stub(vscode.window, 'showQuickPick').resolves(
      { label: 'Scaffold Custom Skill', value: 'scaffold' } as any,
    );
    const infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    await commandCallback();

    assert.ok(infoStub.calledOnce);
    assert.ok(
      infoStub.firstCall.args[0].includes('CLI runtime'),
      'should mention CLI runtime in the message',
    );
  });
});
