'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function compilerPath() {
  return require.resolve('typescript', {
    paths: [path.join(__dirname, 'repository-parser'), path.resolve(__dirname, '..', '..', 'vscode-extension')],
  });
}

function inspectDeclarations(ts, filename, text) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const diagnostics = source.parseDiagnostics.map(diagnostic => ({
    line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  }));
  const isTest = /(?:^|[/\\])(?:tests?|__tests__)[/\\]|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(filename);
  const nodeTest = source.statements.some(statement => {
    if (ts.isImportDeclaration(statement)) return statement.moduleSpecifier.text === 'node:test';
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some(declaration => {
      const initializer = declaration.initializer;
      return initializer && ts.isCallExpression(initializer)
        && ts.isIdentifier(initializer.expression) && initializer.expression.text === 'require'
        && initializer.arguments.length === 1 && ts.isStringLiteral(initializer.arguments[0])
        && initializer.arguments[0].text === 'node:test';
    });
  });
  const runnable = new Set(['it', 'test', 'specify', 'fit', 'xit', 'before', 'after', 'beforeEach', 'afterEach', 'setup', 'teardown']);
  const declarations = new Set(['it', 'test', 'specify', 'fit', 'xit', 'describe', 'context', 'suite', 'xdescribe']);
  let testDefinitions = 0;
  function name(node) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node) && ['only', 'skip', 'each'].includes(node.name.text)) return name(node.expression);
    if (ts.isCallExpression(node)) return name(node.expression);
    return '';
  }
  function visit(node, inRunnable) {
    const called = ts.isCallExpression(node) ? name(node.expression) : '';
    if (called && declarations.has(called) && isTest && !nodeTest) {
      if (['it', 'test', 'specify', 'fit', 'xit'].includes(called)) testDefinitions++;
      if (inRunnable) diagnostics.push({
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        message: `Mocha declaration '${called}' is nested inside a test or lifecycle callback.`,
      });
    }
    ts.forEachChild(node, child => {
      const callback = ts.isArrowFunction(child) || ts.isFunctionExpression(child);
      visit(child, inRunnable || (callback && runnable.has(called)));
    });
  }
  visit(source, false);
  return { diagnostics: diagnostics.slice(0, 100), testDefinitions, registrationInspected: isTest && !nodeTest };
}

function checkFiles(request) {
  if (!request || request.version !== 1 || typeof request.workspaceRoot !== 'string'
    || !path.isAbsolute(request.workspaceRoot) || !Array.isArray(request.files) || request.files.length > 20000) {
    throw new Error('Invalid static-check request.');
  }
  const ts = require(compilerPath());
  const results = [];
  let diagnosticCount = 0;
  for (const relative of request.files) {
    if (typeof relative !== 'string' || path.isAbsolute(relative)
      || relative.split(/[/\\]/).some(part => part === '..') || /[\u0000-\u001f]/.test(relative)) {
      throw new Error('Static checks require contained relative file paths.');
    }
    const file = path.join(request.workspaceRoot, relative);
    if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error(`Static-check input exceeds 2 MiB: ${relative}`);
    const text = fs.readFileSync(file, 'utf8');
    const result = inspectDeclarations(ts, relative, text);
    if (/\.[cm]?js$/.test(relative)) {
      const syntax = spawnSync(process.execPath, ['--check', file], {
        cwd: request.workspaceRoot, encoding: 'utf8', timeout: 10000, maxBuffer: 65536, windowsHide: true,
      });
      if (syntax.error || syntax.status !== 0) result.diagnostics.push({
        line: 1, message: String(syntax.error?.message ?? syntax.stderr ?? 'JavaScript syntax check failed.').slice(0, 1500),
      });
    }
    diagnosticCount += result.diagnostics.length;
    results.push({ file: relative, ...result });
    if (diagnosticCount > 200) throw new Error('Static-check diagnostics exceed 200; fix the source errors before retrying.');
  }
  return { passed: results.every(result => !result.diagnostics.length), results };
}

function snapshotFiles(request) {
  if (!path.isAbsolute(request.workspaceRoot) || !Array.isArray(request.files) || request.files.length > 20000) {
    throw new Error('Invalid source snapshot request.');
  }
  const directories = new Map();
  const observations = [];
  const files = request.files.map(relative => {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || /[:\u0000-\u001f]/.test(relative)
      || relative.split(/[/\\]/).some(part => part === '..')) throw new Error('Snapshot path escapes the workspace.');
    const parts = relative.split(/[/\\]/);
    let current = request.workspaceRoot;
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      if (index < parts.length - 1 && !directories.has(current)) {
        const info = fs.lstatSync(current, { throwIfNoEntry: false });
        if (!info) return { path: relative, sha256: 'DELETED' };
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Linked snapshot directory: ${relative}`);
        directories.set(current, { ino: info.ino, dev: info.dev });
      }
    }
    const before = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!before) return { path: relative, sha256: 'DELETED' };
    if (!before.isFile() || before.isSymbolicLink() || before.nlink > 1) throw new Error(`Linked/non-file snapshot input: ${relative}`);
    if (before.size > 32 * 1024 * 1024) throw new Error(`Snapshot file exceeds 32 MiB: ${relative}`);
    const fd = fs.openSync(current, 'r');
    try {
      const opened = fs.fstatSync(fd);
      if (opened.ino !== before.ino || opened.dev !== before.dev || opened.nlink > 1) {
        throw new Error(`Snapshot file changed while opening: ${relative}`);
      }
      const digest = crypto.createHash('sha256');
      const buffer = Buffer.alloc(65536);
      let count;
      while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, count));
      const after = fs.fstatSync(fd);
      if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) {
        throw new Error(`Snapshot file changed while hashing: ${relative}`);
      }
      // Metadata-only Windows reads can update ctime; compare identity/size/mtime across checks.
      observations.push([relative, after.dev, after.ino, after.size, after.mtimeMs]);
      return { path: relative, sha256: digest.digest('hex').toUpperCase() };
    } finally { fs.closeSync(fd); }
  });
  for (const [directory, before] of directories) {
    const after = fs.lstatSync(directory);
    if (!after.isDirectory() || after.isSymbolicLink() || after.ino !== before.ino || after.dev !== before.dev) {
      throw new Error('A source directory changed during snapshot collection.');
    }
  }
  return { files, observationHash: crypto.createHash('sha256').update(JSON.stringify(observations)).digest('hex') };
}

module.exports = { compilerPath, inspectDeclarations, checkFiles, snapshotFiles };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node loop-static-checks.js <request.json>');
    if (fs.statSync(process.argv[2]).size > 2 * 1024 * 1024) throw new Error('Static-check request exceeds 2 MiB.');
    const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    const result = request.action === 'snapshot' ? snapshotFiles(request) : checkFiles(request);
    const output = JSON.stringify(result);
    if (Buffer.byteLength(output, 'utf8') > 8 * 1024 * 1024) throw new Error('Static-check output exceeds 8 MiB.');
    process.stdout.write(`${output}\n`);
    process.exitCode = result.passed === false ? 1 : 0;
  } catch (error) {
    process.stderr.write(`[frontier-preflight] ${error.message}\n`);
    process.exitCode = 1;
  }
}
