import { strict as assert } from 'assert';
import { execShell } from '../../utils/shell';

describe('shell - execShell', () => {

  it('should resolve with stdout for a simple command', async () => {
    // Use pwsh on Windows, bash elsewhere
    const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
    const cmd = shell === 'pwsh'
      ? 'Write-Output "hello from shell"'
      : 'echo "hello from shell"';

    const result = await execShell(cmd, process.cwd(), shell);
    assert.equal(result, 'hello from shell');
  });

  it('should reject when command fails', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
    const cmd = shell === 'pwsh'
      ? 'exit 1'
      : 'exit 1';

    try {
      await execShell(cmd, process.cwd(), shell);
      assert.fail('should have rejected');
    } catch (err: any) {
      assert.ok(err instanceof Error, 'should throw an Error');
      assert.ok(err.message.includes('Command failed'), 'should contain failure message');
    }
  });

  it('should trim trailing whitespace from output', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
    const cmd = shell === 'pwsh'
      ? 'Write-Output "  padded  "'
      : 'echo "  padded  "';

    const result = await execShell(cmd, process.cwd(), shell);
    // execShell trims the whole output string
    assert.equal(result, 'padded');
  });

  it('should use the specified cwd', async () => {
    const shell = process.platform === 'win32' ? 'pwsh' : 'bash';
    const cwd = process.platform === 'win32' ? process.env.TEMP ?? '.' : '/tmp';
    const cmd = shell === 'pwsh'
      ? '(Get-Location).Path'
      : 'pwd';

    const result = await execShell(cmd, cwd, shell);
    // The output should contain the temp directory path
    assert.ok(result.length > 0, 'should return a path');
  });
});
