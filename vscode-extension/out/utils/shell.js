"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execShell = execShell;
const child_process_1 = require("child_process");
/**
 * Execute a shell command and return stdout.
 */
function execShell(command, cwd, shell = 'pwsh') {
    return new Promise((resolve, reject) => {
        const shellPath = shell === 'pwsh' ? 'pwsh' : '/bin/bash';
        const options = {
            cwd,
            shell: shellPath,
            maxBuffer: 1024 * 1024,
            timeout: 30_000,
        };
        (0, child_process_1.exec)(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Command failed: ${error.message}\n${stderr}`));
                return;
            }
            resolve(stdout.trim());
        });
    });
}
//# sourceMappingURL=shell.js.map