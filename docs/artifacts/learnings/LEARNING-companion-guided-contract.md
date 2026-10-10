---
title: Remote task confirmation must not substitute for native plan approval
description: Preserve session identity, sender ownership and lifecycle evidence when integrating external chat transports.
---

## Context

Issue #411 requested validation and integration of the optional WhatsApp and
Teams/GitHub companions. The existing offline suites passed before edits, but
their mocked runtime results did not exercise the current native pending-input
contract. See the [integration plan](../../execution/plans/EXEC-PLAN-companion-integration.md)
and [companion guide](../../../companions/README.md).

## Reusable guidance

- Distinguish a confirmed task start from approval of the plan generated later.
  Preserve guided mode and bind every response to the exact native input ID,
  plan version and digest.
- Restrict raw adapters with a positive command allowlist. Blocking only known
  execution names misses aliases such as autonomous sprint/watch dispatch.
- Separate successful metadata retrieval from successful task execution.
  Lifecycle inspection must not mark an unfinished or cancelled task successful;
  keep unresolved jobs nonterminal and provide a read-only reconciliation path.
- Inspect the current native request immediately before submitting a response.
  Stale requests must be displayed again, never silently approved.
- Keep ownership in the transport's authenticated sender/conversation scope.
  A user-provided session or job ID is not authority to act on it.
- Preserve stdout separately from stderr and decode UTF-8 across process chunks.
  A diagnostic mixed into the final JSON stream can break otherwise correct
  interoperability.
- Forward only explicitly selected native-provider environment names. Channel
  credentials and gate/private-state overrides must not enter child processes.
- Await teardown failures. Releasing a writer lock before confirming termination
  can admit a second writer while the first is still active.
- Validate a real native session record in addition to mocks. Fixtures need the
  native metadata identity and conversation shape, not an invented minimal object.
- Separate offline HTTP/HMAC/JWT-rejection evidence from actual account pairing,
  valid-token exchange and production delivery qualification.
