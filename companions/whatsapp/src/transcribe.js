// Transcribe a WhatsApp voice note (PTT) using OpenAI Whisper.
// No SDK - we POST multipart/form-data with fetch (Node 18+).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

async function transcribeVoiceNote(media, config) {
    if (!config.openaiApiKey) {
        return { ok: false, text: 'Voice notes disabled. Set openaiApiKey in config.json or OPENAI_API_KEY env.' };
    }
    if (!media || !media.data) {
        return { ok: false, text: 'No audio data on message.' };
    }

    // media.data is base64. Whisper accepts ogg/opus directly (WhatsApp PTT format).
    const buf = Buffer.from(media.data, 'base64');
    const ext = (media.mimetype && media.mimetype.includes('ogg')) ? 'ogg' : 'm4a';
    const tmp = path.join(os.tmpdir(), `agentx-wa-${crypto.randomBytes(4).toString('hex')}.${ext}`);
    fs.writeFileSync(tmp, buf);

    try {
        const form = new FormData();
        form.append('file', new Blob([buf], { type: media.mimetype || 'audio/ogg' }), `audio.${ext}`);
        form.append('model', config.whisperModel || 'whisper-1');
        if (config.whisperLanguage) form.append('language', config.whisperLanguage);

        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.openaiApiKey}` },
            body: form
        });

        if (!resp.ok) {
            const errText = await resp.text();
            return { ok: false, text: `Whisper error ${resp.status}: ${errText.slice(0, 300)}` };
        }
        const json = await resp.json();
        const text = (json.text || '').trim();
        if (!text) return { ok: false, text: 'Empty transcription.' };
        return { ok: true, text };
    } catch (err) {
        return { ok: false, text: `Transcription failed: ${err.message}` };
    } finally {
        try { fs.unlinkSync(tmp); } catch (_) {}
    }
}

module.exports = { transcribeVoiceNote };
