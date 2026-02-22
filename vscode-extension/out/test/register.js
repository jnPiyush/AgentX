"use strict";
/**
 * Mocha require hook -- patches Node's module cache so that any
 * `require('vscode')` call inside compiled extension code resolves
 * to our lightweight mock instead of the real VS Code runtime.
 *
 * Usage: mocha --require out/test/register.js
 */
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const path = require('path');
const Module = require('module');
// Intercept require('vscode') -> redirect to our mock
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
        return path.join(__dirname, 'mocks', 'vscode.js');
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};
//# sourceMappingURL=register.js.map