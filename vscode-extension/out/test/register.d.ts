/**
 * Mocha require hook -- patches Node's module cache so that any
 * `require('vscode')` call inside compiled extension code resolves
 * to our lightweight mock instead of the real VS Code runtime.
 *
 * Usage: mocha --require out/test/register.js
 */
declare const path: any;
declare const Module: any;
declare const originalResolveFilename: any;
//# sourceMappingURL=register.d.ts.map