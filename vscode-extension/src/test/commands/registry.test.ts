import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerAgentXCommands } from '../../commands/registry';

describe('registerAgentXCommands', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(vscode.commands, 'registerCommand').returns({ dispose: () => undefined });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('registers the command surface through the shared facade', () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;

    registerAgentXCommands(context, {} as any);

    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('agentx.initializeLocalRuntime'));
    assert.ok(registerCommand.calledWith('agentx.addRemoteAdapter'));
    assert.ok(registerCommand.calledWith('agentx.addPlugin'));
    assert.ok(registerCommand.calledWith('agentx.showStatus'));
    assert.ok(registerCommand.calledWith('agentx.runWorkflow'));
    assert.ok(registerCommand.calledWith('agentx.checkDeps'));
    assert.ok(registerCommand.calledWith('agentx.generateDigest'));
    assert.ok(registerCommand.calledWith('agentx.loop'));
    assert.ok(registerCommand.calledWith('agentx.showAgentNativeReview'));
    assert.ok(registerCommand.calledWith('agentx.showTaskBundles'));
    assert.ok(registerCommand.calledWith('agentx.showIssue'));
    assert.ok(registerCommand.calledWith('agentx.showPendingClarification'));
  });
});