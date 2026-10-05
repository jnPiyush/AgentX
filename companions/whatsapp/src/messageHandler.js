const { ConfirmationStore, isReadOnlyPlan } = require('./commandPolicy');
const { executePlan, helpText, planCommand } = require('./commandRouter');
const { transcribeVoiceNote } = require('./transcribe');
const { responseArguments, validatePending } = require('./guidedInteraction');

function messageId(message) {
  if (message && typeof message.id === 'string') return message.id;
  return message && message.id && (message.id._serialized || message.id.id)
    ? String(message.id._serialized || message.id.id)
    : '';
}

function senderNumber(message) {
  const match = /^([0-9]{8,15})@c\.us$/.exec(String(message.from || ''));
  return match ? match[1] : '';
}

function isAllowed(message, config) {
  return config.allowedNumbers.includes(senderNumber(message));
}

function shouldProcessMessage(message, selfChat = message?.from === message?.to) {
  if (!message || message.isStatus) return false;
  if (!message.fromMe) return true;
  return selfChat && message.deviceType && message.deviceType !== 'web';
}

async function sendChunked(message, text) {
  const value = String(text || '');
  for (let index = 0; index < value.length;) {
    let end = Math.min(index + 3500, value.length);
    if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--;
    await message.reply(value.slice(index, end));
    index = end;
  }
}

function createMessageHandler(config, dependencies = {}) {
  const confirmations = dependencies.confirmations || new ConfirmationStore({ ttlMs: config.confirmationTtlMs });
  const execute = dependencies.executePlan || executePlan;
  const seen = new Map();
  const pendingSessions = new Map();
  const maxSeen = 1000;

  const phoneFor = async address => {
    const direct = senderNumber({ from: address });
    if (direct) return direct;
    if (!/^[0-9]+@lid$/.test(String(address)) || !dependencies.resolvePhoneNumber) return '';
    let timer;
    try {
      const resolved = await Promise.race([
        dependencies.resolvePhoneNumber(address),
        new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Contact resolution timed out.')), 5000); }),
      ]);
      return senderNumber({ from: resolved });
    } catch (error) {
      console.warn('[Frontier WhatsApp] Contact identity unavailable:', error.message);
      return '';
    } finally { clearTimeout(timer); }
  };

  const executeOwned = async (plan, sender, message) => {
    if (plan.capability && !config.capabilities?.[plan.capability]) {
      return sendChunked(message, 'This capability is no longer enabled. No command was executed.');
    }
    if (plan.response) {
      const owned = pendingSessions.get(plan.response.sessionId);
      if (!owned || owned.sender !== sender || owned.pending.inputId !== plan.pendingInteraction?.inputId) {
        return sendChunked(message, 'The pending request changed or belongs to another sender. Request a new response confirmation.');
      }
    }
    let result;
    try { result = await execute(plan, config); }
    catch (error) {
      console.error('[Frontier WhatsApp] Command execution failed:', error.message);
      return sendChunked(message, 'Command execution failed. Inspect the local companion logs.');
    }
    if (result.pendingInteraction) {
      validatePending(result.pendingInteraction);
      const existing = pendingSessions.get(result.sessionId);
      if (result.sessionId !== result.pendingInteraction.sessionId || (existing && existing.sender !== sender)) {
        console.error('[Frontier WhatsApp] Runtime session ownership mismatch.');
        return sendChunked(message, 'Runtime session ownership mismatch. No response can be submitted; inspect the desktop session.');
      }
      pendingSessions.set(result.sessionId, { sender, pending: structuredClone(result.pendingInteraction) });
      while (pendingSessions.size > 20) pendingSessions.delete(pendingSessions.keys().next().value);
    } else if (result.sessionId) {
      const owned = pendingSessions.get(result.sessionId);
      if (owned?.sender === sender) pendingSessions.delete(result.sessionId);
    }
    await sendChunked(message, result.text || '(no output)');
  };

  const remember = (id) => {
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.set(id, Date.now());
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
    return true;
  };

  return async function handleMessage(message) {
    if (!message || message.isStatus || (message.fromMe && (!message.deviceType || message.deviceType === 'web'))) return;
    const sender = await phoneFor(message.from);
    const selfChat = !message.fromMe || sender === await phoneFor(message.to);
    if (!shouldProcessMessage(message, selfChat)) return;
    if (!sender || !config.allowedNumbers.includes(sender)) {
      console.warn('[Frontier WhatsApp] Rejected unauthorized or unresolved direct-chat sender.');
      return;
    }
    if (!remember(messageId(message))) {
      console.warn(`[Frontier WhatsApp] Rejected duplicate or ID-less message from ...${senderNumber(message).slice(-4)}`);
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
      const plan = confirmations.consume(sender, confirm[1]);
      if (!plan) return sendChunked(message, 'Confirmation is invalid, expired, or already used.');
      await executeOwned(plan, sender, message);
      return;
    }

    const plan = planCommand(body, config);
    if (!plan.ok) return sendChunked(message, plan.text);
    if (plan.response) {
      const owned = pendingSessions.get(plan.response.sessionId);
      if (!owned || owned.sender !== sender) {
        return sendChunked(message, 'No pending session is owned by this sender. After companion restart, inspect and resume it from the trusted desktop.');
      }
      plan.pendingInteraction = structuredClone(owned.pending);
      try { responseArguments(plan.pendingInteraction, plan.response.decision, plan.response.text); }
      catch (error) { return sendChunked(message, error.message); }
    }
    if (plan.risk === 'mutate') {
      const pending = confirmations.request(sender, plan);
      await sendChunked(message, pending.text);
      return;
    }

    await executeOwned(plan, sender, message);
  };
}

module.exports = { createMessageHandler, isAllowed, messageId, sendChunked, senderNumber, shouldProcessMessage };
