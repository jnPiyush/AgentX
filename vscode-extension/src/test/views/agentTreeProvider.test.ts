import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentTreeProvider } from '../../views/agentTreeProvider';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-agent-tree-'));
  fs.mkdirSync(path.join(root, '.github', 'skills', 'development', 'testing'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.github', 'skills', 'development', 'testing', 'SKILL.md'),
    '# Testing skill',
    'utf-8',
  );
  return root;
}

describe('AgentTreeProvider', () => {
  it('should include suggested skills for mapped agents', async () => {
    const root = createWorkspaceRoot();
    const provider = new AgentTreeProvider({
      workspaceRoot: root,
      extensionContext: { extensionPath: root },
      listVisibleAgents: async () => [
        {
          name: 'Engineer',
          fileName: 'engineer.agent.md',
          description: 'Implements code',
          constraints: [],
          handoffs: [],
          tools: [],
          agents: [],
          boundaries: { canModify: [], cannotModify: [] },
        },
      ],
    } as any);

    const items = await provider.getChildren();
    assert.equal(items.length, 1);

    const children = await provider.getChildren(items[0]);
    const skillGroup = children.find((item) => String(item.label).startsWith('Suggested skills'));
    assert.ok(skillGroup);

    const skillChildren = await provider.getChildren(skillGroup!);
    assert.ok(skillChildren.some((item) => item.label === 'Testing'));
    assert.ok(skillChildren.some((item) => item.command?.command === 'vscode.open'));
  });
});