import { strict as assert } from 'assert';
import { ToolRegistry } from '../../agentic';

describe('ToolRegistry', () => {
  it('should return error for unknown tool', async () => {
    const registry = new ToolRegistry();
    const ac = new AbortController();

    const result = await registry.execute(
      { id: '1', name: 'unknown_tool', params: {} },
      { workspaceRoot: process.cwd(), abortSignal: ac.signal, log: () => {} },
    );

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('Unknown tool'));
  });

  it('should block workspace path escape in file tools', async () => {
    const registry = new ToolRegistry();
    const ac = new AbortController();

    const result = await registry.execute(
      { id: '2', name: 'file_read', params: { filePath: '..\\..\\Windows\\System32\\drivers\\etc\\hosts' } },
      { workspaceRoot: process.cwd(), abortSignal: ac.signal, log: () => {} },
    );

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('outside workspace'));
  });
});
