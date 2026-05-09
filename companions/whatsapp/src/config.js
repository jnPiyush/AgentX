// Loads runtime config for the WhatsApp companion.
// Precedence: env vars > config.json > defaults.

const fs = require('fs');
const path = require('path');

function loadConfig() {
    const root = path.resolve(__dirname, '..');
    const cfgPath = path.join(root, 'config.json');
    let fileCfg = {};
    if (fs.existsSync(cfgPath)) {
        try {
            fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        } catch (err) {
            console.warn('[AgentX WhatsApp] config.json parse error:', err.message);
        }
    }

    const allowed = (process.env.AGENTX_WA_ALLOWED || '').split(',').map(s => s.trim()).filter(Boolean);
    const repoPath = process.env.AGENTX_REPO || fileCfg.repoPath || path.resolve(root, '..', '..');

    return {
        allowedNumbers: allowed.length ? allowed : (fileCfg.allowedNumbers || []),
        repoPath,
        cliRelativePath: fileCfg.cliRelativePath || '.agentx/agentx.ps1',
        defaultAgent: fileCfg.defaultAgent || 'engineer',
        commandTimeoutMs: fileCfg.commandTimeoutMs || 10 * 60 * 1000, // 10 min
        maxOutputChars: fileCfg.maxOutputChars || 6000,
        // Voice notes
        openaiApiKey: process.env.OPENAI_API_KEY || fileCfg.openaiApiKey || '',
        whisperModel: fileCfg.whisperModel || 'whisper-1',
        whisperLanguage: fileCfg.whisperLanguage || '',
        voiceAutoExecute: fileCfg.voiceAutoExecute !== false, // default true
        // Push notifications
        notifications: {
            enabled: fileCfg.notifications ? fileCfg.notifications.enabled !== false : true,
            targets: (fileCfg.notifications && fileCfg.notifications.targets) || null,
            events: (fileCfg.notifications && fileCfg.notifications.events) || ['started', 'iteration', 'complete', 'status']
        }
    };
}

module.exports = { loadConfig };
