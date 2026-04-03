import { strict as assert } from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddSkillCommand } from '../../commands/addSkill';
import { resolveSkillOutputDir } from '../../commands/addSkillInternals';
import { buildSkillContentFallback } from '../../commands/scaffoldGeneration';

describe('buildSkillContentFallback', () => {
  it('produces a complete SKILL.md structure', () => {
    const content = buildSkillContentFallback({
      name: 'Contract Review',
      slug: 'contract-review',
      category: 'development',
      description: 'Guides contract review workflows, risk analysis, and clause comparison',
    });

    assert.ok(content.startsWith('---\n'));
    assert.ok(content.includes('name: "contract-review"'));
    assert.ok(content.includes('## When to Use'));
    assert.ok(content.includes('## Common Patterns'));
    assert.ok(content.includes('## Anti-Patterns'));
  });
});

describe('resolveSkillOutputDir', () => {
  it('resolves to .github/skills/category/slug under the workspace root', () => {
    const result = resolveSkillOutputDir('/workspace', 'development', 'contract-review');
    assert.equal(result, path.join('/workspace', '.github', 'skills', 'development', 'contract-review'));
  });
});

describe('registerAddSkillCommand', () => {
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

    registerAddSkillCommand(fakeContext, fakeAgentx);
  });

  afterEach(() => { sandbox.restore(); });

  it('registers the agentx.addSkill command', () => {
    assert.ok((vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addSkill'));
  });

  it('returns silently when user dismisses the picker', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    await commandCallback();

    assert.ok(execStub.notCalled);
  });

  it('delegates to agentx.addPlugin when registry option is selected', async () => {
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'Install from Plugin Registry', value: 'registry' } as any);
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    await commandCallback();

    assert.ok(execStub.calledWith('agentx.addPlugin'));
  });

  it('shows warning when scaffold is selected but no workspace is open', async () => {
    (fakeAgentx as any).workspaceRoot = undefined;
    sandbox.stub(vscode.window, 'showQuickPick').resolves({ label: 'Scaffold Custom Skill', value: 'scaffold' } as any);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.ok(warnStub.calledOnce);
  });

  it('opens a terminal and runs the skill scaffold script when scaffold is selected', async () => {
    const pickStub = sandbox.stub(vscode.window, 'showQuickPick');
    pickStub.onCall(0).resolves({ label: 'Scaffold Custom Skill', value: 'scaffold' } as any);
    const sendTextStub = sandbox.stub();
    const fakeTerminal = { show: sandbox.stub(), sendText: sendTextStub };
    sandbox.stub(vscode.window, 'createTerminal').returns(fakeTerminal as any);

    await commandCallback();

    assert.ok(pickStub.calledOnce);
    assert.ok((vscode.window.createTerminal as sinon.SinonStub).calledOnce);
    assert.ok(sendTextStub.calledWith('cd "/tmp/workspace"'));
    const scaffoldCalls = sendTextStub.args.filter((args: string[]) => args[0].includes('init-skill.ps1'));
    assert.ok(scaffoldCalls.length > 0, 'should invoke the skill scaffold script');
  });
});
