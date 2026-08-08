const { ConfirmationStore, isReadOnlyPlan } = require('./commandPolicy');
const { executePlan, helpText, planCommand } = require('./commandRouter');
const { transcribeVoiceNote } = require('./transcribe');

function messageId(message) {
  if (message && typeof message.id === 'string') return message.id;
  return message && message.id && (message.id._serialized || message.id.id)
    ? String(message.id._serialized || message.id.id)
    : '';
}

function senderNumber(message) {
  return String(message.from || '').split('@')[0].replace(/\D/g, '');
}

function isAllowed(message, config) {
  return config.allowedNumbers.includes(senderNumber(message));
}

function shouldProcessMessage(message) {
  if (!message || message.isStatus) return false;
  if (!message.fromMe) return true;
  return message.from === message.to && message.deviceType && message.deviceType !== 'web';
}

async function sendChunked(message, text) {
  const value = String(text || '');
  for (let index = 0; index < value.length; index += 3500) {
    await message.reply(value.slice(index, index + 3500));
  }
}

function createMessageHandler(config, dependencies = {}) {
  const confirmations = dependencies.confirmations || new ConfirmationStore({ ttlMs: config.confirmationTtlMs });
  const execute = dependencies.executePlan || executePlan;
  const seen = new Map();
  const maxSeen = 1000;

  const remember = (id) => {
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.set(id, Date.now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
    return true;
  };

  return async function handleMessage(message) {
    if (!shouldProcessMessage(message)) return;
    if (!isAllowed(message, config)) {
      console.warn(`[AgentX WhatsApp] Rejected sender ...${senderNumber(message).slice(-4)}`);
      return;
    }
    if (!remember(messageId(message))) {
      console.warn(`[AgentX WhatsApp] Rejected duplicate or ID-less message from ...${senderNumber(message).slice(-4)}`);
      return;
    }

    const voice = message.hasMedia && (message.type === 'ptt' || message.type === 'audio');
    let body = String(message.body || '').trim();
    if (body.length > config.maxInputChars) {
      await sendChunked(message, `Command exceeds the ${config.maxInputChars} character limit.`);
      return;
    }

    if (voice) {
      const media = await message.downloadMedia();
      const transcription = await (dependencies.transcribe || transcribeVoiceNote)(media, config);
      if (!transcription.ok) return sendChunked(message, transcription.text);
      body = transcription.text;
      if (body.length > config.maxInputChars) {
        await sendChunked(message, `Transcript exceeds the ${config.maxInputChars} character limit.`);
        return;
      }
      const plan = planCommand(body, config);
      if (!config.voiceAutoExecuteReadOnly || !isReadOnlyPlan(plan)) {
        await sendChunked(message, `Transcript:\n${body}\n\nVoice commands are transcript-only unless they are read-only and voiceAutoExecuteReadOnly=true.`);
        return;
      }
    }

    if (!body) return;
    if (/^(help|\?|menu)$/i.test(body)) return sendChunked(message, helpText(config));

    const confirm = /^confirm\s+([A-F0-9]{6})$/i.exec(body);
    if (confirm) {
      const plan = confirmations.consume(senderNumber(message), confirm[1]);
      if (!plan) return sendChunked(message, 'Confirmation is invalid, expired, or already used.');
      const result = await execute(plan, config);
      await sendChunked(message, result.text || '(no output)');
      return;
    }

    const plan = planCommand(body, config);
    if (!plan.ok) return sendChunked(message, plan.text);
    if (plan.risk === 'mutate') {
      const pending = confirmations.request(senderNumber(message), plan);
      await sendChunked(message, pending.text);
      return;
    }

    const result = await execute(plan, config);
    await sendChunked(message, result.text || '(no output)');
  };
}

module.exports = { createMessageHandler, isAllowed, messageId, sendChunked, senderNumber, shouldProcessMessage };
