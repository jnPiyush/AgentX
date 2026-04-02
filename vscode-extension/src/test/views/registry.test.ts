import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { createSidebarProviders, refreshSidebarProviders, registerSidebarProviders } from '../../views/registry';

describe('sidebar registry', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('creates sidebar providers backed by the shared AgentX context', () => {
    const agentx = { workspaceRoot: 'c:/repo' } as any;

    const providers = createSidebarProviders(agentx);

    assert.equal(providers.workTreeProvider.constructor.name, 'WorkTreeProvider');
    assert.equal(providers.statusTreeProvider.constructor.name, 'StatusTreeProvider');
    assert.equal(providers.templateProvider.constructor.name, 'TemplateTreeProvider');
    assert.equal(providers.skillProvider.constructor.name, 'SkillTreeProvider');
  });

  it('registers and refreshes all sidebar providers', () => {
    const registerSpy = sandbox.spy(vscode.window, 'registerTreeDataProvider');
    const providers = {
      workTreeProvider: { refresh: sandbox.stub() },
      statusTreeProvider: { refresh: sandbox.stub() },
      templateProvider: { refresh: sandbox.stub() },
      skillProvider: { refresh: sandbox.stub() },
    } as any;

    registerSidebarProviders(providers);
    refreshSidebarProviders(providers);

    assert.equal(registerSpy.callCount, 4);
    assert.ok(registerSpy.calledWith('agentx-work', providers.workTreeProvider));
    assert.ok(registerSpy.calledWith('agentx-status', providers.statusTreeProvider));
    assert.ok(registerSpy.calledWith('agentx-templates', providers.templateProvider));
    assert.ok(registerSpy.calledWith('agentx-skills', providers.skillProvider));
    assert.ok(providers.workTreeProvider.refresh.calledOnce);
    assert.ok(providers.statusTreeProvider.refresh.calledOnce);
    assert.ok(providers.templateProvider.refresh.calledOnce);
    assert.ok(providers.skillProvider.refresh.calledOnce);
  });
});