---
title: Integrate remote companions with Frontier guided execution
description: Validate WhatsApp, Teams and GitHub App transport-to-runtime behavior without live account changes or bypassing plan approval.
---

## Contract and baseline

Issue #411. The user requested validation, fixes, integration and tests for the
optional WhatsApp and Microsoft Teams/GitHub App companions. Live WhatsApp pairing,
tenant registration, GitHub App installation, tunnels and real messages are not
authorized by this implementation task. Use local transports and injected
providers for validation.

The separate pre-edit baseline ran the seven existing companion test files:
62 tests passed, with no failures or skips. Those tests do not prove current
guided-runtime interoperability: the shared runner treats exit 2 as a failure,
and neither companion currently exposes a bound response to a native question
or plan. The approved feature-inventory documents remain unrelated pending edits.

## Alternatives and selected approach

- Rejected: append `--interaction autonomous` after the companion's confirmation.
  Confirming a task is not approval of a subsequently generated native plan.
- Rejected: a second agent engine or provider SDK in each companion. The existing
  Frontier CLI already owns session identity, plan digests and mutation gating.
- Selected: preserve read-only defaults and nonce confirmation; add a shared
  companion protocol adapter over native JSON start/inspect/resume operations.
  A remote response is bound to the displayed native request and rechecked
  immediately before submission. Changed requests are displayed again instead
  of receiving stale approval.

## Interfaces and ownership

| Surface | Work |
| --- | --- |
| Shared child runner | Separate stdout/stderr, bounded structured output, noninteractive-human mode, explicit LLM environment allowlist, reliable spawn/termination errors |
| Shared companion protocol adapter | Validate native pending records; render plans/questions; build start and response arguments; compare current request identity |
| WhatsApp | Bind pending sessions to the allowed sender; confirmed `respond <session> <answer/approve/revise/cancel> [text]`; reject control-surface escape through raw commands |
| Collaboration runtime | Start/inspect/resume using the shared adapter and emit recognized progress metadata only |
| Collaboration service | Persist awaiting-input state on owned jobs; confirmed `respond <job> <answer/approve/revise/cancel> [text]`; preserve pending requests across restart without replay |
| Collaboration server | Await runtime shutdown, surface teardown failures and support injected GitHub transport for local integration |
| Configuration and docs | Keep remote execution disabled by default; explain provider environment opt-in, repository support and live-service prerequisites |

WhatsApp response ownership is maintained by the running companion; after a
restart an unrecognized session must be resumed from the trusted desktop rather
than guessed from a user-supplied session ID. Native session history remains
durable. Teams/GitHub jobs already have durable owner/conversation storage.
Confirmations remain single-use, short-lived and cleared on restart.

## Acceptance and verification

1. Existing read-only commands, sender/conversation allowlists, webhook signature
   checks and Teams authentication remain intact.
2. A confirmed task that returns a question or plan is shown as awaiting input,
   not completed or failed. Plan details are available to the owning user.
3. Only that owner may respond. Responses require confirmation and the current
   native request identity. Stale, malformed and cross-session records fail closed.
4. No task confirmation implicitly approves a plan or starts autonomous mode.
   Remote loop completion/review evidence submission remains unavailable.
5. Channel credentials never reach runtime children. Only explicitly selected
   supported LLM environment variables may be forwarded.
6. Child spawn errors and shutdown failures are visible; queued writers never
   proceed after unconfirmed termination.
7. Regression cases cover guided start/response, stale-plan handling, ownership,
   replay, shutdown, actual local HTTP middleware and the shared runner contract.
8. Non-test checks and bounded operational evidence precede independent review.
   Suites run only in a separate approved verification phase outside the loop.

## Delivery boundary

No source commits, deployments or account changes are requested. A passing
offline integration result does not certify WhatsApp Web stability, valid Teams
JWT/proactive delivery or an actual GitHub installation token exchange.
