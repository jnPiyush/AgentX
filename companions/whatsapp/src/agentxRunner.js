// Spawns the local agentx PowerShell CLI and captures output.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolvePwsh() {
    // Prefer pwsh (PowerShell 7+); fall back to powershell.exe
    return process.env.AGENTX_PWSH || (process.platform === 'win32' ? 'pwsh' : 'pwsh');
}

function runAgentX(args, config) {
    return new Promise((resolve) => {
        const cli = path.resolve(config.repoPath, config.cliRelativePath);
        if (!fs.existsSync(cli)) {
            return resolve({ ok: false, text: `CLI not found at ${cli}. Set repoPath in config.json.` });
        }

        const pwsh = resolvePwsh();
        const fullArgs = ['-NoProfile', '-NonInteractive', '-File', cli, ...args];
        const child = spawn(pwsh, fullArgs, {
            cwd: config.repoPath,
            env: { ...process.env, AGENTX_NONINTERACTIVE: '1' },
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
            killed = true;
            try { child.kill('SIGTERM'); } catch (_) {}
        }, config.commandTimeoutMs);

        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        child.on('close', (code) => {
            clearTimeout(timer);
            const out = (stdout + (stderr ? `\n[stderr]\n${stderr}` : '')).trim();
            const truncated = out.length > config.maxOutputChars
                ? out.slice(0, config.maxOutputChars) + `\n... (truncated, ${out.length} chars total)`
                : out;
            if (killed) {
                return resolve({ ok: false, text: `Timed out after ${config.commandTimeoutMs / 1000}s.\n${truncated}` });
            }
            resolve({ ok: code === 0, text: truncated || `(exit ${code})` });
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ ok: false, text: `Spawn error: ${err.message}` });
        });
    });
}

module.exports = { runAgentX };
