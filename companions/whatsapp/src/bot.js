// AgentX WhatsApp Companion
// Connects WhatsApp Web (via puppeteer) to the local agentx CLI on your desktop.
// On first run: scan the QR code printed in the terminal with WhatsApp on your phone.
// Subsequent runs: session is restored from .wwebjs_auth/.

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { loadConfig } = require('./config');
const { routeCommand, helpText } = require('./commandRouter');
const { transcribeVoiceNote } = require('./transcribe');
const { startLoopWatcher } = require('./loopWatcher');

const config = loadConfig();
const sessionRoot = path.resolve(__dirname, '..', '.wwebjs_auth');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionRoot }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('\n[AgentX WhatsApp] Scan this QR with WhatsApp -> Linked Devices:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('[AgentX WhatsApp] Authenticated. Session cached.');
});

client.on('auth_failure', (msg) => {
    console.error('[AgentX WhatsApp] Auth failure:', msg);
});

client.on('ready', () => {
    console.log(`[AgentX WhatsApp] Ready. Allowed numbers: ${config.allowedNumbers.join(', ') || '(none)'}`);
    console.log(`[AgentX WhatsApp] Repo: ${config.repoPath}`);
    startLoopWatcher({ config, client });
});

client.on('disconnected', (reason) => {
    console.warn('[AgentX WhatsApp] Disconnected:', reason);
});

function isAllowed(msg) {
    if (config.allowedNumbers.length === 0) return false;
    // msg.from looks like "<countrycode><number>@c.us" e.g. 14155551234@c.us
    const num = (msg.from || '').split('@')[0];
    return config.allowedNumbers.some(n => num === n.replace(/\D/g, ''));
}

function shouldProcessMessage(msg) {
    if (msg.isStatus) return false;

    // Self-chat commands sent from the operator's phone arrive as fromMe=true.
    // Keep accepting normal incoming messages, but ignore anything generated
    // by this web session so the bot does not answer its own replies.
    if (!msg.fromMe) return true;

    const isSelfChat = !!msg.from && msg.from === msg.to;
    const isRemoteOperatorDevice = msg.deviceType && msg.deviceType !== 'web';
    return isSelfChat && isRemoteOperatorDevice;
}

async function send(msg, text) {
    if (!text) return;
    const MAX = 3500; // WhatsApp soft limit safety
    for (let i = 0; i < text.length; i += MAX) {
        await msg.reply(text.slice(i, i + MAX));
    }
}

client.on('message', async (msg) => {
    try {
        if (!shouldProcessMessage(msg)) return;
        const body = (msg.body || '').trim();
        const isVoice = msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio');
        if (!body && !isVoice) return;

        if (!isAllowed(msg)) {
            console.warn(`[AgentX WhatsApp] Rejected message from ${msg.from}`);
            return; // silent drop - do not echo to unknown numbers
        }

        // Voice note (PTT) handling: transcribe -> route as text command
        if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
            console.log(`[AgentX WhatsApp] <- ${msg.from}: [voice note]`);
            await msg.react('[v]').catch(() => {});
            const media = await msg.downloadMedia();
            const tx = await transcribeVoiceNote(media, config);
            if (!tx.ok) {
                await send(msg, tx.text);
                await msg.react('[X]').catch(() => {});
                return;
            }
            const transcript = tx.text;
            console.log(`[AgentX WhatsApp] transcript: ${transcript}`);
            if (!config.voiceAutoExecute) {
                await send(msg, `Transcript:\n${transcript}\n\n(voiceAutoExecute=false; reply with the command to run it)`);
                return;
            }
            await send(msg, `Heard: "${transcript}"\nRunning...`);
            const result = await routeCommand(transcript, config);
            await send(msg, result.text || '(no output)');
            await msg.react(result.ok ? '[OK]' : '[X]').catch(() => {});
            return;
        }

        console.log(`[AgentX WhatsApp] <- ${msg.from}: ${body}`);

        if (/^(help|\?|menu)$/i.test(body)) {
            await send(msg, helpText());
            return;
        }

        await msg.react('[?]').catch(() => {});
        const result = await routeCommand(body, config);
        await send(msg, result.text || '(no output)');
        await msg.react(result.ok ? '[OK]' : '[X]').catch(() => {});
    } catch (err) {
        console.error('[AgentX WhatsApp] Handler error:', err);
        try { await msg.reply(`Error: ${err.message}`); } catch (_) {}
    }
});

console.log('[AgentX WhatsApp] Starting...');
client.initialize().catch((err) => {
    console.error('[AgentX WhatsApp] Failed to initialize:', err);
    process.exit(1);
});

process.on('SIGINT', () => { console.log('\n[AgentX WhatsApp] Shutting down.'); client.destroy().finally(() => process.exit(0)); });
