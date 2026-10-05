---
title: Guided interaction
description: The shared inspect, clarify, plan, approve and report contract for Frontier tasks.
---

User-facing Frontier tasks follow the shared guided contract: inspect relevant
context, clarify consequential uncertainty, propose a high-level plan, obtain
approval, and report milestone outcomes. Clear requests need no artificial
question; direct informational answers need no execution plan. Delegates reuse
the parent's scope and report uncertainty to that parent.

Native `frontier run` defaults to guided execution. It allows bounded read-only
discovery before approval and exposes `request_user_input`, `propose_plan` and
`report_progress`. The runtime assigns plan versions, milestone IDs and hashes.
A proposal or question suspends the run with exit 2 and durable pending state.
Later tool calls in the same batch are declined, not replayed.
Invoking `run` starts a task, so a plain final reply cannot bypass its plan.
The informational-answer exception applies to direct host conversations, not
to an implicit change of mode inside a native task.

The native run exit contract is:

| Exit | Meaning |
| --- | --- |
| 0 | Execution finished; independent review and test gates are not implied |
| 1 | Error, incomplete work or failed verification |
| 2 | Existing session awaits user input |
| 3 | Candidate awaits owner review or verification |
| 4 | Task cancelled; history preserved |

Use your initialized workspace's `.frontier/runtime/frontier.ps1` launcher for
the commands below (`frontier` denotes that launcher):

```powershell
frontier run engineer "Implement the agreed fixture change"
frontier run --session-info '<session-id>' --json
frontier run --resume-session '<session-id>' --input-id '<input-id>' --input-decision approve --plan-version 1 --plan-digest '<sha256>'
frontier run --resume-session '<session-id>' --input-id '<input-id>' --input-decision revise --plan-version 1 --plan-digest '<sha256>' --clarification-response "Keep the existing API"
frontier run --resume-session '<session-id>' --input-id '<input-id>' --input-decision answer --clarification-response "Use the existing API"
frontier run --resume-session '<session-id>' --input-id '<input-id>' --input-decision cancel
```

Copy IDs and hashes from the current pending record, not an earlier plan.
Approval with edits is rejected: revise first, then approve the new version.
Answering a question, dismissing a dialog, timeout, or silence never approves.
Consequential new questions during guided execution remove the old approval;
required action-specific consent is kept separate.

Session state is workspace/role/engine/provider/model/permission-bound, locked
while running, and atomically saved. Native file tools cannot edit it. A stale,
corrupt or cross-workspace record fails explicitly. To resume an interrupted,
already-authorized run, inspect its status and effects first, then use
`--input-decision continue` with the current plan version and hash, without an
input ID. Missing tool results are marked unknown, never automatically replayed.
A completed or cancelled run cannot consume the same approval again. An
interrupted session without pending input can also be cancelled with
`--input-decision cancel` and its current plan version/hash instead of an input ID.
Once a plan is recorded, model-availability failures do not transfer its
authorization to a fallback model. Cancel and create a new scoped task instead.
Existing configured model fallbacks remain available before a plan is recorded.
The original per-run iteration and reported-token budgets survive resume;
omitting `--max` does not reset a smaller limit to 30. These are per invocation,
not a cumulative price guarantee. Unreported token usage remains unknown.
Stored sessions are limited to 32 MB on both save and read. An oversized save
fails explicitly and leaves the previous checkpoint intact.

For an explicitly preauthorized bounded task, use
`frontier run engineer "Approved scope" --interaction autonomous`. This records
caller authorization, not a user-approved plan. Required questions still pause.
`watch --execute` and `sprint` pause on pending input; their explicit
`--autonomous` option supplies preauthorization. This does not add an
`--autonomous` flag to the separate artifact-driven `ship` script.
Neither mode waives role permissions, budgets, quality review or test consent.

| Surface | Interaction support |
| --- | --- |
| Native Copilot/direct API runner | Enforced plan state, guarded writes, durable input and progress |
| Frontier VS Code chat | Full plan display, explicit approval/revision/cancel replies, stale-input checks and streamed milestones |
| MCP `frontier_run` / `frontier_resume` | Genuine client form elicitation when supported; otherwise durable pending state and trusted CLI continuation |
| Direct Copilot/Claude/Cursor role invocation | Shared conversational guidance; no claim that Frontier enforces approval on host-owned tools |
| Native Claude Code bridge | Text-only; guided tool execution is unavailable, and no provider fallback is attempted |
| HydraFusion candidates | Explicit bounded automation authorization required; native guided plan transfer is not supported |

MCP clients must implement form elicitation to collect decisions. Form acceptance
alone is insufficient; the user must explicitly approve the displayed plan.
Milestones stream over MCP progress notifications when the client requests them.
Host confirmation is trusted as client input, not cryptographic proof of a human.

Milestone evidence is agent-reported and labeled accordingly. Runtime approval
does not prove semantic adherence to a free-text scope; role path guards and
independent review still apply. Execution completion does not close the owner
quality loop, grant review approval, or claim that deferred suites passed.
New runtime/session behavior requires updated installed assets; this source
change does not update an already installed extension automatically.
