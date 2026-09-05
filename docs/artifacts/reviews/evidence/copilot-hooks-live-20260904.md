# Evidence: Copilot CLI lifecycle hooks fire end to end

**Date**: 2026-09-04
**Host**: GitHub Copilot CLI 1.0.83 (Windows, PowerShell 7)
**Workspace**: AgentX repository worktree
**Relates to**: REVIEW-copilot-host-compatibility-20260904 finding H2

## Why this evidence exists

The audit found that `.github/hooks/copilot-hooks.json` used retired namespaced
event names and a `command` + `args` shape, and that `signal-capture.js` read
`COPILOT_HOOK_*` environment variables. A live session produced no signal file,
so the hooks were inert.

Registration keys are matched by the **host**, not by AgentX code, so no unit
test can prove the key names are correct. This transcript is the proof.

## Independent confirmation of the schema

Copilot CLI 1.0.83 loads an enterprise policy hook from
`HKLM\Software\Policies\GitHub\Copilot\Defender`. That policy is authored by the
host vendor and uses exactly the shape AgentX now emits:

```json
{"version":1,"hooks":{"sessionStart":[{"powershell":"...","timeoutSec":12,"type":"command"}],
"UserPromptSubmit":[...],"preToolUse":[...],"postToolUse":[...],"agentStop":[...]}}
```

This is the source of the mixed casing AgentX mirrors: `UserPromptSubmit` is
PascalCase while `sessionStart`, `preToolUse`, `postToolUse` and `agentStop` are
camelCase. AgentX matches the vendor policy verbatim.

## Precondition discovered

Repository hooks only load when the workspace folder is **trusted** by the CLI
(`trustedFolders` in `~/.copilot/config.json`). This is why the original audit
smoke test produced no signal file even after the schema was corrected. It is a
host security control, not an AgentX defect.

## Transcript

Command:

```
copilot -p "Run a shell command to print the current directory name, then reply DONE" --allow-all-tools --no-color
```

Resulting `.agentx/signals/sessions.jsonl` (event and tool columns):

```
UserPromptSubmit   tool=
sessionStart       tool=
preToolUse         tool=powershell
postToolUse        tool=powershell
```

All four registered events fired, each was attributed to the correct event name,
and both tool-use events captured the tool name.

## Payload shape finding

The raw `postToolUse` payload delivered on stdin contains **no event-name
field**:

```json
{"sessionId":"3b3a530b-...","timestamp":1788558899745,"cwd":"...",
 "toolName":"powershell","toolArgs":{"command":"Get-ChildItem -Name"},
 "toolResult":{"resultType":"success","textResultForLlm":"..."}}
```

Because of this, `copilot-hooks.json` passes the event name to the handler as
the first argument (`signal-capture.js <eventName>`), and the handler treats that
argument as the highest-precedence source. `tests/copilot-host-compatibility-behavior.ps1`
asserts every hook entry carries its event-name argument.

## Environment restoration

The workspace was added to `trustedFolders` only for this verification and the
original `~/.copilot/config.json` was restored afterwards. The generated
`.agentx/signals/` directory was removed.
