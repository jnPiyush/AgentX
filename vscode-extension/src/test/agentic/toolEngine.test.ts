import { strict as assert } from 'assert';
import { ToolRegistry, resolveToolCategories } from '../../agentic';

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

// ---------------------------------------------------------------------------
// resolveToolCategories
// ---------------------------------------------------------------------------
describe('resolveToolCategories', () => {
  it('should resolve "read" to file_read and list_dir', () => {
    const resolved = resolveToolCategories(['read']);
    assert.ok(resolved.has('file_read'));
    assert.ok(resolved.has('list_dir'));
    assert.ok(!resolved.has('file_write'));
  });

  it('should resolve "edit" to file_write and file_edit', () => {
    const resolved = resolveToolCategories(['edit']);
    assert.ok(resolved.has('file_write'));
    assert.ok(resolved.has('file_edit'));
  });

  it('should resolve "execute" to terminal_exec', () => {
    const resolved = resolveToolCategories(['execute']);
    assert.ok(resolved.has('terminal_exec'));
  });

  it('should resolve multiple categories', () => {
    const resolved = resolveToolCategories(['read', 'edit', 'agent']);
    assert.ok(resolved.has('file_read'));
    assert.ok(resolved.has('file_write'));
    assert.ok(resolved.has('request_clarification'));
  });

  it('should pass through exact tool names', () => {
    const resolved = resolveToolCategories(['file_read', 'terminal_exec']);
    assert.ok(resolved.has('file_read'));
    assert.ok(resolved.has('terminal_exec'));
  });

  it('should be case-insensitive for categories', () => {
    const resolved = resolveToolCategories(['READ', 'Edit']);
    assert.ok(resolved.has('file_read'));
    assert.ok(resolved.has('file_write'));
  });
});

// ---------------------------------------------------------------------------
// toFilteredFunctionSchemas
// ---------------------------------------------------------------------------
describe('ToolRegistry.toFilteredFunctionSchemas', () => {
  it('should return all schemas when no filter specified', () => {
    const registry = new ToolRegistry();
    const all = registry.toFunctionSchemas();
    const filtered = registry.toFilteredFunctionSchemas();
    assert.equal(filtered.length, all.length);
  });

  it('should return all schemas when empty array', () => {
    const registry = new ToolRegistry();
    const all = registry.toFunctionSchemas();
    const filtered = registry.toFilteredFunctionSchemas([]);
    assert.equal(filtered.length, all.length);
  });

  it('should filter to only read tools', () => {
    const registry = new ToolRegistry();
    const filtered = registry.toFilteredFunctionSchemas(['read']);
    const names = filtered.map((s) => s.name);
    assert.ok(names.includes('file_read'));
    assert.ok(names.includes('list_dir'));
    assert.ok(!names.includes('file_write'));
    assert.ok(!names.includes('terminal_exec'));
  });

  it('should filter using multiple categories', () => {
    const registry = new ToolRegistry();
    const filtered = registry.toFilteredFunctionSchemas(['read', 'execute']);
    const names = filtered.map((s) => s.name);
    assert.ok(names.includes('file_read'));
    assert.ok(names.includes('terminal_exec'));
    assert.ok(!names.includes('file_write'));
  });
});
