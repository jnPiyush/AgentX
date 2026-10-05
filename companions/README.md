---
title: Frontier companion integration
description: Integrate optional WhatsApp, Microsoft Teams and GitHub App transports with the native Frontier runtime.
---

## Choose a companion

| Companion | Transport and setup |
| --- | --- |
| [WhatsApp](whatsapp/README.md) | Local WhatsApp Web client, allowlisted phone numbers and optional transcription |
| [Teams and GitHub App](collaboration/README.md) | Authenticated HTTP endpoints, allowlisted users/conversations and durable jobs |

Both use the native Frontier CLI for work. They are optional services, not
automatically installed or paired by the VS Code extension. Keep the repository
layout when deploying: collaboration imports the shared runner and guided
protocol from the WhatsApp source directory, but does not need a WhatsApp
account, Chromium or the WhatsApp npm dependencies.

## Local integration checklist

1. Use a dedicated OS account and repository-managed workspace. Initialize
   repository support and authenticate a supported native LLM provider as that
   same account. The CLI must support guided JSON results, `--session-info`,
   `--input-id`, and plan-version/digest response arguments.
2. Install each selected companion's declared dependencies in its own directory.
   Configure only the channels you intend to use from its example file. Keep
   credentials outside source control and chat.
3. Start with remote execution disabled. Verify `status` or other permitted
   read-only commands and check that unauthorized identities cannot execute.
   An HTTP health response verifies only the listener, not provider connectivity.
4. Prepare the local task's quality loop. Enable only the required execution
   capability. Request a run, confirm startup, review the returned question or
   full native plan, then submit a separately confirmed response.
5. Verify owner isolation, expired/duplicate confirmations, stale-plan rejection,
   running/final updates and restart behavior before broader use.

Use one writer service per checkout; separate services and desktop agents do not
share a global execution queue. Use separate worktrees for concurrent writers.
Task confirmation is not plan approval. Neither companion can manufacture local
review evidence or waive quality-loop, test or delivery gates.

## Offline validation

From the repository root, the companion suites use injected provider/runtime
boundaries and local HTTP endpoints:

```powershell
node --test companions\whatsapp\test\*.test.js companions\collaboration\test\*.test.js
npm --prefix companions\whatsapp audit --omit=dev --omit=optional
npm --prefix companions\collaboration audit --omit=dev
```

Follow the repository's post-loop consent policy for agent-run suites. The native
contract case inspects a locally generated session without invoking an LLM.
Offline validation is not a live account or production-readiness certification.

## Live prerequisites and remaining qualification

- WhatsApp requires explicit QR pairing and an installed supported browser.
  It uses the unofficial WhatsApp Web surface, not the Business API.
- Teams requires your bot registration, tenant authorization, app package,
  allowlisted conversation and an HTTPS endpoint. A valid JWT exchange and
  proactive send must be verified with your actual registration.
- GitHub requires your App, repository installation, private key, webhook secret,
  allowed users and HTTPS webhook. Installation-token calls must be verified
  against that installation.
- Source fixes do not update an older installed extension/runtime automatically.
  Update the actual runtime used by the companion before validating its behavior.

No app registration, pairing, tunnel, cloud deployment or real message is created
by these instructions alone. Use each companion's guide for configuration,
recovery and retention details.
