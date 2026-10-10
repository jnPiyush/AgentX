'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { compilerPath, inspectDeclarations, snapshotFiles } = require('../.frontier/runtime/loop-static-checks.js');
const ts = require(compilerPath());

test('inspects Mocha declarations without evaluating test code', () => {
  const result = inspectDeclarations(ts, 'src/fixture.test.ts', `
    throw new Error('must never execute');
    describe('fixture', () => { it('first', () => { it('lost', () => {}); }); });
  `);
  assert.equal(result.testDefinitions, 2);
  assert.equal(result.diagnostics.length, 1);
  assert.match(result.diagnostics[0].message, /nested/);
});

test('accepts describe callbacks and detects declarations inside lifecycle callbacks', () => {
  assert.deepEqual(inspectDeclarations(ts, 'fixture.test.ts',
    "describe('group', () => { it('one', () => {}); it('two', () => {}); });").diagnostics, []);
  assert.equal(inspectDeclarations(ts, 'fixture.test.ts',
    "beforeEach(() => { describe('late', () => {}); });").diagnostics.length, 1);
});

test('does not reject supported node:test subtests or declarations in strings', () => {
  assert.deepEqual(inspectDeclarations(ts, 'fixture.test.cjs',
    "const { test } = require('node:test'); test('outer', t => { test('inner', () => {}); });").diagnostics, []);
  assert.deepEqual(inspectDeclarations(ts, 'fixture.test.ts',
    'it("outer", () => { const fixture = "it(\\\"inner\\\", () => {})"; });').diagnostics, []);
  assert.equal(inspectDeclarations(ts, 'fixture.test.ts',
    'const fixture = "require(\\\"node:test\\\")"; it("outer", () => { it("lost", () => {}); });').diagnostics.length, 1);
});

test('reports invalid source and does not call ordinary application code a Mocha suite', () => {
  assert.ok(inspectDeclarations(ts, 'source.ts', 'function missing( {').diagnostics.length);
  assert.deepEqual(inspectDeclarations(ts, 'source.ts',
    'function handler() { it(() => it(() => {})); }').diagnostics, []);
  assert.deepEqual(inspectDeclarations(ts, 'fixture.test.ts',
    "it('fixture', () => { context.runCli.resolves('{}'); });").diagnostics, []);
});

test('snapshots content, membership and deleted paths without following workspace links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-loop-snapshot-'));
  try {
    fs.writeFileSync(path.join(root, 'a.txt'), 'first');
    const request = { workspaceRoot: root, files: ['a.txt', 'deleted.txt'] };
    const first = snapshotFiles(request);
    assert.equal(first.files[0].sha256, crypto.createHash('sha256').update('first').digest('hex').toUpperCase());
    assert.equal(first.files[1].sha256, 'DELETED');
    fs.writeFileSync(path.join(root, 'a.txt'), 'other');
    assert.notEqual(snapshotFiles(request).files[0].sha256, first.files[0].sha256);
    assert.throws(() => snapshotFiles({ ...request, files: ['../outside'] }));
    fs.mkdirSync(path.join(root, 'target'));
    fs.symlinkSync(path.join(root, 'target'), path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => snapshotFiles({ ...request, files: ['link/missing.txt'] }), /Linked snapshot directory/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
