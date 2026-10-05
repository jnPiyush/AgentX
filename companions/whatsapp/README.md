# Frontier WhatsApp Companion

Control a local Frontier workspace from an allowlisted WhatsApp account. The companion uses the unofficial `whatsapp-web.js` automation surface and a local headless Chromium session. Frontier command execution remains on the desktop; optional voice transcription sends audio to OpenAI when `OPENAI_API_KEY` is configured.

## Security Model

The companion is read-only by default.

- Only normalized allowlisted phone numbers are accepted.
- Native-device self-chat commands are received through `message_create`; linked-web replies are ignored.
- Message IDs are replay-protected so one WhatsApp event runs at most once.
- `ready`, `state`, `status`, `deps`, and `workflow` are enabled by default.
- `ship`, `run`/`ask`, `loop start`, and `raw` require an explicit capability plus a short-lived, sender-bound, single-use confirmation nonce.
- Remote `loop iterate` and `loop complete` are disabled because current Frontier requires fresh local evidence.
- Voice notes are transcript-only by default. A mutation is never authorized by voice.
- Chromium sandboxing stays enabled; do not add `--no-sandbox` on a workstation.
- Frontier children receive a secret-redacted environment, run serially, and have timeout/output limits.
- Opaque WhatsApp LIDs must resolve to an allowlisted phone through the client;
  group and unresolved identities never authorize commands.

Use a dedicated OS account and, ideally, a dedicated WhatsApp account. Protect `.wwebjs_auth/` as a credential. This is not a WhatsApp Business API integration and can break when WhatsApp Web changes.

## Prerequisites

- Node.js 22.12+ (required by the pinned Puppeteer version)
- PowerShell 7.4+ (`pwsh`) on PATH
- Current Frontier CLI with guided JSON, session inspection and response support
  at `.frontier/runtime/frontier.ps1`
- A supported local Chrome/Chromium installed by Puppeteer or selected via `browser.executablePath`

Use explicit **Initialize Repository Support** for a consumer checkout. These
desktop services use repository-managed runtime/state, not an inferred VS Code
private profile. Prepare the task's quality loop on the desktop before expecting
remote code changes; remote confirmation does not complete or waive that loop.

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

Companion environment overrides use `FRONTIER_WA_ALLOWED`, `FRONTIER_REPO` and
`FRONTIER_PWSH`. AgentX/HVE aliases are ignored.

For voice transcription, set the secret only in the service environment:

```powershell
$env:OPENAI_API_KEY = Read-Host 'OpenAI API key' -MaskInput
```

`openaiApiKey` in `config.json` is rejected.

For a native LLM provider that reads credentials from environment variables,
explicitly list the required variable names in `runtimeEnv`, for example
`["OPENAI_API_KEY", "FRONTIER_LLM_PROVIDER", "FRONTIER_OPENAI_MODEL"]`. Inject their
values into the service environment; never put credential values in JSON or chat.
Only supported LLM credential/provider names are accepted. Bot/App credentials,
private-state overrides and gate-bypass variables cannot be forwarded.
The default is an empty list. A configured text-only Claude Code bridge is not
a substitute for a native provider supporting guided tools.

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

### Confirmed capabilities

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
Bot: <Frontier output>
```

The nonce expires after `confirmationTtlMs`, is bound to the sender, and works once.
`raw` is limited to the validated read-only commands, `loop status`, `version`
and `help`, and still requires its capability and confirmation. It cannot start
sprints/watchers, change configuration, run agents or submit approvals.

### Guided tasks and plan approval

`run` and `ask` invoke the native guided JSON contract. Confirming the initial
command starts discovery; it does not approve the plan generated later. Pending
questions and full plans are returned to the owning sender, including the native
session identifier.

```text
You: run engineer "Add the health endpoint"
Bot: Confirmation required ... Reply: confirm A1B2C3
You: confirm A1B2C3
Bot: Awaiting your input. Plan v1 ... respond engineer-<session> approve
You: respond engineer-<session> approve
Bot: Confirmation required ... Reply: confirm D4E5F6
You: confirm D4E5F6
```

Responses use `respond <session> answer <text>`, `approve`, `revise <feedback>`,
or `cancel`. They need a fresh sender-bound confirmation. Immediately before
submission the companion reads the current native request; stale input IDs or
plan digests cause it to show the new request without applying the old response.
Another allowlisted sender cannot respond to your session.

The running WhatsApp companion keeps at most 20 pending owner/session mappings.
They are not restored after a restart or eviction: inspect and resume those
sessions from the trusted desktop instead of supplying an arbitrary session ID.
Native history remains durable. Teams/GitHub job persistence is separate.
Raw commands use an allowlist, not a list of known execution aliases. Use the
owned guided commands for execution and keep evidence operations local.

`maxRuntimeOutputChars` bounds structured native output separately from
`maxOutputChars`, which still bounds ordinary command output and displayed final
answers. Plans are chunked rather than silently truncated. Stdout and stderr
remain separate so diagnostics cannot corrupt the native JSON record.

## Voice Notes

Supported MIME types: OGG/Opus, MPEG, MP4/M4A, and WebM. Audio is size-limited and transcription has an abort timeout. Provider error bodies and transcripts are not logged.

- `voiceAutoExecuteReadOnly: false` (default): always reply with transcript only.
- `voiceAutoExecuteReadOnly: true`: execute only commands classified read-only.
- Mutating transcriptions always require the operator to send the command as text and then confirm its nonce.

## Push Notifications

The companion watches `.frontier/state/loop-state.json` and can notify allowlisted targets for `started`, `iteration`, `complete`, `status`, and `init`. Targets must be a subset of `allowedNumbers`. Partial JSON writes are retried without discarding the previous valid state; watcher failures fall back to polling.

Only `.frontier/state/loop-state.json` is read; legacy `.agentx` and `.hve` state is
ignored. Polling detects a newly created state file. Malformed JSON is retried
and never reported as progress.

## Operations

- Run as a foreground service, scheduled task, or process manager under a dedicated account.
- Use one writer service per checkout. WhatsApp, the collaboration companion and
  a desktop agent do not share one execution queue; use separate worktrees when
  they may edit concurrently.
- `SIGINT` and `SIGTERM` stop the watcher, cancel owned Frontier children, and destroy the WhatsApp client once.
- Commands are serialized. Queue overflow, timeout, output overflow, spawn errors, nonzero exits, and CLI `[FAIL]` output are reported as failures.
- The queue waits for child closure and process-tree termination after cancellation. If termination cannot be confirmed within eight seconds, it reports failure and blocks subsequent writers. Confirm the process tree has stopped before restarting the service; shell exit alone is insufficient.
- Keep `config.json`, `.wwebjs_auth/`, `.wwebjs_cache/`, and `node_modules/` untracked.

## Troubleshooting

- **Configuration error:** start from `config.example.json`; paths must exist and `cliRelativePath` cannot escape `repoPath`.
- **QR does not appear:** use a terminal that supports QR block rendering.
- **`pwsh` missing:** install PowerShell 7.4+ or set `FRONTIER_PWSH` to a compatible executable.
- **Session logged out:** stop the service, remove `.wwebjs_auth/`, and relink.
- **Mutation disabled:** enable only the named capability, restart, then use the nonce flow.
- **Loop iterate/complete rejected:** generate and submit evidence from the desktop Frontier session.
