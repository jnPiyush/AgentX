"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const vscode_1 = require("./mocks/vscode");
const agentxContext_1 = require("../agentxContext");
/**
 * Create a temporary directory that looks like an AgentX project root
 * (contains AGENTS.md and .agentx/).
 */
function createAgentXRoot(dir) {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# AGENTS\n');
    fs.mkdirSync(path.join(dir, '.agentx'), { recursive: true });
}
/**
 * Create a temporary directory that does NOT look like an AgentX root.
 */
function createPlainDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), '# Hello\n');
}
/**
 * Create a fake ExtensionContext.
 */
function fakeExtensionContext() {
    return {
        subscriptions: [],
        extensionPath: __dirname,
        extensionUri: { fsPath: __dirname },
        globalState: { get: () => undefined, update: async () => { } },
        workspaceState: { get: () => undefined, update: async () => { } },
    };
}
describe('AgentXContext', () => {
    let tmpBase;
    beforeEach(() => {
        tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-ctx-'));
        (0, vscode_1.__clearConfig)();
        (0, vscode_1.__setWorkspaceFolders)(undefined);
    });
    afterEach(() => {
        fs.rmSync(tmpBase, { recursive: true, force: true });
        (0, vscode_1.__clearConfig)();
        (0, vscode_1.__setWorkspaceFolders)(undefined);
    });
    // --- workspaceRoot detection ------------------------------------------
    describe('workspaceRoot', () => {
        it('should return undefined when no workspace folders are open', () => {
            (0, vscode_1.__setWorkspaceFolders)(undefined);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, undefined);
        });
        it('should detect AgentX root at workspace folder level', () => {
            const root = path.join(tmpBase, 'project');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, root);
        });
        it('should fall back to first workspace folder if no AgentX root found', () => {
            const noRoot = path.join(tmpBase, 'plain');
            fs.mkdirSync(noRoot, { recursive: true });
            (0, vscode_1.__setWorkspaceFolders)([{ path: noRoot }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, noRoot);
        });
        it('should search subdirectories up to configured depth', () => {
            const wsRoot = path.join(tmpBase, 'workspace');
            const nested = path.join(wsRoot, 'subdir', 'myproject');
            fs.mkdirSync(nested, { recursive: true });
            createAgentXRoot(nested);
            (0, vscode_1.__setWorkspaceFolders)([{ path: wsRoot }]);
            (0, vscode_1.__setConfig)('agentx.searchDepth', 2);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, nested);
        });
        it('should honor explicit agentx.rootPath setting', () => {
            const explicit = path.join(tmpBase, 'custom-root');
            fs.mkdirSync(explicit, { recursive: true });
            createAgentXRoot(explicit);
            const other = path.join(tmpBase, 'other');
            fs.mkdirSync(other, { recursive: true });
            createAgentXRoot(other);
            (0, vscode_1.__setWorkspaceFolders)([{ path: other }]);
            (0, vscode_1.__setConfig)('agentx.rootPath', explicit);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, explicit);
        });
        it('should ignore invalid explicit rootPath and fall back', () => {
            const valid = path.join(tmpBase, 'valid');
            fs.mkdirSync(valid, { recursive: true });
            createAgentXRoot(valid);
            (0, vscode_1.__setWorkspaceFolders)([{ path: valid }]);
            (0, vscode_1.__setConfig)('agentx.rootPath', '/nonexistent/path');
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, valid);
        });
    });
    // --- Cache behavior ---------------------------------------------------
    describe('caching', () => {
        it('should cache workspaceRoot between accesses', () => {
            const root = path.join(tmpBase, 'cached');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const first = ctx.workspaceRoot;
            const second = ctx.workspaceRoot;
            assert_1.strict.equal(first, second);
        });
        it('should refresh after invalidateCache', () => {
            const root1 = path.join(tmpBase, 'root1');
            fs.mkdirSync(root1, { recursive: true });
            createAgentXRoot(root1);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root1 }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.workspaceRoot, root1);
            // Change workspace folder and invalidate
            const root2 = path.join(tmpBase, 'root2');
            fs.mkdirSync(root2, { recursive: true });
            createAgentXRoot(root2);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root2 }]);
            ctx.invalidateCache();
            assert_1.strict.equal(ctx.workspaceRoot, root2);
        });
    });
    // --- checkInitialized ------------------------------------------------
    describe('checkInitialized', () => {
        it('should return true when AgentX root exists', async () => {
            const root = path.join(tmpBase, 'init');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const result = await ctx.checkInitialized();
            assert_1.strict.equal(result, true);
        });
        it('should return false when no AgentX root', async () => {
            const root = path.join(tmpBase, 'noinit');
            fs.mkdirSync(root, { recursive: true });
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const result = await ctx.checkInitialized();
            assert_1.strict.equal(result, false);
        });
    });
    // --- getMode / getShell -----------------------------------------------
    describe('configuration accessors', () => {
        it('should default mode to local', () => {
            (0, vscode_1.__setWorkspaceFolders)([{ path: tmpBase }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.getMode(), 'local');
        });
        it('should return configured mode', () => {
            (0, vscode_1.__setConfig)('agentx.mode', 'github');
            (0, vscode_1.__setWorkspaceFolders)([{ path: tmpBase }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.getMode(), 'github');
        });
        it('should default shell to auto', () => {
            (0, vscode_1.__setWorkspaceFolders)([{ path: tmpBase }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.getShell(), 'auto');
        });
    });
    // --- getCliCommand ----------------------------------------------------
    describe('getCliCommand', () => {
        it('should return powershell path on Windows with auto shell', () => {
            const root = path.join(tmpBase, 'clipath');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            (0, vscode_1.__setConfig)('agentx.shell', 'auto');
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const cli = ctx.getCliCommand();
            if (process.platform === 'win32') {
                assert_1.strict.ok(cli.endsWith('agentx.ps1'), 'should use PS1 on Windows');
            }
            else {
                assert_1.strict.ok(cli.endsWith('agentx.sh'), 'should use SH on non-Windows');
            }
        });
        it('should return bash path when shell is forced to bash', () => {
            const root = path.join(tmpBase, 'bashcli');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            (0, vscode_1.__setConfig)('agentx.shell', 'bash');
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.ok(ctx.getCliCommand().endsWith('agentx.sh'));
        });
        it('should return empty string when no workspace root', () => {
            (0, vscode_1.__setWorkspaceFolders)(undefined);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            assert_1.strict.equal(ctx.getCliCommand(), '');
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
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const def = await ctx.readAgentDef('test.agent.md');
            assert_1.strict.ok(def, 'should parse agent definition');
            assert_1.strict.equal(def.name, 'Test Agent');
            assert_1.strict.equal(def.maturity, 'stable');
            assert_1.strict.equal(def.mode, 'agent');
            assert_1.strict.ok(def.model.includes('Claude'));
            assert_1.strict.equal(def.fileName, 'test.agent.md');
        });
        it('should return undefined for missing file', async () => {
            const root = path.join(tmpBase, 'noagent');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const def = await ctx.readAgentDef('nonexistent.agent.md');
            assert_1.strict.equal(def, undefined);
        });
        it('should return undefined for file without frontmatter', async () => {
            const root = path.join(tmpBase, 'nofm');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            fs.mkdirSync(path.join(root, '.github', 'agents'), { recursive: true });
            fs.writeFileSync(path.join(root, '.github', 'agents', 'bad.agent.md'), 'Just some text without frontmatter\n');
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const def = await ctx.readAgentDef('bad.agent.md');
            assert_1.strict.equal(def, undefined);
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
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const agents = await ctx.listAgents();
            assert_1.strict.equal(agents.length, 2);
            const names = agents.map((a) => a.name).sort();
            assert_1.strict.deepEqual(names, ['alpha', 'beta']);
        });
        it('should return empty array when agents dir does not exist', async () => {
            const root = path.join(tmpBase, 'noagentsdir');
            fs.mkdirSync(root, { recursive: true });
            createAgentXRoot(root);
            (0, vscode_1.__setWorkspaceFolders)([{ path: root }]);
            const ctx = new agentxContext_1.AgentXContext(fakeExtensionContext());
            const agents = await ctx.listAgents();
            assert_1.strict.deepEqual(agents, []);
        });
    });
});
//# sourceMappingURL=agentxContext.test.js.map