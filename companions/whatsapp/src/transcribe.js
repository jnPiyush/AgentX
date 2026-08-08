const ALLOWED_AUDIO_TYPES = new Set([
  'audio/ogg',
  'audio/ogg; codecs=opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
]);
const AUDIO_EXTENSIONS = Object.freeze({
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/webm': 'webm',
});

function estimateDecodedBytes(base64) {
  return Math.floor((String(base64 || '').length * 3) / 4);
}

async function transcribeVoiceNote(media, config, dependencies = {}) {
  if (!config.openaiApiKey) {
    return { ok: false, text: 'Voice notes disabled. Set OPENAI_API_KEY in the service environment.' };
  }
  if (!media || !media.data) return { ok: false, text: 'No audio data on message.' };

  const mimeType = String(media.mimetype || '').toLowerCase();
  if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
    return { ok: false, text: `Unsupported audio type: ${mimeType || 'unknown'}.` };
  }
  if (estimateDecodedBytes(media.data) > config.voiceMaxBytes) {
    return { ok: false, text: `Voice note exceeds the ${config.voiceMaxBytes} byte limit.` };
  }

  const buffer = Buffer.from(media.data, 'base64');
  if (buffer.length > config.voiceMaxBytes) {
    return { ok: false, text: `Voice note exceeds the ${config.voiceMaxBytes} byte limit.` };
  }

  const fetchImpl = dependencies.fetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.voiceTimeoutMs);
  try {
    const form = new FormData();
    const extension = AUDIO_EXTENSIONS[mimeType];
    form.append('file', new Blob([buffer], { type: mimeType }), `audio.${extension}`);
    form.append('model', config.whisperModel || 'whisper-1');
    if (config.whisperLanguage) form.append('language', config.whisperLanguage);

    const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[AgentX WhatsApp] Transcription provider returned HTTP ${response.status}.`);
      return { ok: false, text: `Transcription provider returned HTTP ${response.status}.` };
    }
    const json = await response.json();
    const text = String(json.text || '').trim();
    return text ? { ok: true, text } : { ok: false, text: 'Empty transcription.' };
  } catch (error) {
    if (error.name === 'AbortError') return { ok: false, text: 'Transcription timed out.' };
    console.warn(`[AgentX WhatsApp] Transcription failed: ${error.message}`);
    return { ok: false, text: 'Transcription failed.' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { ALLOWED_AUDIO_TYPES, AUDIO_EXTENSIONS, estimateDecodedBytes, transcribeVoiceNote };
