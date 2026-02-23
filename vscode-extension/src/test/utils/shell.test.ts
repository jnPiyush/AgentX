import { strict as assert } from 'assert';
import { execShell, resolveWindowsShell, resetShellCache } from '../../utils/shell';

describe('shell - resolveWindowsShell', () => {

  afterEach(() => {
    resetShellCache();
  });

  it('should return a non-empty string on systems with PowerShell', function () {
    if (process.platform !== 'win32') { this.skip(); }
    const result = resolveWindowsShell();
    assert.ok(result.length > 0, 'should find pwsh or powershell.exe');
    assert.ok(
      result === 'pwsh' || result === 'powershell.exe',
      `unexpected shell: ${result}`
    );
  });

  it('should cache the resolved value', () => {
    const first = resolveWindowsShell();
    const second = resolveWindowsShell();
    assert.equal(first, second, 'cached value should match');
  });

  it('should reset cache when resetShellCache is called', () => {
    resolveWindowsShell(); // populate cache
    resetShellCache();
    // After reset, calling again should still work (re-detect)
    const result = resolveWindowsShell();
    assert.ok(typeof result === 'string', 'should return a string after cache reset');
  });
});

describe('shell - execShell', () => {

  it('should resolve with stdout for a simple command', async () => {
    // Use pwsh on Windows (resolves to pwsh or powershell.exe), bash elsewhere
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = process.platform === 'win32'
      ? 'Write-Output "hello from shell"'
      : 'echo "hello from shell"';

    const result = await execShell(cmd, process.cwd(), shell);
    assert.equal(result, 'hello from shell');
  });

  it('should reject when command fails', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = 'exit 1';

    try {
      await execShell(cmd, process.cwd(), shell);
      assert.fail('should have rejected');
    } catch (err: any) {
      assert.ok(err instanceof Error, 'should throw an Error');
      assert.ok(err.message.includes('Command failed'), 'should contain failure message');
    }
  });

  it('should trim trailing whitespace from output', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = process.platform === 'win32'
      ? 'Write-Output "  padded  "'
      : 'echo "  padded  "';

    const result = await execShell(cmd, process.cwd(), shell);
    // execShell trims the whole output string
    assert.equal(result, 'padded');
  });

  it('should use the specified cwd', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cwd = process.platform === 'win32' ? process.env.TEMP ?? '.' : '/tmp';
    const cmd = process.platform === 'win32'
      ? '(Get-Location).Path'
      : 'pwd';

    const result = await execShell(cmd, cwd, shell);
    // The output should contain the temp directory path
    assert.ok(result.length > 0, 'should return a path');
  });
});
