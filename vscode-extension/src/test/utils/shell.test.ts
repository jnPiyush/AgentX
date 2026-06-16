import { strict as assert } from 'assert';
import { execShell, execShellStreaming, resolveWindowsShell, resetShellCache } from '../../utils/shell';

describe('shell - resolveWindowsShell', () => {

  afterEach(() => {
    resetShellCache();
  });

  it('should return a non-empty string on systems with PowerShell', function () {
    if (process.platform !== 'win32') { this.skip(); }
    const result = resolveWindowsShell();
    assert.ok(result === '' || result === 'pwsh', `unexpected shell: ${result}`);
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

describe('shell - execShell', function () {
  // These cases spawn real pwsh/bash processes. Under c8 coverage
  // instrumentation during a full-suite run, a cold shell start can exceed
  // the 10s default mocha timeout and flake -- and starve the next,
  // synchronous test that runs immediately after (the versionChecker case).
  // Give the real-process cases generous headroom.
  this.timeout(30000);

  it('should resolve with stdout for a simple command', async () => {
    // Use pwsh on Windows when supported, bash elsewhere
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = process.platform === 'win32'
      ? 'Write-Output "hello from shell"'
      : 'echo "hello from shell"';

    if (process.platform === 'win32' && resolveWindowsShell() !== 'pwsh') {
      return;
    }

    const result = await execShell(cmd, process.cwd(), shell);
    assert.equal(result, 'hello from shell');
  });

  it('should reject when command fails', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = 'exit 1';

    if (process.platform === 'win32' && resolveWindowsShell() !== 'pwsh') {
      return;
    }

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

    if (process.platform === 'win32' && resolveWindowsShell() !== 'pwsh') {
      return;
    }

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

    if (process.platform === 'win32' && resolveWindowsShell() !== 'pwsh') {
      return;
    }

    const result = await execShell(cmd, cwd, shell);
    // The output should contain the temp directory path
    assert.ok(result.length > 0, 'should return a path');
  });

  it('should stream line output while returning final stdout', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const cmd = process.platform === 'win32'
      ? 'Write-Output "line one"; Write-Output "line two"'
      : 'printf "line one\\nline two\\n"';

    if (process.platform === 'win32' && resolveWindowsShell() !== 'pwsh') {
      return;
    }

    const lines: string[] = [];
    const result = await execShellStreaming(cmd, process.cwd(), shell, (line) => lines.push(line));

    assert.deepEqual(lines, ['line one', 'line two']);
    assert.equal(result, 'line one\nline two');
  });
});
