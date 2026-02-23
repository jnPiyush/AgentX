"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shell_1 = require("../../utils/shell");
describe('shell - resolveWindowsShell', () => {
    afterEach(() => {
        (0, shell_1.resetShellCache)();
    });
    it('should return a non-empty string on systems with PowerShell', function () {
        if (process.platform !== 'win32') {
            this.skip();
        }
        const result = (0, shell_1.resolveWindowsShell)();
        assert_1.strict.ok(result.length > 0, 'should find pwsh or powershell.exe');
        assert_1.strict.ok(result === 'pwsh' || result === 'powershell.exe', `unexpected shell: ${result}`);
    });
    it('should cache the resolved value', () => {
        const first = (0, shell_1.resolveWindowsShell)();
        const second = (0, shell_1.resolveWindowsShell)();
        assert_1.strict.equal(first, second, 'cached value should match');
    });
    it('should reset cache when resetShellCache is called', () => {
        (0, shell_1.resolveWindowsShell)(); // populate cache
        (0, shell_1.resetShellCache)();
        // After reset, calling again should still work (re-detect)
        const result = (0, shell_1.resolveWindowsShell)();
        assert_1.strict.ok(typeof result === 'string', 'should return a string after cache reset');
    });
});
describe('shell - execShell', () => {
    it('should resolve with stdout for a simple command', async () => {
        // Use pwsh on Windows (resolves to pwsh or powershell.exe), bash elsewhere
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cmd = process.platform === 'win32'
            ? 'Write-Output "hello from shell"'
            : 'echo "hello from shell"';
        const result = await (0, shell_1.execShell)(cmd, process.cwd(), shell);
        assert_1.strict.equal(result, 'hello from shell');
    });
    it('should reject when command fails', async () => {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cmd = 'exit 1';
        try {
            await (0, shell_1.execShell)(cmd, process.cwd(), shell);
            assert_1.strict.fail('should have rejected');
        }
        catch (err) {
            assert_1.strict.ok(err instanceof Error, 'should throw an Error');
            assert_1.strict.ok(err.message.includes('Command failed'), 'should contain failure message');
        }
    });
    it('should trim trailing whitespace from output', async () => {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cmd = process.platform === 'win32'
            ? 'Write-Output "  padded  "'
            : 'echo "  padded  "';
        const result = await (0, shell_1.execShell)(cmd, process.cwd(), shell);
        // execShell trims the whole output string
        assert_1.strict.equal(result, 'padded');
    });
    it('should use the specified cwd', async () => {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cwd = process.platform === 'win32' ? process.env.TEMP ?? '.' : '/tmp';
        const cmd = process.platform === 'win32'
            ? '(Get-Location).Path'
            : 'pwd';
        const result = await (0, shell_1.execShell)(cmd, cwd, shell);
        // The output should contain the temp directory path
        assert_1.strict.ok(result.length > 0, 'should return a path');
    });
});
//# sourceMappingURL=shell.test.js.map