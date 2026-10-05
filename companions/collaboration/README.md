---
title: Frontier Teams and GitHub App Companion
description: Configure authenticated agent progress and instructions from Microsoft Teams and GitHub App issue comments.
---

## Capabilities

The companion connects one local Frontier workspace to Teams and a GitHub App.
Authorized users can start a confirmed guided agent turn, see queued/running/
awaiting-input/final status, and respond to native questions or plans. Progress updates return to the
originating Teams conversation or GitHub issue/PR discussion every 30 seconds
while work runs, when input is needed, and on completion.

Instructions are subsequent agent turns, not interruption of a live VS Code
Copilot turn. A follow-up includes the earlier instructions and current workspace
files, not the complete model transcript. Job success means the CLI turn finished,
not that the independent quality review or release gate passed.
An initial task confirmation starts native guided planning. It does not approve
a generated plan or select autonomous execution.

## Prerequisites

* Node.js 22.10+ and PowerShell 7 on the workspace host
* A working local Frontier CLI and an already authenticated supported LLM provider
* A GitHub App installation and/or a single-tenant Teams bot registration
* A publicly reachable HTTPS endpoint forwarding to the companion
* A dedicated workspace and OS account for remote agent execution

Do not expose an unrestricted personal checkout or rely on this companion as an
OS sandbox. Allowlisted users can instruct the existing agent to modify workspace
files within its existing controls. App credentials are not forwarded to the
child process environment, but the process still runs under the same OS identity.
Use a separate secret store/account boundary when stronger isolation is needed.

## Start Locally

Run from this directory:

```powershell
npm ci --ignore-scripts
node --env-file=.env src/server.js
```

Use [.env.example](.env.example) as the configuration reference. Keep real secrets
in an ignored `.env` file or injected environment variables. Set
`FRONTIER_CHANNELS=github`, `teams`, or `teams,github`. Disabled channels require
no credentials. `FRONTIER_WORKSPACE_ROOT` must name the target checkout and
`FRONTIER_CLI_PATH` must resolve to an executable script inside it.
The default path requires portable repository runtime support; an extension's
private runtime outside the checkout is not resolved by this companion.

The runtime child receives a restricted environment. `FRONTIER_RUNTIME_ENV`
defaults to an empty list. To opt in, list supported LLM variable names separated
by commas, for example `FRONTIER_LLM_PROVIDER,OPENAI_API_KEY`, and supply their
values in the host environment or ignored `.env` file. The runtime configuration
stores only those names, not their values. Unknown names fail configuration
validation. Teams app secrets, GitHub App private keys and webhook secrets are
not supported runtime variables.

| Purpose | Supported names |
|---------|-----------------|
| Provider selection | `FRONTIER_LLM_PROVIDER` |
| GitHub/Copilot provider | `GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_PAT`, `COPILOT_GITHUB_TOKEN` |
| OpenAI-compatible provider | `OPENAI_API_KEY`, `FRONTIER_OPENAI_API_KEY`, `FRONTIER_OPENAI_BASE_URL`, `FRONTIER_OPENAI_MODEL` |
| Anthropic provider | `ANTHROPIC_API_KEY`, `FRONTIER_ANTHROPIC_API_KEY`, `FRONTIER_ANTHROPIC_BASE_URL`, `FRONTIER_ANTHROPIC_MODEL` |

Channel credentials stay in the companion process and are excluded from the
runner configuration. The default output bound remains 256000 characters,
including structured native session JSON.

The service binds to `127.0.0.1:3978` by default. `/healthz` reports process health
only. Expose the two POST endpoints through an authenticated-provider-aware HTTPS
reverse proxy; do not expose local files. No tunnel, cloud resource, app
registration, or GitHub installation is created automatically.

## GitHub App

1. Register a private GitHub App using [github-app-manifest.json](github-app-manifest.json)
   as the permission/event reference. Replace its webhook host with your HTTPS
   endpoint. Manifest registration itself uses GitHub's manifest-conversion flow;
   the JSON is not an API token or an installed app.
2. Enable the `issue_comment` event. Grant Metadata read, Issues write, and Pull
   requests write for comments on PR discussions. Do not grant Contents write,
   Actions write, or administration permissions.
3. Install it only on the target repository. Configure the app ID, installation
   ID, repository, private-key file, and a random webhook secret of 32+ characters.
   Configure `FRONTIER_GITHUB_USERS` with comma-separated numeric GitHub account
   IDs, not display names or logins.
4. Set the webhook to `https://<host>/api/github/webhooks`, JSON payloads, and the
   same webhook secret. TLS verification must remain enabled.
5. In an issue or PR discussion comment, send `/frontier status` or
   `/frontier run engineer Fix the failing tests`.

Every command also checks the sender's current repository permission through the
installation token. Only write/maintain/admin collaborators on the configured
repository and installation are accepted. Bots, edited comments and inline PR
review comments do not execute commands. Remove a user ID or app installation to
revoke access. Messages older than 24 hours require a fresh comment.

## Teams Bot

1. Register a single-tenant bot application and enable the Microsoft Teams
   channel using your organization's supported bot registration process. Set its
   messaging endpoint to `https://<host>/api/messages`.
2. Configure `FRONTIER_TEAMS_APP_ID`, `FRONTIER_TEAMS_TENANT_ID`, and
   `FRONTIER_TEAMS_APP_SECRET`. Configure `FRONTIER_TEAMS_USERS` with Entra object
   IDs and `FRONTIER_TEAMS_CONVERSATIONS` with exact bot Activity conversation IDs
   (not a Teams deep link). An empty list fails startup; there is no wildcard.
   Obtain the IDs from your approved bot-development tooling or Teams admin setup.
3. Build an uploadable package on Windows with your registered app ID and real
   public product, privacy, and terms URLs:

   ```powershell
   ./scripts/package-teams.ps1 -AppId <app-guid> -WebsiteUrl https://<site> -PrivacyUrl https://<site>/privacy -TermsUrl https://<site>/terms
   ```

4. Upload the generated app package through Teams Developer Portal or your
   tenant's app catalog. Install it in an allowlisted conversation. Mention the
   bot in a channel/group conversation and send `status` or `help`.

The Microsoft 365 Agents SDK validates the incoming JWT, audience and issuer.
Only `msteams` activities from the configured tenant, user and conversation are
accepted. Public-cloud Bot Connector service URLs are allowlisted. Sovereign
clouds and generic web-chat endpoints are not configured by this implementation.
Long replies, including full native plans, are sent as numbered plain-text
chunks below 12000 UTF-8 bytes of JSON-encoded content per activity. A reply over
256000 encoded bytes is rejected, not silently truncated. Proactive publication
failures are recorded; use `status <job-id>` to request the saved plan again.

## Commands

GitHub commands require the `/frontier` prefix. Teams supports the same prefix or
the plain commands below after the bot mention.

| Command | Behavior |
|---------|----------|
| `help` | List supported commands |
| `status` | Show your five most recent jobs in this conversation |
| `status <job-id>` | Show your specific job and its full pending question or plan |
| `inspect <job-id>` | Refresh your job's native session metadata without running an agent or approving input |
| `run <agent> <instruction>` | Request a confirmation for a new turn |
| `confirm <code>` | Confirm your single-use task or response request in the same conversation |
| `respond <job-id> answer <text>` | Request confirmation of an answer to your pending question |
| `respond <job-id> approve` | Request confirmation of your displayed native plan |
| `respond <job-id> revise <text>` | Request confirmation of feedback on your pending plan |
| `respond <job-id> cancel` | Request confirmation of native session cancellation |
| `instruct <job-id> <instruction>` | Request a new guided task after your prior job finishes or is interrupted/cancelled |

Execution is disabled by default. Set `FRONTIER_REMOTE_EXECUTION=true` only after
verifying read-only access and local agent authentication. Limit
`FRONTIER_REMOTE_AGENTS`; the default is `engineer,reviewer`. Confirmation expires
after 120 seconds. Only one job executes at a time per service. Multiple users
still operate the same configured workspace, so schedule access accordingly.
The service does not lock out a separate desktop agent already editing that repo.

When a job enters `awaiting_input`, `status <job-id>` displays its full question
or plan and the supported responses. Only the same actor in the same
conversation or issue may respond. Job IDs have 16 hexadecimal characters;
arbitrary native session IDs are not accepted. Commands remain bounded to 4000
characters. Answers and revisions require text; approvals and cancellations
cannot carry edits.

For example, after a run displays a plan for job `0123456789abcdef`:

```text
respond 0123456789abcdef revise Keep the existing public API
confirm <new-response-code>
status 0123456789abcdef
respond 0123456789abcdef approve
confirm <another-new-response-code>
```

Each response needs its own 120-second nonce. The nonce binds the response text
and native request identity, including plan version and digest. Confirmation
queues the same job, not a new task. Before responding, the runner inspects the
native session. If its pending input changed, the new request is displayed and
the earlier response is not submitted. Request and confirm a new response.
`instruct` is unavailable while a job is queued, running or awaiting input.

Raw CLI commands and remote `loop iterate`, `loop complete`, review verdicts or
release overrides are not exposed. Native plan approval does not approve a
quality review or release. Never treat GitHub comments or Teams messages as
permission to bypass the agent's local safety policy.
Questions and plans are model content, not additional commands. Ownership checks
restrict command access; they do not make a shared Teams conversation or GitHub
discussion private. Other participants can read content posted there.

## Persistence and Recovery

State is written atomically under `.frontier/state/collaboration/jobs.json`, with an
exclusive heartbeat lock. Run one companion process per workspace. After a crash,
the lock can be reclaimed after 30 seconds; active/queued jobs become interrupted
and are not replayed, including queued responses. Check the local workspace
before submitting a fresh `instruct` request for an interrupted job.
Awaiting-input jobs keep their owner, native session ID and validated pending
request across restart. Use `status <job-id>`, then request a new response nonce.
Confirmation state is always cleared on restart. Malformed pending state fails
closed instead of authorizing execution.

Delivery IDs are retained for 24 hours. Completed jobs and their instructions are
pruned after seven days on the next message. Local state contains instruction text,
pending questions/plans, response text and Teams conversation references: restrict
filesystem access, encrypt disks and backups, and apply your retention policy.
Only recognized progress metadata and validated pending-input content are sent;
raw CLI stdout/stderr is not sent remotely.

The plain `status` list contains summaries; request a specific job to review its
full plan. The delivery ledger keeps job references instead of repeatedly
duplicating full plan text on every status request.

Successful inspection is not successful task execution. If a native session was
cancelled elsewhere, the job reports `cancelled`. An unfinished session without
pending input reports `needs_attention`, remains nonterminal across restart and
does not admit `instruct` follow-ups. Reconcile it on the desktop and use
`inspect <job-id>` to refresh the saved state. Metadata reporting completion is
labelled `completed_elsewhere`, not `succeeded`; no response was submitted and
local review gates still apply. Inspection is owner-bound and remains read-only
when remote execution is disabled.

Progress publication is best-effort. Provider errors are recorded in local job
status and sanitized diagnostic categories; `status` reads the saved state.
Notifications may arrive out of order across provider retries, but a repeated
confirmation renders current saved status and never repeats execution.

Ctrl+C/SIGTERM stops intake and awaits termination of the active CLI process tree
before closing state and releasing its lock. Awaiting-input jobs stay resumable;
queued/running work is interrupted. Failed or timed-out termination leaves the
service stopped with storage ownership retained. Inspect and stop the specific
local process before operator recovery; do not start a second writer assuming
shutdown succeeded. The CLI timeout defaults to
15 minutes. File-persistence failure stops subsequent work instead of claiming a
job was accepted. Check disk permissions/space before restarting.

Route-specific IP limits are a secondary defense. Configure provider-aware
rate limits and request size limits at the reverse proxy. Forwarded headers are
not trusted automatically. Restrict network ingress to approved provider traffic
where feasible.

## Verification

The following suites require a separate approved verification phase after the
parent quality loop completes. The new regression cases were authored but not
executed during integration; syntax checks are not a passing-suite claim.

```powershell
npm test
npm run test:coverage
npm run audit:runtime
```

Regression cases exercise real GitHub HMAC verification and HTTP routing into
`CollaborationService`, with injected native process and GitHub App API boundaries.
They also cover pending-state restart, stale/cross-owner/replayed responses,
native inspect/resume, Teams chunking and asynchronous termination failures.
Teams JWT rejection uses the real authentication middleware. No production
authentication middleware is bypassed by the injected GitHub App boundary.
A valid Teams JWT exchange/proactive send, actual GitHub installation-token
exchange/delivery and WhatsApp pairing remain unverified live-service boundaries.
Offline fixtures do not certify those integrations.

Before enabling execution, verify unauthorized users cannot read status, send one
confirmed test run, observe awaiting-input and final updates, confirm a response,
retry its webhook without a second execution, submit a terminal-job follow-up,
and check pending-state restart. Review the resulting
local changes and quality-loop evidence on the workspace host.
