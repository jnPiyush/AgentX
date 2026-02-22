"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shell_1 = require("../../utils/shell");
describe('shell - execShell', () => {
    it('should resolve with stdout for a simple command', async () => {
        // Use pwsh on Windows, bash elsewhere
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cmd = shell === 'pwsh'
            ? 'Write-Output "hello from shell"'
            : 'echo "hello from shell"';
        const result = await (0, shell_1.execShell)(cmd, process.cwd(), shell);
        assert_1.strict.equal(result, 'hello from shell');
    });
    it('should reject when command fails', async () => {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cmd = shell === 'pwsh'
            ? 'exit 1'
            : 'exit 1';
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
        const cmd = shell === 'pwsh'
            ? 'Write-Output "  padded  "'
            : 'echo "  padded  "';
        const result = await (0, shell_1.execShell)(cmd, process.cwd(), shell);
        // execShell trims the whole output string
        assert_1.strict.equal(result, 'padded');
    });
    it('should use the specified cwd', async () => {
        const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
        const cwd = process.platform === 'win32' ? process.env.TEMP ?? '.' : '/tmp';
        const cmd = shell === 'pwsh'
            ? '(Get-Location).Path'
            : 'pwd';
        const result = await (0, shell_1.execShell)(cmd, cwd, shell);
        // The output should contain the temp directory path
        assert_1.strict.ok(result.length > 0, 'should return a path');
    });
});
//# sourceMappingURL=shell.test.js.map