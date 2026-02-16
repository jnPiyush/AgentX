import { exec } from 'child_process';

/**
 * Execute a shell command and return stdout.
 */
export function execShell(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh'
): Promise<string> {
 return new Promise((resolve, reject) => {
 const shellPath = shell === 'pwsh' ? 'pwsh' : '/bin/bash';
 const options = {
 cwd,
 shell: shellPath,
 maxBuffer: 1024 * 1024,
 timeout: 30_000,
 };

 exec(command, options, (error, stdout, stderr) => {
 if (error) {
 reject(new Error(`Command failed: ${error.message}\n${stderr}`));
 return;
 }
 resolve(stdout.trim());
 });
 });
}
