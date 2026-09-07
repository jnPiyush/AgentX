import { strict as assert } from 'assert';
import { createRequire } from 'module';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddSkillCommand } from '../../commands/addSkill';
import { resolveSkillOutputDir } from '../../commands/addSkillInternals';
import { buildSkillContentFallback } from '../../commands/scaffoldGeneration';

// Stub the live fs module, not TypeScript's separate namespace wrapper.
const nodeRequire = createRequire(__filename);

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
  let fakeAgentxData: { workspaceRoot: string | undefined };
  let fakeAgentx: AgentXContext;
  let commandCallback: () => Promise<void>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [], extensionUri: { fsPath: '/ext' } } as unknown as vscode.ExtensionContext;
    fakeAgentxData = { workspaceRoot: '/tmp/workspace' };
    fakeAgentx = fakeAgentxData as unknown as AgentXContext;

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
    const registryPickItem = { label: 'Install from Plugin Registry', value: 'registry' };
    sandbox.stub(vscode.window, 'showQuickPick').resolves(registryPickItem);
    const execStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    await commandCallback();

    assert.ok(execStub.calledWith('agentx.addPlugin'));
  });

  it('shows warning when scaffold is selected but no workspace is open', async () => {
    fakeAgentxData.workspaceRoot = undefined;
    const scaffoldPickItem = { label: 'Scaffold Custom Skill', value: 'scaffold' };
    sandbox.stub(vscode.window, 'showQuickPick').resolves(scaffoldPickItem);
    const warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves(undefined);

    await commandCallback();

    assert.ok(warnStub.calledOnce);
  });

  it('opens a terminal and runs the skill scaffold script when scaffold is selected', async () => {
    const pickStub = sandbox.stub(vscode.window, 'showQuickPick');
    const scaffoldPickItem = { label: 'Scaffold Custom Skill', value: 'scaffold' };
    const categoryPickItem: vscode.QuickPickItem = { label: 'development' };
    pickStub.onCall(0).resolves(scaffoldPickItem);
    // Skill details prompts: name -> category pick -> description.
    const inputStub = sandbox.stub(vscode.window, 'showInputBox');
    inputStub.onCall(0).resolves('Test Skill');
    inputStub.onCall(1).resolves('Guides validation of the skill scaffold flow end to end');
    pickStub.onCall(1).resolves(categoryPickItem);

    sandbox.stub(vscode.window, 'withProgress').callsFake(
      async (_options, task) => task({ report: () => undefined }, {} as never),
    );
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as unknown as vscode.TextDocument);
    sandbox.stub(vscode.window, 'showTextDocument').resolves({} as unknown as vscode.TextEditor);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    const fs = nodeRequire('fs') as unknown as typeof import('fs');
    sandbox.stub(fs, 'existsSync').returns(false);
    const mkdirStub = sandbox.stub(fs, 'mkdirSync');
    const writeStub = sandbox.stub(fs, 'writeFileSync');

    await commandCallback();

    assert.ok(pickStub.calledTwice, 'category pick should be shown after the registry/scaffold pick');
    assert.ok(mkdirStub.called, 'should create the skill directory');
    assert.ok(writeStub.called, 'should write SKILL.md');
    const writePath = writeStub.firstCall.args[0] as string;
    assert.ok(writePath.endsWith('SKILL.md'), 'should write to SKILL.md');
    assert.ok(writePath.includes('test-skill'), 'should derive slug from the supplied name');
  });
});
