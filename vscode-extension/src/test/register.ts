/**
 * Mocha require hook -- patches Node's module cache so that any
 * `require('vscode')` call inside compiled extension code resolves
 * to our lightweight mock instead of the real VS Code runtime.
 *
 * Usage: mocha --require out/test/register.js
 */

import * as path from 'path';
import { createRequire } from 'module';

// `Module._resolveFilename` is a private Node internal, not part of the
// public `module` typings, and monkey-patching it requires mutating the
// live singleton object Node's own require machinery reads from -- a
// static `import * as Module from 'module'` binds a per-import namespace
// object instead (assignment to it would not affect the real resolver).
// `createRequire` is the documented, standards-based way to obtain a real,
// fully-functional CommonJS `require` (resolving to the same live builtin
// module singleton as a direct `require()` call) without using the
// `require()` call form the lint rule targets.
const nodeRequire = createRequire(__filename);

interface ModuleInternals {
  _resolveFilename: (
    this: unknown,
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string;
}

const nodeModule = nodeRequire('module') as unknown as ModuleInternals;

// Intercept require('vscode') -> redirect to our mock
const originalResolveFilename = nodeModule._resolveFilename;
nodeModule._resolveFilename = function (
  this: unknown,
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request === 'vscode') {
    return path.join(__dirname, 'mocks', 'vscode.js');
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
