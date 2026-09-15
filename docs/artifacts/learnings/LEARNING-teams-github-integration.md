---
title: Authenticated Collaboration Channels
description: Verified patterns for remote agent instructions, durable progress and shutdown-safe execution.
confidence: 0.7
observations: 2
status: curated
category: security
---

## Context

Teams and GitHub App messages now control one configured local Frontier workspace
through a standalone companion. Both transports reuse the existing shell-free
runner and cannot approve local quality gates.

## Learning

* Authentication is only the first boundary. Bind confirmations, replay keys,
  job lookup and follow-up instructions to the provider scope and actor.
* Persist a cloned transaction before exposing acceptance in memory. A failed
  disk write must not consume a confirmation or leave a phantom queued job.
* Render current job state on delivery retries. A cached acceptance string can
  report queued after the job has already finished.
* Check stopping state after awaited notification delivery and immediately before
  starting execution. Otherwise shutdown can stop an empty runner, then the
  suspended job resumes and starts a new process after shutdown.
* Bound the SDK transport, not only the caller's promise. Stop active execution
  when heartbeat-lock ownership is lost and never write or unlock afterward.

## Evidence

The [integration tests](../../../companions/collaboration/test/service.test.js)
exercise transactional write failure, replay, actor isolation and lock compromise.
The [transport tests](../../../companions/collaboration/test/transports.test.js)
exercise actual HTTP HMAC verification, missing Teams JWT rejection, connector
deadlines and the independently reproduced shutdown race. The final focused
suite passed 29 tests with 93.84 percent line coverage; the reused runner's
23-test suite also passed. Independent review found the race, re-ran the exact
regression after repair, and approved the final eight-file implementation scope.

## Why It Matters

Messaging retries and async progress publication create lifecycle edges that
happy-path command tests do not detect. These tests apply to any companion that
accepts remote instructions and launches local agent work.

## Promotion Path

Confirm the patterns in another adapter and in the operator's live provider
smoke test before promoting them to a shared runtime abstraction. Live Teams
valid-JWT/proactive delivery and GitHub installation-token delivery remain
operator-gated; this capture does not claim they ran.

## Related

* [Companion setup](../../../companions/collaboration/README.md)
* [Execution plan](../../execution/plans/EXEC-PLAN-teams-github-integration.md)