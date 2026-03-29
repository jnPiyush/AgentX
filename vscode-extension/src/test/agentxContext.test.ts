import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  __setWorkspaceFolders,
  __setConfig,
  __clearConfig,
} from './mocks/vscode';
import { AgentXContext } from '../agentxContext';

/**
 * Create a temporary directory that looks like an AgentX project root
 * (contains .agentx/ directory with config.json).
 */
function createAgentXRoot(dir: string): void {
  const agentxDir = path.join(dir, '.agentx');
  fs.mkdirSync(agentxDir, { recursive: true });
  fs.writeFileSync(path.join(agentxDir, 'config.json'), '{}');
}

/**
 * Create a temporary directory that does NOT look like an AgentX root.
 */
function createPlainDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Hello\n');
}

/**
 * Create a fake ExtensionContext.
 */
function fakeExtensionContext(): any {
  return {
    subscriptions: [],
    extensionPath: __dirname,
    extensionUri: { fsPath: __dirname },
    globalState: { get: () => undefined, update: async () => {} },
    workspaceState: { get: () => undefined, update: async () => {} },
  };
}

describe('AgentXContext', () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ctx-'));
    __clearConfig();
    __setWorkspaceFolders(undefined);
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
    __clearConfig();
    __setWorkspaceFolders(undefined);
  });

  // --- workspaceRoot detection ------------------------------------------

  describe('workspaceRoot', () => {
    it('should return undefined when no workspace folders are open', () => {
      __setWorkspaceFolders(undefined);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, undefined);
    });

    it('should detect AgentX root at workspace folder level', () => {
      const root = path.join(tmpBase, 'project');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, root);
    });

    it('should fall back to first workspace folder if no AgentX root found', () => {
      const noRoot = path.join(tmpBase, 'plain');
      fs.mkdirSync(noRoot, { recursive: true });
      __setWorkspaceFolders([{ path: noRoot }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, noRoot);
    });

    it('should search subdirectories up to configured depth', () => {
      const wsRoot = path.join(tmpBase, 'workspace');
      const nested = path.join(wsRoot, 'subdir', 'myproject');
      fs.mkdirSync(nested, { recursive: true });
      createAgentXRoot(nested);
      __setWorkspaceFolders([{ path: wsRoot }]);
      __setConfig('agentx.searchDepth', 2);

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, nested);
    });

    it('should honor explicit agentx.rootPath setting', () => {
      const explicit = path.join(tmpBase, 'custom-root');
      fs.mkdirSync(explicit, { recursive: true });
      createAgentXRoot(explicit);

      const other = path.join(tmpBase, 'other');
      fs.mkdirSync(other, { recursive: true });
      createAgentXRoot(other);

      __setWorkspaceFolders([{ path: other }]);
      __setConfig('agentx.rootPath', explicit);

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, explicit);
    });

    it('should ignore invalid explicit rootPath and fall back', () => {
      const valid = path.join(tmpBase, 'valid');
      fs.mkdirSync(valid, { recursive: true });
      createAgentXRoot(valid);
      __setWorkspaceFolders([{ path: valid }]);
      // Use a path that cannot exist on any OS (including Windows where
      // /nonexistent/path maps to C:\nonexistent\path on the current drive).
      __setConfig('agentx.rootPath', path.join(tmpBase, 'does-not-exist-' + Date.now()));

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, valid);
    });
  });

  // --- Cache behavior ---------------------------------------------------

  describe('caching', () => {
    it('should cache workspaceRoot between accesses', () => {
      const root = path.join(tmpBase, 'cached');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const first = ctx.workspaceRoot;
      const second = ctx.workspaceRoot;
      assert.equal(first, second);
    });

    it('should refresh after invalidateCache', () => {
      const root1 = path.join(tmpBase, 'root1');
      fs.mkdirSync(root1, { recursive: true });
      createAgentXRoot(root1);
      __setWorkspaceFolders([{ path: root1 }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.workspaceRoot, root1);

      // Change workspace folder and invalidate
      const root2 = path.join(tmpBase, 'root2');
      fs.mkdirSync(root2, { recursive: true });
      createAgentXRoot(root2);
      __setWorkspaceFolders([{ path: root2 }]);
      ctx.invalidateCache();

      assert.equal(ctx.workspaceRoot, root2);
    });
  });

  // --- checkInitialized ------------------------------------------------

  describe('checkInitialized', () => {
    it('should return true when AgentX root exists', async () => {
      const root = path.join(tmpBase, 'init');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const result = await ctx.checkInitialized();
      assert.equal(result, true);
    });

    it('should return true in local mode without config files (zero-config)', async () => {
      const root = path.join(tmpBase, 'noinit');
      fs.mkdirSync(root, { recursive: true });
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const result = await ctx.checkInitialized();
      // Local mode works without any project files
      assert.equal(result, true);
      assert.equal(fs.existsSync(path.join(root, '.agentx', 'config.json')), false);
    });

    it('should return false when no workspace folder', async () => {
      __setWorkspaceFolders([]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const result = await ctx.checkInitialized();
      assert.equal(result, false);
    });

    it('should persist pending clarification state in workspace storage', async () => {
      const root = path.join(tmpBase, 'project');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      let stored: unknown;
      const ctx = new AgentXContext({
        ...fakeExtensionContext(),
        workspaceState: {
          get: () => stored,
          update: async (_key: string, value: unknown) => { stored = value; },
        },
      });

      await ctx.setPendingClarification({
        sessionId: 'session-1',
        agentName: 'engineer',
        prompt: 'fix login',
      });

      assert.deepEqual(await ctx.getPendingClarification(), {
        sessionId: 'session-1',
        agentName: 'engineer',
        prompt: 'fix login',
      });

      await ctx.clearPendingClarification();
      assert.equal(await ctx.getPendingClarification(), undefined);
    });
  });

  // --- Integration detection / getShell ---------------------------------

  describe('integration detection', () => {
    it('should return false for githubConnected when no mcp.json', () => {
      const root = path.join(tmpBase, 'nomcp');
      fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
      fs.writeFileSync(path.join(root, '.agentx', 'config.json'), JSON.stringify({ provider: 'local' }));
      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.githubConnected, false);
      assert.equal(ctx.adoConnected, false);
    });

    it('should detect github integration from mcp.json', () => {
      const root = path.join(tmpBase, 'ghint');
      fs.mkdirSync(path.join(root, '.vscode'), { recursive: true });
      fs.writeFileSync(path.join(root, '.vscode', 'mcp.json'), JSON.stringify({
        servers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp/' } }
      }));
      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.githubConnected, true);
      assert.equal(ctx.adoConnected, false);
    });

    it('should detect ado integration from workspace config', () => {
      const root = path.join(tmpBase, 'adoint');
      fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
      fs.writeFileSync(path.join(root, '.agentx', 'config.json'), JSON.stringify({
        provider: 'ado',
        organization: 'octo-org',
        project: 'OctoProject'
      }));
      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.githubConnected, false);
      assert.equal(ctx.adoConnected, true);
    });

    it('should detect both integrations simultaneously', () => {
      const root = path.join(tmpBase, 'bothint');
      fs.mkdirSync(path.join(root, '.vscode'), { recursive: true });
      fs.mkdirSync(path.join(root, '.agentx'), { recursive: true });
      fs.writeFileSync(path.join(root, '.vscode', 'mcp.json'), JSON.stringify({
        servers: {
          github: { type: 'http', url: 'https://api.githubcopilot.com/mcp/' }
        }
      }));
      fs.writeFileSync(path.join(root, '.agentx', 'config.json'), JSON.stringify({
        provider: 'ado',
        organization: 'octo-org',
        project: 'OctoProject'
      }));
      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.githubConnected, true);
      assert.equal(ctx.adoConnected, true);
    });

    it('should handle hasIntegration with partial name match', () => {
      const root = path.join(tmpBase, 'partial');
      fs.mkdirSync(path.join(root, '.vscode'), { recursive: true });
      fs.writeFileSync(path.join(root, '.vscode', 'mcp.json'), JSON.stringify({
        servers: { 'ado-prd-to-wit': { type: 'http', url: 'https://example.com/' } }
      }));
      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.hasIntegration('ado'), true);
      assert.equal(ctx.hasIntegration('github'), false);
    });

    it('should default shell to auto', () => {
      __setWorkspaceFolders([{ path: tmpBase }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.getShell(), 'auto');
    });
  });

  // --- getCliCommand ----------------------------------------------------

  describe('getCliCommand', () => {
    it('should return powershell path on Windows with auto shell', () => {
      const root = path.join(tmpBase, 'clipath');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);
      __setConfig('agentx.shell', 'auto');

      const ctx = new AgentXContext(fakeExtensionContext());
      const cli = ctx.getCliCommand();
      assert.ok(cli.includes(path.join('.github', 'agentx', '.agentx')));
      if (process.platform === 'win32') {
        assert.ok(cli.endsWith('agentx.ps1'), 'should use PS1 on Windows');
      } else {
        assert.ok(cli.endsWith('agentx.sh'), 'should use SH on non-Windows');
      }
    });

    it('should return bash path when shell is forced to bash', () => {
      const root = path.join(tmpBase, 'bashcli');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);
      __setConfig('agentx.shell', 'bash');

      const ctx = new AgentXContext(fakeExtensionContext());
      assert.ok(ctx.getCliCommand().endsWith('agentx.sh'));
      assert.ok(ctx.getCliCommand().includes(path.join('.github', 'agentx', '.agentx')));
    });

    it('should still resolve bundled runtime path when no workspace root', () => {
      __setWorkspaceFolders(undefined);
      const ctx = new AgentXContext(fakeExtensionContext());
      const cli = ctx.getCliCommand();
      assert.ok(cli.includes(path.join('.github', 'agentx', '.agentx')));
    });
  });

  // --- harness helpers -------------------------------------------------

  describe('harness helpers', () => {
    it('should resolve a state path under .agentx/state', () => {
      const root = path.join(tmpBase, 'state-root');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const statePath = ctx.getStatePath('harness-state.json');
      assert.equal(statePath, path.join(root, '.agentx', 'state', 'harness-state.json'));
    });

    it('should list execution plan files relative to the workspace root', () => {
      const root = path.join(tmpBase, 'plans-root');
      fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
      fs.mkdirSync(path.join(root, 'docs', 'artifacts', 'adr'), { recursive: true });
      createAgentXRoot(root);

      fs.writeFileSync(path.join(root, 'docs', 'plans', 'alpha.md'), '# Alpha\n');
      fs.writeFileSync(path.join(root, 'docs', 'artifacts', 'adr', 'EXEC-PLAN-Beta.md'), '# Beta\n');
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const plans = ctx.listExecutionPlanFiles();
      assert.deepEqual(plans, ['docs/artifacts/adr/EXEC-PLAN-Beta.md', 'docs/plans/alpha.md']);
    });

    it('should return an empty execution plan list when workspace root is missing', () => {
      __setWorkspaceFolders(undefined);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.deepEqual(ctx.listExecutionPlanFiles(), []);
      assert.equal(ctx.getStatePath('harness-state.json'), undefined);
    });
  });

  // --- readAgentDef -----------------------------------------------------

  describe('readAgentDef', () => {
    it('should parse frontmatter from agent file', async () => {
      const root = path.join(tmpBase, 'agentdef');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(root, '.github', 'agents', 'test.agent.md'), [
        '---',
        "description: 'A test agent for unit tests'",
        'model: Claude Sonnet',
        '---',
        '',
        '## Role',
        'Test role content',
      ].join('\n'));

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('test.agent.md');

      assert.ok(def, 'should parse agent definition');
      assert.ok(def!.model.includes('Claude'));
      assert.equal(def!.fileName, 'test.agent.md');
      assert.equal(def!.description, 'A test agent for unit tests');
    });

    it('should parse frontmatter with CRLF line endings (Windows)', async () => {
      const root = path.join(tmpBase, 'agentdef-crlf');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(root, '.github', 'agents', 'crlf.agent.md'), [
        '---',
        "description: 'Agent with Windows line endings'",
        'model: Claude Opus',
        '---',
        '',
        '## Role',
        'Windows content',
      ].join('\r\n'));

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('crlf.agent.md');

      assert.ok(def, 'should parse agent definition with CRLF line endings');
      assert.ok(def!.model.includes('Claude'));
      assert.equal(def!.fileName, 'crlf.agent.md');
      assert.equal(def!.description, 'Agent with Windows line endings');
    });

    it('should return undefined for missing file', async () => {
      const root = path.join(tmpBase, 'noagent');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('nonexistent.agent.md');
      assert.equal(def, undefined);
    });

    it('should return undefined for file without frontmatter', async () => {
      const root = path.join(tmpBase, 'nofm');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '.github', 'agents', 'bad.agent.md'),
        'Just some text without frontmatter\n'
      );

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('bad.agent.md');
      assert.equal(def, undefined);
    });

    it('should parse tools, handoffs, and infer fields', async () => {
      const root = path.join(tmpBase, 'agentdef-extended');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(root, '.github', 'agents', 'rich.agent.md'), [
        '---',
        "description: 'Agent with extended fields'",
        'model: Claude Opus',
        "tools: ['read', 'edit', 'search']",
        'handoffs:',
        '  - agent: engineer',
        '    label: Hand off to Engineer',
        '    prompt: Implement the spec',
        '    send: true',
        '---',
        '',
        '## Role',
        'Rich agent content',
      ].join('\n'));

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('rich.agent.md');

      assert.ok(def, 'should parse agent definition');
      assert.ok(Array.isArray(def!.tools), 'tools should be an array');
      assert.ok(def!.tools!.length > 0, 'tools should not be empty');
      assert.ok(def!.tools!.includes('read'));
      assert.ok(def!.tools!.includes('edit'));
      assert.ok(def!.tools!.includes('search'));
      assert.ok(Array.isArray(def!.handoffs), 'handoffs should be an array');
      assert.ok(def!.handoffs!.length > 0, 'handoffs should not be empty');
      assert.equal(def!.handoffs![0].agent, 'engineer');
    });

    it('should parse multiline list fields from frontmatter', async () => {
      const root = path.join(tmpBase, 'agentdef-multiline-lists');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(root, '.github', 'agents', 'lists.agent.md'), [
        '---',
        "description: 'Agent with multiline lists'",
        'model: Claude Opus',
        'tools:',
        '  - read',
        '  - edit',
        'constraints:',
        '  - no secrets',
        '  - no destructive commands',
        'agents:',
        '  - engineer',
        '  - reviewer',
        '---',
        '',
        '# Lists Agent',
        'Body content',
      ].join('\n'));

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const def = await ctx.readAgentDef('lists.agent.md');

      assert.ok(def, 'should parse agent definition');
      assert.deepEqual(def!.tools, ['read', 'edit']);
      assert.deepEqual(def!.constraints, ['no secrets', 'no destructive commands']);
      assert.deepEqual(def!.agents, ['engineer', 'reviewer']);
    });
  });

  // --- listAgents -------------------------------------------------------

  describe('listAgents', () => {
    it('should list all .agent.md files', async () => {
      const root = path.join(tmpBase, 'listagents');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      const agentsDir = path.join(root, '.github', 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      for (const name of ['alpha', 'beta']) {
        fs.writeFileSync(path.join(agentsDir, `${name}.agent.md`), [
          '---',
          `description: Agent ${name}`,
          'model: TestModel',
          '---',
          '',
          'Content',
        ].join('\n'));
      }
      // Add a non-agent file that should be ignored
      fs.writeFileSync(path.join(agentsDir, 'README.md'), '# Not an agent\n');

      __setWorkspaceFolders([{ path: root }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      const agents = await ctx.listAgents();

      assert.equal(agents.length, 2);
      const fileNames = agents.map((a: any) => a.fileName).sort();
      assert.deepEqual(fileNames, ['alpha.agent.md', 'beta.agent.md']);
    });

    it('should return empty array when agents dir does not exist', async () => {
      const root = path.join(tmpBase, 'noagentsdir');
      fs.mkdirSync(root, { recursive: true });
      createAgentXRoot(root);
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const agents = await ctx.listAgents();
      assert.deepEqual(agents, []);
    });
  });
});
