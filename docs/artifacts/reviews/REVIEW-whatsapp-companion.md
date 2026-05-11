# Review: WhatsApp Companion

**Scope**: `companions/whatsapp/` (bot.js, commandRouter.js, agentxRunner.js, loopWatcher.js, transcribe.js, config.js, package.json, config.example.json, README.md)
**Date**: 2025-12-04
**Reviewer**: AgentX Auto
**Decision**: CHANGES REQUESTED (functional, but needs hardening before broad use)

---

## Summary

The WhatsApp companion is a working prototype that bridges WhatsApp Web (via `whatsapp-web.js`) to the local AgentX PowerShell CLI. Design is clean: command router -> `pwsh` subprocess -> stdout reply, plus a debounced loop-state watcher for push notifications. Core paths (text command, voice transcription, push) are coherent. The main risks are around the unofficial protocol library, lack of rate limiting / audit logging, and an over-broad `raw` passthrough.

## Strengths

- **Clear separation of concerns**: `config.js` (load), `commandRouter.js` (parse), `agentxRunner.js` (spawn), `loopWatcher.js` (push), `transcribe.js` (Whisper) -- each ~50-100 lines, single responsibility.
- **Allowlist by default**: `isAllowed()` silently drops messages from any number not in `allowedNumbers` (empty list = drop everything). Correct default.
- **Self-message loop avoidance**: `shouldProcessMessage()` distinguishes web-originated `fromMe` (ignore) from remote-device self-chat (accept). Subtle but correct.
- **No shell interpolation**: `runAgentX` uses `spawn(pwsh, [...args])` with array arguments, not `exec` -- safe from shell injection in the command path itself.
- **Output truncation**: `maxOutputChars` plus 3500-char WhatsApp chunking prevents reply failures on long output.
- **Local-only by design**: README explicitly states no inbound cloud bridge; session is local under `.wwebjs_auth/` and gitignored.
- **Whisper temp file cleanup**: `transcribe.js` unlinks the temp file in `finally`.

## Findings

### HIGH

1. **`raw` command bypasses the allowlist of CLI subcommands**. `commandRouter.js` case `'raw'` passes every remaining token directly to `agentx.ps1`. Even though `spawn` is array-based (no shell injection), an allowed user can invoke any CLI subcommand including ones with destructive side effects (e.g. `config set`, `issue close`, `loop complete`). Recommend gating `raw` behind a separate config flag (`allowRawPassthrough: false` default) or restricting to an explicit subcommand allowlist.

2. **Unofficial WhatsApp Web protocol risk**. `whatsapp-web.js` is reverse-engineered and not sanctioned by Meta. Account ban risk if behavior looks automated (high message volume, unusual hours). This is not documented in `README.md` and should be a prominent disclaimer.

3. **No rate limiting or replay protection**. A compromised allowed phone (SIM swap, stolen device) can fire `ship <issue>` or `raw config set ...` in a loop. Add a per-sender token bucket (e.g. 10 commands/minute) and reject duplicates within a short window.

### MEDIUM

4. **No audit log of executed commands**. `console.log` is the only record. For an agent that can mutate repo state, persist a JSONL log (`companions/whatsapp/audit.log` -- gitignored) with timestamp, sender, command, exit code. Required for incident review.

5. **`config.json` may contain secrets in plaintext**. `openaiApiKey` lives next to `allowedNumbers`. Reading the file is fine, but `.gitignore` coverage should be verified (the file isn't in the repo, but a fresh checkout doesn't ignore it by name today). Recommend explicit `.gitignore` entry: `companions/whatsapp/config.json`.

6. **`fs.watch` is platform-flaky**. On Windows it can miss events when an editor writes atomically (rename-over). Code already has a 5s poll fallback when `fs.watch` throws, but it won't trigger if watch succeeds yet silently misses events. Recommend running both watch and a 30s poll as belt-and-braces.

7. **Group-chat handling is implicit**. `isAllowed` checks `msg.from` against the allowlist. WhatsApp group JIDs end in `@g.us`, not `@c.us`. Current allowlist entries are personal numbers, so groups are effectively blocked, but this is incidental. Add an explicit guard: `if (msg.from.endsWith('@g.us')) return;`.

8. **`commandTimeoutMs` default of 10 minutes is generous**. Long enough that a stuck `pwsh` (e.g. interactive prompt) ties up the message slot. Add a clearer SIGKILL after SIGTERM + 5s grace.

### LOW

9. **Whisper voice notes leak into stdout logs**. `console.log` prints the full transcript. If the operator's terminal is shared or logged, voice content is exposed. Consider truncating logged transcripts to first 80 chars.

10. **Missing `cross-env` dependency** (now fixed in this review pass). `package.json` referenced `cross-env` in `start:debug` script but didn't declare it under `devDependencies`. Added.

11. **No tests**. `companions/whatsapp/` has zero unit tests. `commandRouter.tokenize()` and `loopWatcher.diffEvents()` are pure functions and would benefit from a small Node test runner suite.

12. **README does not mention auto-install integration**. The main `install.ps1` / `install.sh` do not offer to set up the WhatsApp companion. Either add a `-WhatsApp` switch that runs `npm install` in the companions folder, or state explicitly in the README that setup is fully manual.

13. **Help text out of date when commands are added to the CLI**. `helpText()` in `commandRouter.js` is hand-maintained. Consider deriving from the agentx CLI's own help output, or add a CI check that flags drift.

## Security Posture (Summary)

| Surface | Status | Notes |
|---|---|---|
| Shell injection | OK | `spawn` with array args; no string interpolation |
| Command authorization | PARTIAL | Allowlist works; `raw` is too permissive |
| Rate limiting | MISSING | None today |
| Audit log | MISSING | Only console output |
| Secret handling | PARTIAL | API key in plaintext file; gitignore should be tightened |
| TOS / account risk | UNDOCUMENTED | Unofficial protocol library not disclosed in README |

## Recommended Actions (priority order)

1. Gate `raw` behind `allowRawPassthrough` config flag, default `false`.
2. Add explicit TOS / account-ban disclaimer to `companions/whatsapp/README.md`.
3. Add per-sender rate limit (10 cmds/min) in `commandRouter.js` or upstream in `bot.js`.
4. Persist audit log to `companions/whatsapp/audit.log` (gitignored).
5. Add `companions/whatsapp/config.json` to root `.gitignore`.
6. Add explicit group-chat guard in `bot.js::isAllowed`.
7. Add minimal unit tests for `tokenize`, `diffEvents`, `isAllowed`.

## Files Reviewed

- `companions/whatsapp/src/bot.js` (~140 lines) -- entry point, message dispatch
- `companions/whatsapp/src/commandRouter.js` (~95 lines) -- text -> CLI args
- `companions/whatsapp/src/agentxRunner.js` (~60 lines) -- pwsh subprocess
- `companions/whatsapp/src/loopWatcher.js` (~100 lines) -- fs.watch + diff
- `companions/whatsapp/src/transcribe.js` (~50 lines) -- Whisper API
- `companions/whatsapp/src/config.js` (~45 lines) -- config load
- `companions/whatsapp/package.json` -- deps (cross-env added in this pass)
- `companions/whatsapp/config.example.json` -- default schema
- `companions/whatsapp/README.md` -- user docs
