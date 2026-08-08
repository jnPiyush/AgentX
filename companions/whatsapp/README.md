# AgentX WhatsApp Companion

Control a local AgentX workspace from an allowlisted WhatsApp account. The companion uses the unofficial `whatsapp-web.js` automation surface and a local headless Chromium session. AgentX command execution remains on the desktop; optional voice transcription sends audio to OpenAI when `OPENAI_API_KEY` is configured.

## Security Model

The companion is read-only by default.

- Only normalized allowlisted phone numbers are accepted.
- Native-device self-chat commands are received through `message_create`; linked-web replies are ignored.
- Message IDs are replay-protected so one WhatsApp event runs at most once.
- `ready`, `state`, `status`, `deps`, and `workflow` are enabled by default.
- `ship`, `run`/`ask`, `loop start`, and `raw` require an explicit capability plus a short-lived, sender-bound, single-use confirmation nonce.
- Remote `loop iterate` and `loop complete` are disabled because current AgentX requires fresh local evidence.
- Voice notes are transcript-only by default. A mutation is never authorized by voice.
- Chromium sandboxing stays enabled; do not add `--no-sandbox` on a workstation.
- AgentX children receive a secret-redacted environment, run serially, and have timeout/output limits.

Use a dedicated OS account and, ideally, a dedicated WhatsApp account. Protect `.wwebjs_auth/` as a credential. This is not a WhatsApp Business API integration and can break when WhatsApp Web changes.

## Prerequisites

- Node.js 18.17+
- PowerShell 7 (`pwsh`) on PATH
- AgentX checkout with `.agentx/agentx.ps1`
- A supported local Chrome/Chromium installed by Puppeteer or selected via `browser.executablePath`

## Setup

```powershell
cd companions\whatsapp
npm ci
Copy-Item config.example.json config.json
# Edit config.json: repoPath and your digits-only country-code number.
npm test
npm audit --omit=dev --omit=optional --audit-level=high
npm start
```

On first run, scan the QR code from WhatsApp -> Settings -> Linked Devices. Session data is cached under `.wwebjs_auth/`, which is gitignored.

For voice transcription, set the secret only in the service environment:

```powershell
Set-Item Env:OPENAI_API_KEY (Read-Host 'OpenAI API key' -AsSecureString)
```

`openaiApiKey` in `config.json` is rejected.

## Commands

### Read-only defaults

| Message | Result |
|---------|--------|
| `ready` | Priority work queue |
| `state` | Agent states |
| `status` or `loop status` | Quality-loop status |
| `deps 402` | Issue dependencies |
| `workflow engineer` | Agent workflow |
| `help` | Current command/capability menu |

### Mutating capabilities

All are disabled in `config.example.json`. Enable only what is needed:

```json
"capabilities": {
  "ship": false,
  "run": false,
  "loopMutation": false,
  "raw": false
}
```

When enabled, a mutation does not run immediately:

```text
You: ship 402
Bot: Confirmation required ... Reply: confirm A1B2C3
You: confirm A1B2C3
Bot: <AgentX output>
```

The nonce expires after `confirmationTtlMs`, is bound to the sender, and works once. `raw` is the highest-risk capability because it exposes the full AgentX CLI argument surface; keep it disabled.

## Voice Notes

Supported MIME types: OGG/Opus, MPEG, MP4/M4A, and WebM. Audio is size-limited and transcription has an abort timeout. Provider error bodies and transcripts are not logged.

- `voiceAutoExecuteReadOnly: false` (default): always reply with transcript only.
- `voiceAutoExecuteReadOnly: true`: execute only commands classified read-only.
- Mutating transcriptions always require the operator to send the command as text and then confirm its nonce.

## Push Notifications

The companion watches `.agentx/state/loop-state.json` and can notify allowlisted targets for `started`, `iteration`, `complete`, `status`, and `init`. Targets must be a subset of `allowedNumbers`. Partial JSON writes are retried without discarding the previous valid state; watcher failures fall back to polling.

## Operations

- Run as a foreground service, scheduled task, or process manager under a dedicated account.
- `SIGINT` and `SIGTERM` stop the watcher, cancel owned AgentX children, and destroy the WhatsApp client once.
- Commands are serialized. Queue overflow, timeout, output overflow, spawn errors, nonzero exits, and CLI `[FAIL]` output are reported as failures.
- Keep `config.json`, `.wwebjs_auth/`, `.wwebjs_cache/`, and `node_modules/` untracked.

## Troubleshooting

- **Configuration error:** start from `config.example.json`; paths must exist and `cliRelativePath` cannot escape `repoPath`.
- **QR does not appear:** use a terminal that supports QR block rendering.
- **`pwsh` missing:** install PowerShell 7 or set `AGENTX_PWSH` to a compatible executable.
- **Session logged out:** stop the service, remove `.wwebjs_auth/`, and relink.
- **Mutation disabled:** enable only the named capability, restart, then use the nonce flow.
- **Loop iterate/complete rejected:** generate and submit evidence from the desktop AgentX session.
