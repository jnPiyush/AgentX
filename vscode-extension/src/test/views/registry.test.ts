import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import {
  createSidebarProviders,
  refreshSidebarProviders,
  registerSidebarProviders,
  SidebarProviders,
} from '../../views/registry';

describe('sidebar registry', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('creates sidebar providers backed by the shared AgentX context', () => {
    const agentx = { workspaceRoot: 'c:/repo' } as unknown as AgentXContext;

    const providers = createSidebarProviders(agentx);

    assert.equal(providers.workTreeProvider.constructor.name, 'WorkTreeProvider');
    assert.equal(providers.statusTreeProvider.constructor.name, 'StatusTreeProvider');
    assert.equal(providers.templateProvider.constructor.name, 'TemplateTreeProvider');
    assert.equal(providers.skillProvider.constructor.name, 'SkillTreeProvider');
  });

  it('registers and refreshes all sidebar providers', () => {
    const registerSpy = sandbox.spy(vscode.window, 'registerTreeDataProvider');
    const fakeProviders = {
      workTreeProvider: { refresh: sandbox.stub() },
      statusTreeProvider: { refresh: sandbox.stub() },
      templateProvider: { refresh: sandbox.stub() },
      skillProvider: { refresh: sandbox.stub() },
    };
    const providers = fakeProviders as unknown as SidebarProviders;

    registerSidebarProviders(providers);
    refreshSidebarProviders(providers);

    assert.equal(registerSpy.callCount, 4);
    assert.ok(registerSpy.calledWith('agentx-work', providers.workTreeProvider));
    assert.ok(registerSpy.calledWith('agentx-status', providers.statusTreeProvider));
    assert.ok(registerSpy.calledWith('agentx-templates', providers.templateProvider));
    assert.ok(registerSpy.calledWith('agentx-skills', providers.skillProvider));
    assert.ok(fakeProviders.workTreeProvider.refresh.calledOnce);
    assert.ok(fakeProviders.statusTreeProvider.refresh.calledOnce);
    assert.ok(fakeProviders.templateProvider.refresh.calledOnce);
    assert.ok(fakeProviders.skillProvider.refresh.calledOnce);
  });
});