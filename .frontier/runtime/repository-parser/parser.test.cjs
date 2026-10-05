const test = require('node:test');
const assert = require('node:assert/strict');
const { capabilities, parseFiles } = require('./index.js');

test('managed parser resolves capabilities without workspace modules', () => {
  const result = capabilities();
  assert.match(result.identity, /^[a-f0-9]{64}$/);
  assert.ok(result.available.includes('.ts'));
  assert.ok(result.available.includes('.py'));
  assert.deepEqual(result.diagnostics, []);
});

test('TypeScript indexing retains definitions after the old 64 symbol cap', async () => {
  const text = Array.from({ length: 90 }, (_, index) =>
    `export function operation${index}(value: string): string { return value; }`).join('\n');
  const { results } = await parseFiles({ version: 1, files: [{ path: 'src/operations.ts', text }] });
  assert.equal(results[0].symbols.length, 90);
  assert.equal(results[0].symbols.at(-1).Name, 'operation89');
  assert.equal(results[0].symbols.at(-1).Line, 90);
  assert.equal(results[0].parseErrors, 0);
  assert.equal(results[0].metadataTruncated, false);
});

test('TypeScript includes method ranges, imports and calls without secret defaults', async () => {
  const text = [
    "import { helper } from './helper';",
    'export class Service {',
    "  execute(value = 'private-default') {",
    '    return helper(value);',
    '  }',
    '}',
  ].join('\n');
  const { results } = await parseFiles({ version: 1, files: [{ path: 'src/service.ts', text }] });
  const method = results[0].symbols.find(symbol => symbol.Name === 'execute');
  assert.equal(method.QualifiedName, 'Service.execute');
  assert.equal(method.Line, 3);
  assert.equal(method.EndLine, 5);
  assert.ok(!method.Signature.includes('private-default'));
  assert.ok(results[0].references.some(reference => reference.Target === './helper'));
  assert.ok(results[0].calls.some(call => call.Name === 'helper' && call.Scope === 'Service.execute'));
});

test('managed Tree-sitter handles Python and reports syntax limitations honestly', async () => {
  const { results } = await parseFiles({ version: 1, files: [
    { path: 'app.py', text: 'class Example:\n    def execute(self, value):\n        return transform(value)\n' },
    { path: 'broken.py', text: 'def incomplete(\n' },
  ] });
  assert.match(results[0].parser, /^tree-sitter\/python/);
  assert.ok(results[0].symbols.some(symbol => symbol.Name === 'execute'));
  assert.ok(results[0].calls.some(call => call.Name === 'transform'));
  assert.ok(results[1].parseErrors > 0);
});

test('parser protocol rejects unsupported fields and excessive batches', async () => {
  await assert.rejects(parseFiles({ version: 1, files: [], execute: true }));
  await assert.rejects(parseFiles({ version: 1, files: Array(33).fill({ path: 'x.ts', text: '' }) }));
  await assert.rejects(parseFiles({ version: 1, files: [{ path: 'x.ts', text: '', command: 'run' }] }));
  await assert.rejects(parseFiles({ version: 1, files: [{ path: 'x.ts', text: 'x'.repeat(1048577) }] }));
});

test('all managed parser ranges use CRLF, CR and LF rather than language-specific separators', async () => {
  const { results } = await parseFiles({ version: 1, files: [
    { path: 'separators.ts', text: '// heading\r\nexport function first() {}\u2028export function second() {}\rexport function third() {}' },
    { path: 'separators.cs', text: '// \ud83d\ude00\nclass First {}\rclass Second {}\r\nclass Third {}' },
  ] });
  const tsLines = Object.fromEntries(results[0].symbols.map(symbol => [symbol.Name, symbol.Line]));
  assert.deepEqual(tsLines, { first: 2, second: 2, third: 3 });
  const csLines = Object.fromEntries(results[1].symbols.map(symbol => [symbol.Name, symbol.Line]));
  assert.deepEqual(csLines, { First: 2, Second: 3, Third: 4 });
});

test('metadata text sanitizer remains bounded for adversarial quoted comments', async () => {
  const marker = "'\\" + 'a\\'.repeat(256) + "*/";
  const text = `const x = { y() { return 1; } };\n(x /*${marker}).y();\n`;
  const started = process.hrtime.bigint();
  const { results } = await parseFiles({ version: 1, files: [{ path: 'src/adversarial.ts', text }] });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  assert.ok(elapsedMs < 1000, `parse took ${elapsedMs}ms`);
  assert.ok(results[0].calls.some(call => call.Name === 'y'));
});
