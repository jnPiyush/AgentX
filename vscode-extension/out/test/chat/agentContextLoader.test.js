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
const agentContextLoader_1 = require("../../chat/agentContextLoader");
/**
 * Creates a minimal AgentXContext-like object whose workspaceRoot
 * points to a temporary directory we control.
 */
function createFakeAgentx(root) {
    return {
        workspaceRoot: root,
        // Other properties are not used by agentContextLoader
    };
}
describe('agentContextLoader', () => {
    let tmpDir;
    beforeEach(() => {
        (0, agentContextLoader_1.clearInstructionCache)();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-test-'));
        fs.mkdirSync(path.join(tmpDir, '.github', 'agents'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    it('should return undefined when agent file does not exist', async () => {
        const agentx = createFakeAgentx(tmpDir);
        const result = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'nonexistent.agent.md');
        assert_1.strict.equal(result, undefined);
    });
    it('should return undefined when workspace root is not set', async () => {
        const agentx = createFakeAgentx(undefined);
        // workspaceRoot is undefined
        agentx.workspaceRoot = undefined;
        const result = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'engineer.agent.md');
        assert_1.strict.equal(result, undefined);
    });
    it('should return undefined when file has no frontmatter delimiters', async () => {
        const filePath = path.join(tmpDir, '.github', 'agents', 'bad.agent.md');
        fs.writeFileSync(filePath, 'No frontmatter here\nJust plain text\n');
        const agentx = createFakeAgentx(tmpDir);
        const result = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'bad.agent.md');
        assert_1.strict.equal(result, undefined);
    });
    it('should return undefined when file has only opening delimiter', async () => {
        const filePath = path.join(tmpDir, '.github', 'agents', 'partial.agent.md');
        fs.writeFileSync(filePath, '---\nname: Test\nThis never closes\n');
        const agentx = createFakeAgentx(tmpDir);
        const result = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'partial.agent.md');
        assert_1.strict.equal(result, undefined);
    });
    it('should extract body after frontmatter', async () => {
        const filePath = path.join(tmpDir, '.github', 'agents', 'test.agent.md');
        const content = [
            '---',
            'name: Test Agent',
            'description: A test agent',
            '---',
            '',
            '## Role',
            '',
            'This is the role section.',
            '',
            '## Constraints',
            '',
            '- Do not break things',
        ].join('\n');
        fs.writeFileSync(filePath, content);
        const agentx = createFakeAgentx(tmpDir);
        const result = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'test.agent.md');
        assert_1.strict.ok(result, 'should return content');
        assert_1.strict.ok(result.includes('## Role'), 'should contain Role section');
        assert_1.strict.ok(result.includes('This is the role section'), 'should contain role text');
        assert_1.strict.ok(result.includes('## Constraints'), 'should contain Constraints section');
    });
    it('should cache results on subsequent calls', async () => {
        const filePath = path.join(tmpDir, '.github', 'agents', 'cached.agent.md');
        fs.writeFileSync(filePath, '---\nname: Cached\n---\n\nBody content here');
        const agentx = createFakeAgentx(tmpDir);
        const first = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'cached.agent.md');
        // Modify file on disk -- should still return cached
        fs.writeFileSync(filePath, '---\nname: Cached\n---\n\nDIFFERENT content');
        const second = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'cached.agent.md');
        assert_1.strict.equal(first, second, 'should return same cached result');
        assert_1.strict.ok(first.includes('Body content here'), 'should be original content');
    });
    it('should return fresh content after clearInstructionCache', async () => {
        const filePath = path.join(tmpDir, '.github', 'agents', 'refresh.agent.md');
        fs.writeFileSync(filePath, '---\nname: R\n---\n\nOriginal');
        const agentx = createFakeAgentx(tmpDir);
        const first = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'refresh.agent.md');
        assert_1.strict.ok(first.includes('Original'));
        // Clear cache, update file
        (0, agentContextLoader_1.clearInstructionCache)();
        fs.writeFileSync(filePath, '---\nname: R\n---\n\nUpdated');
        const second = await (0, agentContextLoader_1.loadAgentInstructions)(agentx, 'refresh.agent.md');
        assert_1.strict.ok(second.includes('Updated'), 'should return updated content after cache clear');
    });
});
//# sourceMappingURL=agentContextLoader.test.js.map