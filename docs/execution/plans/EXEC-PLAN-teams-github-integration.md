---
title: Teams and GitHub App Integration
description: Implementation and verification plan for authenticated Frontier progress and instruction channels.
---

## Purpose / Big Picture

Allow authorized Teams users and GitHub collaborators to inspect progress and
submit instructions to the existing local agent runtime. Keep the unfinished
Frontier rebrand outside this task. No cloud deployment or tenant registration
is performed by this change.

## Alternatives Considered

1. Extend the WhatsApp bot with more transport dependencies. Rejected: this
   couples unrelated authentication and deployment lifecycles.
2. Add GitHub Actions workflows and Teams outgoing webhooks only. Rejected:
   one-way notifications do not support authenticated follow-up instructions.
3. Add a collaboration companion sharing the existing shell-free CLI runner.
   Selected: isolates the HTTP trust boundary and preserves local runtime gates.

## Decision Log

* One service controls one configured workspace and serializes agent runs.
* GitHub uses installation tokens and signed issue-comment webhooks. Teams uses
  the Microsoft 365 Agents SDK JWT validation and tenant/user allowlists.
* Mutations require sender- and conversation-bound confirmation. Remote quality
  gate approval, arbitrary shell commands and repository selection are forbidden.
* Follow-up instructions are queued agent turns, not live interruption. Progress
  contains bounded status metadata, never raw local logs or credentials.
* Tests use injected transport/runtime doubles. Live delivery requires configured
  app registrations, installation permissions and a reachable HTTPS endpoint.

## Progress

* [x] Identify the companion runner and authorization patterns
* [x] Start the integration quality loop
* [x] Implement durable command queue and progress
* [x] Add GitHub App and Teams transports
* [x] Verify authentication, isolation, replay handling and failure states
* [x] Document setup and live verification requirements
* [x] Independent review and learning capture
* [x] Quality-loop closeout

## Context and Orientation

Implementation lives under `companions/collaboration/`. The existing
`companions/whatsapp/src/frontierRunner.js` supplies shell-free execution,
timeouts, bounded output and process-tree termination. Existing source and
generated rebrand changes remain untouched unless a shared runner change is
strictly necessary and covered by its existing tests.

## Plan of Work

Build the local service and fake-runtime tests, add authenticated transports,
exercise actual HTTP routing with signed payloads, then document registration,
permissions, operation, shutdown and recovery.

## Concrete Steps

* `npm --prefix companions/collaboration test`
* `npm --prefix companions/collaboration run test:coverage`
* `npm --prefix companions/collaboration run audit:runtime`
* Run scoped scrub, independent review and the five-pass security quality loop.

## Validation and Acceptance

* Unauthorized messages cannot inspect progress or enqueue work.
* Duplicate deliveries do not start duplicate runs.
* Follow-up instructions remain bound to the authorized conversation.
* Progress reports distinguish queued, running, succeeded, failed and interrupted.
* Only one mutation executes at a time; restart never silently replays work.
* Provider failures and shutdown preserve durable status without secret leakage.
* SDK authentication is active; a missing credential is a startup error.

## Idempotence and Recovery

Persist delivery IDs and job metadata through atomic file replacement. Pending
confirmations expire. After restart, unfinished runs are marked interrupted and
require a fresh explicit request. Run one process per workspace. Do not overwrite
or reset a local quality loop on behalf of remote messages.

## Artifacts and Notes

Evidence: `build/release-9.3.0-collaboration.log` records the release rerun of
29/29 tests with 93.35% line coverage. This supplements the original delivery
results below; live provider setup remains unverified.

No prior rebrand test evidence is reused for this task. Live Teams/GitHub delivery
is unverified until apps are registered and connected by an operator.

## Outcomes & Retrospective

The companion implements GitHub App issue-comment commands and authenticated
Teams bot messages using pinned official SDKs. Remote execution is off by default.
Actor/conversation-scoped jobs, transactional persistence, replay protection,
confirmation expiry, heartbeat locks, provider timeouts and shutdown behavior
have offline regression coverage. The existing WhatsApp runner is reused without
modification and its 23-test suite passes.

Independent functional reviews identified ownership, replay, persistence, lock
and shutdown gaps; the implementation and regression tests now address them.
Final scope-bound review is approved; the rubric validator passed at 94/100 with
zero HIGH or MEDIUM findings. The final suite passes 29/29 tests with 93.84 percent
line, 89.52 percent branch and 91.21 percent function coverage. Dependency audit
and scoped scrub report zero findings. The five-iteration quality loop completed
successfully and `loop status` confirmed the completion gate is satisfied. Live Teams token
exchange/proactive delivery and GitHub installation-token delivery require
operator credentials; no deployment or tenant mutation was performed.

## Surprises & Discoveries

* Public npm TLS negotiation failed on this host. The configured registry worked;
  generated resolved URLs were removed to avoid private-feed lockfile coupling.
  A clean `npm ci --ignore-scripts` succeeded with unchanged integrity hashes.
* Express 5 passes bind errors to the listen callback. The server now waits for
  the `listening` event and rejects `error`, proven with an occupied-port test.
* SDK ConnectorClient exposes an HTTP client accepting AbortSignal and timeout;
  the Teams adapter sets both and the server forcibly closes stalled inbound
  connections after its shutdown deadline.