'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { resolveRuntime, RESOLVE_TIMEOUT_MS } = require('../.frontier/runtime/cursor-mcp.js');
const workspace = path.resolve(__dirname, '..');
const selected = { integration: 'frontier-cursor', workspace, assetRoot: workspace };

test('runtime resolution has a cold-start budget and does not probe SDK status', () => {
  let observed;
  const result = resolveRuntime(workspace, (command, args, options) => {
    observed = { command, args, options };
    return { status: 0, stdout: JSON.stringify(selected), stderr: '' };
  });
  assert.deepEqual(result, selected);
  assert.equal(RESOLVE_TIMEOUT_MS, 120000);
  assert.equal(observed.options.timeout, 120000);
  assert.deepEqual(observed.args.slice(-2), ['cursor', 'runtime']);
  assert.ok(!observed.args.includes('status'));
});

test('resolution timeout is explicit, actionable and never retried automatically', () => {
  let calls = 0;
  assert.throws(() => resolveRuntime(workspace, () => {
    calls++;
    return { error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), status: null };
  }), /Restart.*MCP server.*No automatic retry/);
  assert.equal(calls, 1);
});

test('malformed, failed and foreign workspace bindings cannot start the server', () => {
  for (const result of [
    { status: 1, stdout: '', stderr: 'launcher failed' },
    { status: 0, stdout: 'not-json', stderr: '' },
    { status: 0, stdout: 'null', stderr: '' },
    { status: 0, stdout: JSON.stringify({ ...selected, assetRoot: 'relative' }), stderr: '' },
    { status: 0, stdout: JSON.stringify({ ...selected, workspace: path.join(workspace, 'other') }), stderr: '' },
    { status: 0, stdout: JSON.stringify({ ...selected, integration: 'unknown' }), stderr: '' },
  ]) {
    assert.throws(() => resolveRuntime(workspace, () => result), /runtime|launcher/i);
  }
});
