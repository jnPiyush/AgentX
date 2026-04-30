---
name: "voice-agents"
description: 'Build low-latency voice agents using speech-to-speech (S2S) realtime APIs and cascaded STT->LLM->TTS pipelines. Covers OpenAI Realtime / GPT Realtime, Azure Voice Live, Gemini Live, Deepgram Voice Agent, ElevenLabs Conversational AI; turn-taking, barge-in, latency budgets, tool use during speech, and telephony (Twilio, LiveKit, Pipecat).'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-04-30"
  updated: "2026-04-30"
compatibility:
  frameworks: ["openai-realtime", "azure-voice-live", "gemini-live", "deepgram-voice-agent", "elevenlabs-conversational", "livekit-agents", "pipecat", "twilio", "vocode"]
  languages: ["python", "typescript"]
---

# Voice Agents

> **Purpose**: Build voice experiences that feel like a phone call, not a chatbot reading aloud.

---

## When to Use This Skill

- Real-time voice assistants (web, mobile, kiosk)
- Telephony agents (inbound / outbound calls, IVR replacement)
- Multimodal copilots that speak and listen
- Accessibility features that require interruption / barge-in

---

## Architecture Choice

```
Speech-to-Speech (S2S, single model)
   audio in -> [Realtime model] -> audio out
   Pros: <500ms latency, natural prosody, can hear tone
   Cons: fewer model choices, higher cost, fewer guardrail hooks

Cascaded
   audio in -> [STT] -> [LLM] -> [TTS] -> audio out
   Pros: any LLM, full control, cheaper, easier guardrails
   Cons: 800-1500ms latency, lost prosody, brittle endpointing
```

Pick S2S when latency and natural turn-taking dominate. Pick cascaded when you need a specific LLM, tighter cost control, or richer logging.

---

## Provider Snapshot (April 2026)

| Provider | Mode | Notes |
|----------|------|-------|
| **OpenAI Realtime / GPT Realtime** | S2S | WebRTC, voice activity detection, function calling |
| **Azure Voice Live** | S2S | Foundry-integrated, Azure RAI controls |
| **Gemini Live** | S2S | Multimodal (audio + video), tool use |
| **Deepgram Voice Agent** | S2S | Telephony focus, low latency |
| **ElevenLabs Conversational AI** | S2S | Best TTS quality, broad voice catalog |
| **Cartesia, Rime, Deepgram Aura** | TTS | For cascaded pipelines |
| **AssemblyAI, Deepgram Nova** | STT | For cascaded pipelines |
| **LiveKit Agents, Pipecat, Vocode** | Orchestration | Wire the pipeline together |

---

## Latency Budget

End-to-end target for natural conversation: **<800ms** mouth-close to mouth-open.

| Stage | Cascaded budget | S2S budget |
|-------|-----------------|------------|
| Endpointing (silence detection) | 200-300ms | 100-200ms |
| STT first-token | 150-300ms | n/a |
| LLM first-token | 200-500ms | 200-500ms |
| TTS first-audio | 150-300ms | bundled |
| Network jitter | 50-150ms | 50-150ms |

Tactics: streaming everywhere, partial STT into LLM, partial LLM into TTS, regional endpoints, WebRTC over WebSocket.

---

## Turn-Taking and Barge-In

- Server-side voice activity detection (VAD) is mandatory; do not rely on client only
- **Barge-in**: when user starts speaking, cancel TTS playback and the in-flight LLM/TTS request, then handle new input
- Detect overlap vs back-channel ("uh-huh", "right") -- do not interrupt on back-channel
- Endpointing: combine VAD + semantic completeness for natural pauses

---

## Tool Use During Speech

- Announce slow tools ("let me check that...") to fill latency
- Use parallel tool calls when independent (see `tool-use-and-function-calling`)
- For long-running tools (>3s), stream interim audio updates
- Confirm destructive tool calls verbally ("you'd like me to cancel order 123, correct?")

---

## Telephony Specifics

- Codec: G.711 mu-law / PCMU at 8kHz; some platforms upsample to 16kHz
- DTMF: handle keypad input alongside voice
- Dropped-call handling: persist conversation state for callback
- Recording / consent: verbal disclosure required in many jurisdictions
- E911 / regulated routing: never route emergencies through an LLM agent
- Stack: Twilio Voice + LiveKit Agents / Pipecat is the common production combo

---

## Safety and Compliance

- PII redaction in transcripts before storage
- Voice biometrics: do not use raw voice as auth without consent and a fallback
- Consent for recording (jurisdiction dependent)
- Hallucination risk in voice is amplified -- users hear confidence; ground responses

---

## Eval

- Word Error Rate (WER) per accent / language slice
- Mean response latency p50/p95
- Barge-in handling success rate
- Turn-taking false-cuts and false-misses
- Task-completion rate (not just transcript correctness)

---

## Skills to Load Alongside

| Need | Skill |
|------|-------|
| Tool calls inside the voice loop | `tool-use-and-function-calling` |
| Latency / cost telemetry | `agent-observability` |
| Choosing the right LLM behind the voice | `reasoning-models`, `llm-gateway-and-routing` |
| Guardrails for voice-bound output | `ai-safety-and-red-teaming` |

## References

- OpenAI Realtime / GPT Realtime docs
- Azure Voice Live, Gemini Live, Deepgram Voice Agent docs
- LiveKit Agents, Pipecat
