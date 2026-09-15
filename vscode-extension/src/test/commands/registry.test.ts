import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  registerFrontierCommands,
  registerLegacyCommandAliases,
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

    registerFrontierCommands(context, {} as any);

    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('frontier.initializeLocalRuntime'));
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
  });

  it('registers hidden legacy aliases that forward to Frontier commands', async () => {
    const context = {
      subscriptions: [],
      extension: {
        packageJSON: {
          contributes: { commands: [{ command: 'frontier.showStatus' }] },
        },
      },
    } as unknown as vscode.ExtensionContext;
    const executeCommand = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    registerLegacyCommandAliases(context);

    const registration = (vscode.commands.registerCommand as sinon.SinonStub)
      .getCalls()
      .find((call) => call.args[0] === 'agentx.showStatus');
    assert.ok(registration, 'legacy alias should be registered without a manifest contribution');
    await registration.args[1]('argument');
    assert.ok(executeCommand.calledWith('frontier.showStatus', 'argument'));
  });
});