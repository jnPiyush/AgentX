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
 * (contains AGENTS.md and .agentx/).
 */
function createAgentXRoot(dir: string): void {
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# AGENTS\n');
  fs.mkdirSync(path.join(dir, '.agentx'), { recursive: true });
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
      __setConfig('agentx.rootPath', '/nonexistent/path');

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

    it('should return false when no AgentX root', async () => {
      const root = path.join(tmpBase, 'noinit');
      fs.mkdirSync(root, { recursive: true });
      __setWorkspaceFolders([{ path: root }]);

      const ctx = new AgentXContext(fakeExtensionContext());
      const result = await ctx.checkInitialized();
      assert.equal(result, false);
    });
  });

  // --- getMode / getShell -----------------------------------------------

  describe('configuration accessors', () => {
    it('should default mode to local', () => {
      __setWorkspaceFolders([{ path: tmpBase }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.getMode(), 'local');
    });

    it('should return configured mode', () => {
      __setConfig('agentx.mode', 'github');
      __setWorkspaceFolders([{ path: tmpBase }]);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.getMode(), 'github');
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
    });

    it('should return empty string when no workspace root', () => {
      __setWorkspaceFolders(undefined);
      const ctx = new AgentXContext(fakeExtensionContext());
      assert.equal(ctx.getCliCommand(), '');
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
        'name: Test Agent',
        "description: 'A test agent for unit tests'",
        'maturity: stable',
        'mode: agent',
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
      assert.equal(def!.name, 'Test Agent');
      assert.equal(def!.maturity, 'stable');
      assert.equal(def!.mode, 'agent');
      assert.ok(def!.model.includes('Claude'));
      assert.equal(def!.fileName, 'test.agent.md');
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
          `name: ${name}`,
          `description: Agent ${name}`,
          'maturity: stable',
          'mode: agent',
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
      const names = agents.map((a: any) => a.name).sort();
      assert.deepEqual(names, ['alpha', 'beta']);
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
