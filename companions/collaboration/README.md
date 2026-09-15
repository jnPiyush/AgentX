---
title: Frontier Teams and GitHub App Companion
description: Configure authenticated agent progress and instructions from Microsoft Teams and GitHub App issue comments.
---

## Capabilities

The companion connects one local Frontier workspace to Teams and a GitHub App.
Authorized users can start a confirmed agent turn, see queued/running/final
status, and submit follow-up instructions. Progress updates return to the
originating Teams conversation or GitHub issue/PR discussion every 30 seconds
while work runs, and on completion.

Instructions are subsequent agent turns, not interruption of a live VS Code
Copilot turn. A follow-up includes the earlier instructions and current workspace
files, not the complete model transcript. Job success means the CLI turn finished,
not that the independent quality review or release gate passed.

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

## Commands

GitHub commands require the `/frontier` prefix. Teams supports the same prefix or
the plain commands below after the bot mention.

| Command | Behavior |
|---------|----------|
| `help` | List supported commands |
| `status` | Show your five most recent jobs in this conversation |
| `status <job-id>` | Show your specific job |
| `run <agent> <instruction>` | Request a confirmation for a new turn |
| `confirm <code>` | Accept your pending request in the same conversation |
| `instruct <job-id> <instruction>` | Request a confirmed follow-up to your job |

Execution is disabled by default. Set `FRONTIER_REMOTE_EXECUTION=true` only after
verifying read-only access and local agent authentication. Limit
`FRONTIER_REMOTE_AGENTS`; the default is `engineer,reviewer`. Confirmation expires
after 120 seconds. Only one job executes at a time per service. Multiple users
still operate the same configured workspace, so schedule access accordingly.
The service does not lock out a separate desktop agent already editing that repo.

Neither raw CLI commands nor remote `loop iterate`, `loop complete`, release, or
approval commands are exposed. Never treat GitHub comments or Teams messages as
permission to bypass the agent's local safety policy.

## Persistence and Recovery

State is written atomically under `.frontier/state/collaboration/jobs.json`, with an
exclusive heartbeat lock. Run one companion process per workspace. After a crash,
the lock can be reclaimed after 30 seconds; active/queued jobs become interrupted
and are not replayed. Submit a fresh `instruct` request after checking the local
workspace. Confirmation state is cleared on restart.

Delivery IDs are retained for 24 hours. Completed jobs and their instructions are
pruned after seven days on the next message. Local state contains instruction text
and Teams conversation references: restrict filesystem access, encrypt disks and
backups, and apply your retention policy. No raw local CLI output is sent remotely.

Progress publication is best-effort. Provider errors are recorded in local job
status and sanitized diagnostic categories; `status` reads the saved state.
Notifications may arrive out of order across provider retries, but a repeated
confirmation renders current saved status and never repeats execution.

Ctrl+C/SIGTERM stops intake, terminates the active CLI process tree, marks pending
work interrupted, and releases the storage lock. The CLI timeout defaults to
15 minutes. File-persistence failure stops subsequent work instead of claiming a
job was accepted. Check disk permissions/space before restarting.

Route-specific IP limits are a secondary defense. Configure provider-aware
rate limits and request size limits at the reverse proxy. Forwarded headers are
not trusted automatically. Restrict network ingress to approved provider traffic
where feasible.

## Verification

```powershell
npm test
npm run test:coverage
npm run audit:runtime
```

Automated tests use real GitHub HMAC verification, the real Teams JWT rejection
middleware, local HTTP requests, and injected provider/runtime doubles. A valid
Teams JWT exchange/proactive send and actual GitHub installation-token delivery
require live credentials and are not certified by these offline tests.

Before enabling execution, verify unauthorized users cannot read status, send one
confirmed test run, observe running/final updates, retry its webhook without a
second run, submit a follow-up, and test service restart. Review the resulting
local changes and quality-loop evidence on the workspace host.