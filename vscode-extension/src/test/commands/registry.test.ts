import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FrontierContext } from '../../frontierContext';
import {
  registerFrontierCommands,
} from '../../commands/registry';

describe('registerFrontierCommands', () => {
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

    registerFrontierCommands(context, sandbox.createStubInstance(FrontierContext));

    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('frontier.initializeLocalRuntime'));
    assert.ok(registerCommand.calledWith('frontier.initializeCursor'));
    assert.ok(registerCommand.calledWith('frontier.addRemoteAdapter'));
    assert.ok(registerCommand.calledWith('frontier.addPlugin'));
    assert.ok(registerCommand.calledWith('frontier.showStatus'));
    assert.ok(registerCommand.calledWith('frontier.runWorkflow'));
    assert.ok(registerCommand.calledWith('frontier.checkDeps'));
    assert.ok(registerCommand.calledWith('frontier.generateDigest'));
    assert.ok(registerCommand.calledWith('frontier.loop'));
    assert.ok(registerCommand.calledWith('frontier.showAgentNativeReview'));
    assert.ok(registerCommand.calledWith('frontier.showAIEvaluationStatus'));
    assert.ok(registerCommand.calledWith('frontier.scaffoldAIEvaluationContract'));
    assert.ok(registerCommand.calledWith('frontier.runAIEvaluation'));
    assert.ok(registerCommand.calledWith('frontier.showTaskBundles'));
    assert.ok(registerCommand.calledWith('frontier.showIssue'));
    assert.ok(registerCommand.calledWith('frontier.showPendingClarification'));
    assert.ok(registerCommand.calledWith('frontier.refreshRepositoryContext'));
  });

  it('registers only Frontier command IDs without obsolete aliases', () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    registerFrontierCommands(context, sandbox.createStubInstance(FrontierContext));
    const names = (vscode.commands.registerCommand as sinon.SinonStub).getCalls()
      .map(call => call.args[0] as string);
    assert.ok(names.length > 0);
    assert.ok(names.every(name => name.startsWith('frontier.')));
    assert.ok(!names.includes('agentx.showStatus'));
    assert.ok(!names.includes('hve.showStatus'));
  });
});