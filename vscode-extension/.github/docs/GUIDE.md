# Frontier Guide

Frontier Corp deploys AI Forward Deployed Engineers (FDEs) through its
Hypervelocity Engineering platform, Frontier.

> For core workflow and agent roles, see [AGENTS.md](../AGENTS.md). For skills index, see [Skills.md](../Skills.md).

---

## Table of Contents

- [5-Minute Quickstart](#5-minute-quickstart)
- [Installation](#installation)
- [GitHub Project Setup](#github-project-setup)
- [Local Mode (No GitHub)](#local-mode-no-github)
- [GitHub MCP Server Integration](#github-mcp-server-integration)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)

---

## 5-Minute Quickstart

> **Build a reviewed feature with Frontier in 5 minutes.**

### What You'll Do

1. Install Frontier into your project
2. Create your first issue
3. Run the Product FDE -> Engineering FDE -> Review FDE pipeline
4. Ship a reviewed, tested feature

**Time**: ~5 minutes (with an existing project)

### Step 1: Install (30 seconds)

```powershell
# PowerShell -- into an existing project directory
cd your-project
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v9.3.1/install.ps1 | iex
```

```bash
# Bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.3.1/install.sh | bash
```

**What happens**: Frontier copies agents, skills, templates, and CLI into your project. Your existing code is untouched.

> **No GitHub?** Add `-Local` (PowerShell) or `--local` (Bash) for offline mode.

### Step 2: Create Your First Issue (30 seconds)

Open VS Code with Copilot Chat. Type:

```
@frontier Create a story to add a /health endpoint to our API
```

**Or via CLI** (GitHub mode):
```bash
gh issue create --title "[Story] Add /health endpoint" --label "type:story"
```

**Or via CLI** (Local mode):
```powershell
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Story] Add /health endpoint" -Labels "type:story"
```

The Orchestration FDE classifies this as a simple `type:story` and can complete it using the Engineering FDE workflow.

### Step 3: Implement with a Frontier FDE (2 minutes)

Stay with **Frontier Orchestration FDE** for end-to-end execution, or select
**Frontier Engineering FDE** for strict role isolation:

```
Implement the health endpoint for issue #1
```

The implementation workflow will:

1. **Read the issue** and check prerequisites
2. **Load the right skills** automatically (`api-design`, `testing`, `error-handling`)
3. **Generate code** that follows your project's instruction guardrails
4. **Write tests** (enforced: >=80% coverage)
5. **Commit** with proper format: `feat: add health endpoint (#1)`

#### What Guardrails Are Active?

| If you're editing... | Auto-loaded instruction | Enforces |
|----------------------|------------------------|----------|
| `*.py` | `python.instructions.md` | Type hints, PEP 8, Google docstrings |
| `*.cs` | `csharp.instructions.md` | Nullable types, async patterns, XML docs |
| `*.ts` | `typescript.instructions.md` | Strict mode, Zod validation, ESM imports |
| `*.tsx` | `react.instructions.md` | Hooks, TypeScript props, accessibility |

You don't configure this -- it's automatic via `applyTo` glob matching.

### Step 4: Review with Reviewer Agent (1 minute)

Once the Engineer moves the issue to `In Review`:

```
@Reviewer Review the code for issue #1
```

The Reviewer will:

1. **Check code quality** (naming, patterns, SOLID principles)
2. **Verify tests** (80% coverage, test pyramid)
3. **Security scan** (no hardcoded secrets, parameterized SQL)
4. **Create review doc** at `docs/artifacts/reviews/REVIEW-1.md`
5. **Approve** -> Status moves to `Done`

### Step 5: Done! What Just Happened?

Frontier enforced:
- **Code standards** via auto-loaded instruction files
- **Test coverage** (80%+ required by Engineer constraints)
- **Security** (blocked commands, secrets scanning)
- **Process** (issue-first, status tracking, review before merge)

### Next: Try a Complex Feature

For larger work, use the **full pipeline**:

```
@frontier Create an epic for user authentication with OAuth
```

This triggers the full flow:

```
PM (creates PRD)
 -> UX Designer (wireframes + prototypes)
 -> Architect (ADR + Tech Spec)
 -> Engineer (implementation)
 -> Reviewer (code review)
```

Each agent produces a deliverable, validates it, and hands off to the next.

---

## Installation

### Quick Install

```powershell
# PowerShell (Windows)
.\install.ps1

# Bash (Linux/Mac)
./install.sh

# One-liner (downloads and runs)
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v9.3.1/install.ps1 | iex    # PowerShell
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.3.1/install.sh | bash  # Bash
```

PowerShell install path note:
`install.ps1` requires PowerShell 7.4+ (`pwsh`). If you are on older Windows PowerShell, install PowerShell 7 and rerun with `pwsh -File .\install.ps1`.

PowerShell 7.4+ is also required on Linux/macOS: the Bash CLI launcher delegates
to `pwsh`. Installers preserve an existing `.vscode/mcp.json`, including during
forced setup; merge any new server configuration explicitly.

On macOS, use PowerShell 7.4+, Git, Node.js, and VS Code 1.134+ for the extension.
The canonical CLI entry point is `bash .agentx/frontier.sh`; the legacy
`bash .agentx/agentx.sh` wrapper remains supported. Both tracked launchers are
executable, and the installer enables their executable permissions. Extension
commands preserve literal argument strings in both Bash and PowerShell, and
PowerShell version detection does not invoke an intermediate shell.

The `Quality Loop` jobs in `.github/workflows/quality-gates.yml` run launcher,
shell-argument, review-state, parity, rollback and code-quality tests on native
Ubuntu and macOS runners. A configured job is not a passing result: inspect its
run for the current commit before claiming native platform verification.

Each new loop begins without a test-count baseline. After running the relevant
suite, record its actual passing count with `loop baseline -c <count>` and pass
`--passing <count>` to subsequent `loop iterate` and `loop complete` commands.
Counts below the recorded baseline, or missing counts, fail. The CLI warns when
the baseline is unset; recording a count does not execute tests or prove review
independence. Evidence and an attributed final review are separate requirements.

For small changes, select checks covering the affected behavior and direct callers;
record the commands and omitted surfaces with rationale. Expand for shared
contracts, broad changes or required CI/release gates, not for iteration count.
Use the same selected surface for baseline comparisons. The VS Code iteration and
completion dialogs accept the actual passing count, including zero.

### Recovering evidence verification

Loop audit subprocesses drain stdout and stderr concurrently and have a 30-second
deadline. The code-quality evaluator has a 90-second deadline, leaving teardown
headroom within the extension's two-minute command limit. A timeout or
nonzero checker exit is a failure, never evidence approval. Completion checks
passing counts and final artifact presence/freshness before the expensive evaluator.

- Checker timeout/startup failure: inspect the reported checker and its dependencies,
  then retry; do not regenerate unrelated test suites or disable verification.
- Missing or regressed passing count: provide the actual result for the recorded
  test surface. Do not lower the baseline or substitute a larger unrelated suite.
- Stale final evidence: run a fresh, scoped final check after the review iteration
  and submit its real output. Never touch timestamps or copy old evidence to pass.
- Changed hashes or review findings: rerun affected tests and obtain a new review.
- Complete the loop before committing; an active loop is rejected by the commit hook.

Architect and UX Designer request `GPT-6 Astra (copilot)`. Copilot API catalog
metadata verified `gpt-6-astra` with Responses transport; other providers are not
silently substituted. Catalog availability is not a measured architecture or UX
quality comparison, and each end user's account must expose the selected model.

The lifecycle signal hook records event, session and tool metadata only. It does
not persist prompts, tool arguments, tool results or error payloads. This change
does not sanitize historical signal logs; review their retention and access
separately before sharing a workspace or its logs.

### Upgrading Existing Workspaces

Changing an installed version requires explicit `-Force` (PowerShell) or
`--force` (Bash), including upgrades from v8. Back up local customizations before
using force: it replaces files supplied by the release but does not uninstall
old trees or remove files absent from the archive. Obsolete customizations can
therefore remain and should be reviewed manually.

Configuration, issues, state, sessions, memory and digests are preserved.
Runtime writes use `.frontier/`. The first runtime access fills missing files
from `.hve/`, then `.agentx/`, without replacing existing Frontier files. Sources
remain intact. Migration uses an exclusive `.frontier-migration.lock` directory,
per-file atomic publication and a completion marker. Recover a stale lock only
after confirming no migration process is running.

### Install Profiles

Control what gets installed with the `-Profile` flag:

| Profile | Skills | Instructions | Prompts | Hooks | VS Code |
|---------|--------|-------------|---------|-------|---------|
| **full** (default) | All 107 | All 7 | Yes | Yes | Yes |
| **minimal** | None | None | No | No | No |
| **python** | Python, testing, data, architecture | python, api | Yes | Yes | Yes |
| **dotnet** | C#, Blazor, Azure, SQL, architecture | csharp, blazor, api | Yes | Yes | Yes |
| **react** | React, TypeScript, UI, design, architecture | react, api | Yes | Yes | Yes |

**All profiles always include**: agents, templates, CLI, instructions, issue templates, documentation.

```powershell
# PowerShell examples
.\install.ps1 -Profile python          # Python stack
.\install.ps1 -Profile minimal -Local  # Core only, local mode
.\install.ps1 -Force                   # Reinstall (overwrite existing)
.\install.ps1 -NoSetup                 # Skip interactive prompts (CI/scripts)

# Bash examples
./install.sh --profile python
./install.sh --profile minimal --local
./install.sh --force
./install.sh --no-setup

# One-liner with profile (env vars)
PROFILE=python curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.3.1/install.sh | bash
```

### What the Installer Does

1. **Download** -- Downloads the Frontier repo archive to a temp directory
2. **Extract** -- Unpacks the archive and identifies essential directories
3. **Copy** -- Merges files into your project (skips existing files unless `-Force`)
4. **Configure** -- Generates `agent-status.json`, `config.json`, output directories
5. **Setup** -- Interactive: git init, hooks install, username config (skip with `-NoSetup`)
6. **Companion Extensions** -- Installs Azure companion capabilities when Frontier detects an Azure-oriented workspace (or when you force it with `-Azure` / `--azure`)

---

## Using Frontier with GitHub Copilot CLI and the Agents Window

Frontier supports three host surfaces. Pick the one that matches how you work.

### 1. VS Code extension (default)

Install the Frontier extension. It contributes all 26 agents, 134 skills and the
instruction files directly to the host -- nothing is copied into your
workspace. This is the zero-copy path.

To use Frontier in the **Agents window** (VS Code's dedicated agent surface),
opt the extension in:

```jsonc
// .vscode/settings.json
{
  "extensions.supportAgentsWindow": { "jnPiyush.agentx": true }
}
```

> **Agent Host limitation**: prompt files (`.prompt.md`) do **not** execute in
> Agents-window Agent Host sessions. Frontier ships prompts for the editor chat
> view; use **agents** or **skills** when you need behaviour that runs in the
> Agents window.

### 2. GitHub Copilot CLI -- native plugin

The repository root ships a `plugin.json`, so Copilot CLI can register Frontier's
agents, skills and lifecycle hooks without copying anything:

```bash
copilot plugin install jnPiyush/AgentX
copilot plugin list
copilot --agent engineer -p "Implement the health endpoint"
```

### 3. GitHub Copilot CLI -- workspace seeding

Use `Frontier: Initialize CLI` from the Command Palette when you want Frontier
assets present in the workspace itself (for teammates without the extension, or
for CI). It seeds `.github/agents`, `.github/skills`, `.github/instructions`,
`.github/prompts`, `.github/templates`, `.github/schemas`, `.github/registries`
and `.github/hooks`, plus the workflow docs, rubrics and gate scripts the agents
reference.

Two modes are available via the `frontier.cliAssetMode` setting:

| Mode | Behaviour | Use when |
|------|-----------|----------|
| `copy` (default) | Duplicates bundled assets into the workspace | You want the assets committed and shared with a team |
| `symlink` | Creates directory junctions into the installed extension bundle | Single-user, zero-copy; entries are added to `.gitignore` and refreshed on upgrade |

Seeding never overwrites existing files, and never writes host-owned files such
as `.github/workflows`, `.github/ISSUE_TEMPLATE`, `CODEOWNERS` or `LICENSE`.

If you run both the extension and workspace seeding, suppress duplicate agent
registrations so each agent appears once in the picker:

```jsonc
// .vscode/settings.json
{
  "chat.agentFilesLocations": { ".github/agents": false }
}
```

### Standalone install (no VS Code extension)

```powershell
pwsh packs/frontier-copilot-cli/install.ps1 -Target /path/to/project -IncludeCli
```

See [packs/frontier-copilot-cli/README.md](../packs/frontier-copilot-cli/README.md).

### Model Selection and Council Execution

Runner model labels use normalized exact matching. GPT-5.6 Sol and GPT-5.3-Codex
retain their requested IDs and use the Responses API on Copilot and OpenAI
providers, with stateless tool-result replay. Unknown labels fail visibly instead
of matching an older version. Existing provider-specific compatibility mappings
remain explicit; verify the selected provider and model before a run. Provider
catalog availability does not establish model quality or account billing limits.

`frontier council` generates an unexecuted brief with role-specific instructions.
Run it through `Frontier: Run Council`, authorized independent host-agent calls,
or `-AutoInvoke` with an installed `gh models` extension and a supported roster.
Use `-Members` to select provider-supported alternatives. Missing CLI tooling,
failed calls and empty responses do not count as successful execution.

Council artifacts record requested and selected models in `Execution Evidence`.
Three successful distinct selections and completed synthesis are required by the
new-ADR council gate. A single model playing three roles is incomplete, even if
all roles respond. VS Code host vendor names do not prove training diversity.
Historical councils are not rewritten by these checks.

### HydraFusion Research Preview

Use GitHub's native HydraFusion workflow when available; do not emulate it by
adding a guessed model ID to Frontier's API model map. Frontier's `copilot`
provider uses model APIs (chat completions or Responses), whereas HydraFusion orchestrates a complete
native Copilot CLI task. Model Council and Frontier's independent review gates
are separate capabilities and remain required.

The native-first evaluation on 2026-09-15 confirmed Copilot CLI `1.0.84-2` can
start an experimental ACP session. Its account-specific session catalog returned
23 model choices, including Auto, but no HydraFusion entry. This blocks a
verified automated integration on that tested surface. It does not establish
that HydraFusion is unavailable in the interactive picker or on other accounts.
No HydraFusion solver run, custom-agent compatibility, usage aggregation or
cancellation/patch behavior has been verified in Frontier yet.

#### Interactive Opt-In

Use a disposable test checkout with Frontier's native plugin or seeded agents
already configured. Do not run a second editing agent against an active checkout.
Start the native CLI, keeping normal permission prompts:

```powershell
copilot --experimental
```

In that interactive session:

1. Check `/version`. Update through `/update` if needed, then restart. Multiple
  installations and cached updates can resolve to different CLI versions.
2. Select the intended Frontier agent through `/agent` and verify `/env` lists
  the expected instructions and hooks. Do not disable them for a coding task.
3. Open `/model` and select `HydraFusion (Research Preview)` if offered. Verify
  the active model after agent selection; do not change global defaults.
4. Review `/limits` and billing terms before sending one bounded task. The tested
  CLI accepts a minimum of 30 AI credits for `--max-ai-credits`; this is a soft
  limit, not an estimated charge or a hard spending guarantee.
5. Inspect the resulting diff, run the task's tests and complete Frontier's
  independent review. HydraFusion's internal critique is not proof that the
  repository's review gate passed.

If the picker does not offer HydraFusion, stop and check CLI updates and account
or organization availability. Do not substitute Auto or another model while
reporting the result as HydraFusion. Do not add `--allow-all` or `--yolo` to make
an unattended probe work.

#### Evaluation Findings And Next Gate

The account catalog was read using ACP `initialize` and `session/new`, with no
`session/prompt` call. An earlier `-p "/model"` probe instead invoked Sonnet once;
it is not model-discovery or HydraFusion evidence. The same build treated an
empty `--available-tools=` as default tools, not a tool-less configuration.
Do not rely on either behavior for automation. No repository files were exposed
to those probes; they used separate temporary workspaces and settings.

Before adding an automated Frontier entry point, verify a supported native
selector, explicit opt-in, model-selection fidelity, custom-agent/tool boundaries,
timeout/cancellation behavior, one final validated patch, and complete usage
reporting. Preserve unsupported, denied and failed states without silent model
fallback. Keep the existing provider path unchanged until these checks pass.

References: [HydraFusion announcement](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/),
[Copilot CLI command reference](https://docs.github.com/en/copilot/reference/cli-command-reference),
and [ACP reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server).

---

## Companion Extensions

Frontier works with companion extensions that provide complementary capabilities. The installer auto-installs these when the `code` CLI is available.

| Extension | ID | Purpose | Auto-Installed |
|-----------|-----|---------|----------------|
| **Azure MCP Extension** | `ms-azuretools.vscode-azure-mcp-server` | Installs Azure MCP plus the Azure Skills companion for Azure design, deployment, diagnostics, and Foundry workflows | Azure workspaces only |
| **GitHub Copilot** | `GitHub.copilot` | AI code completions (required for Copilot Chat) | Prerequisite |
| **GitHub Copilot Chat** | `GitHub.copilot-chat` | Chat interface for agent interactions | Prerequisite |

### Why Azure MCP Extension and Azure Skills?

When a project targets Azure, Frontier can install the Azure MCP Extension. That extension also brings in the Azure Skills companion from `microsoft/azure-skills`, wiring the guidance layer and MCP execution layer together for Azure work.

| Layer | Provider | Covers |
|-------|----------|--------|
| **Design and Architecture** | Frontier `azure-foundry` | Model selection, eval strategy, guardrails, deployment patterns |
| **Operational Execution** | Azure Skills plugin + Azure MCP | Prepare, validate, deploy, diagnose, cost review, RBAC, Foundry workflows |

Frontier triggers this install when it detects Azure files such as `azure.yaml`, `.azure/`, Azure Functions config, or Bicep files. You can also force it during install with `-Azure` on PowerShell or `--azure` on Bash.

### Manual Install

If the installer couldn't auto-install (no `code` CLI):

```bash
code --install-extension ms-azuretools.vscode-azure-mcp-server
```

### Workspace Recommendations

Frontier includes a `.vscode/extensions.json` that recommends companion extensions. VS Code will prompt users to install them when opening the workspace.

### Provider Configuration

Frontier now resolves runtime behavior from `.frontier/config.json` in this order:

1. `provider` (canonical)
2. `integration` (migration compatibility)
3. `mode` (legacy compatibility)

Use `provider` for new workspaces. Older fields are still read so existing repos continue to work.

When the `claude-code` provider is used through `.agentx/agentic-runner.ps1`, the bridge runs in text-only mode with `--permission-mode dontAsk` and no Claude-native tools. Native Read/Write/Edit/Grep/Glob/Bash execute inside the Claude process and cannot pass through Frontier workspace-path, boundary, or command guards, so they remain disabled until a guarded MCP adapter is available. Use the Copilot or direct API adapters when an Frontier run requires tool execution.

---

## GitHub Project Setup

### 1. Create GitHub Project V2

```bash
# Via GitHub CLI
gh project create --owner <OWNER> --title "Frontier Development"

# Or via web: https://github.com/users/<YOUR_USERNAME>/projects
```

### 2. Configure Status Field

In your project settings, create a **Status** field (Single Select) with these values:

| Status Value | Description |
|--------------|-------------|
| Backlog | Issue created, waiting to be claimed |
| Ready | Design/spec complete, awaiting next phase |
| In Progress | Active work by Engineer |
| In Review | Code review phase |
| Done | Completed and closed |

> **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels. Labels are for type only (`type:epic`, `type:story`, etc.).

### 3. Link Repository

1. Go to Project Settings -> Manage Access
2. Add repository: `<OWNER>/<REPO>`
3. Issues automatically sync to project board

### 4. Configure Frontier CLI Status Sync

To let `frontier issue update -s ...` keep GitHub Project V2 status in sync, set these values in `.frontier/config.json`:

```json
{
  "provider": "github",
  "repo": "OWNER/REPO",
  "project": 4
}
```

Optional:
- `projectOwner`: override the project owner if it differs from the repo owner
- `githubProjectStatusMap`: override status-name mapping if your project uses custom option names

Default Frontier -> GitHub Project status mapping:

| Frontier Status | GitHub Project Status |
|---------------|-----------------------|
| Backlog | Backlog |
| Ready | Ready |
| In Progress | In progress |
| In Review | In review |
| Validating | In review |
| Done | Done |

When a GitHub project number is configured, the CLI will:
- add newly created GitHub issues to that project
- set new issues to `Backlog`
- update Project V2 status when `frontier issue update -s ...` is used
- set Project V2 status to `Done` before `frontier issue close`

GitHub does not emit a normal workflow event when a Project V2 Status field changes. After moving an issue between Status values, rerun Frontier routing by adding an issue comment with exactly:

```text
/frontier route
```

The same router workflow also remains available through manual `workflow_dispatch` when needed.

When `.frontier/config.json` includes a GitHub project number, Frontier also ships a scheduled reroute poller workflow that scans recent Project V2 item changes and redispatches `frontier.yml` automatically. Use `/frontier route` when you need an immediate reroute instead of waiting for the next scheduled scan.

### Status Transitions

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | -> `Ready` | Ready for design/architecture |
| UX completes designs | -> `Ready` | Ready for architecture |
| Architect completes spec | -> `Ready` | Ready for implementation |
| Engineer starts work | -> `In Progress` | Active development |
| Engineer completes code | -> `In Review` | Ready for code review |
| Reviewer approves | -> `Validating` | Ready for post-review validation |
| DevOps + Tester validate | -> `Done` + Close | Work complete (or back to Engineer for bug fixes) |

### Agent Workflow with Projects

```json
// Check issue status via MCP
{ "tool": "issue_read", "args": { "issue_number": 60 } }
```

Agents:
1. Check issue Status in Projects board
2. Comment when starting ("Engineer starting implementation...")
3. Complete work
4. Update Status in Projects board
5. Comment when done ("Implementation complete")

### Querying Issues

```bash
# By type
gh issue list --label "type:story"

# By label
gh issue list --label "needs:ux"

# Via MCP
{ "tool": "list_issues", "args": { "owner": "<OWNER>", "repo": "Frontier", "labels": ["type:story"], "state": "open" } }
```

### Ideal Issue-First Workflow (GitHub Mode)

Every piece of work starts with an issue. This gives agents a coordination point for routing, status tracking, and handoff validation.

```bash
# Step 1: Create issue BEFORE starting work
gh issue create --title "[Story] Add /health endpoint" \
  --label "type:story" --label "priority:p1" \
  --body "## Acceptance Criteria
- GET /health returns 200 with JSON body
- Response includes uptime and version
- Unit tests cover happy path and error cases

## Dependencies
None"

# Step 2: Check the ready queue for prioritized work
.\.agentx\frontier.ps1 ready

# Step 3: Update status as work progresses
# If .frontier/config.json includes a GitHub project number, the CLI also syncs
# the Project V2 Status field for these transitions.
.\.agentx\frontier.ps1 issue update -n 42 -s "In Progress"
.\.agentx\frontier.ps1 issue update -n 42 -s "In Review"

# Step 4: Commit with issue reference
git commit -m "feat: add health endpoint (refs #42)"

# Final delivery should use a closing keyword in the PR body or merge commit:
# fix: add health endpoint (fixes #42)

# Step 5: After review, close the issue if it was not auto-closed
gh issue close 42 --reason completed
```

Important: `(#42)` is a link, not a close action. Use `fixes #42`, `closes #42`, or `resolves #42` in the final PR or delivery commit to prevent stale-open issues.

**What agents get from the issue:**
- **Engineer**: Acceptance criteria, dependencies, priority
- **Reviewer**: Validation checklist, scope of changes
- **PM/Architect**: Context for PRD/ADR creation on complex issues
- **Frontier**: Classification data for routing decisions

**Emergency bypass**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward:
```bash
gh issue create --title "[Bug] Fix login timeout" --label "type:bug" \
  --body "Fixed in commit abc1234. Retroactive issue for traceability."
gh issue close <ID> --reason completed
```

### Recommended Board View

**Columns:** Backlog -> Ready -> In Progress -> In Review -> Done
**Filters:** Group by Status, Sort by Priority (descending)

### GitHub Projects Troubleshooting

- **Status not visible**: Ensure issue is added to project and Status field exists
- **Agent coordination issues**: Verify Status field value in Projects board
- **Status changed but routing did not re-run**: Add the issue comment `/frontier route` to trigger an explicit status-based reroute
- **Automatic reroute still not happening**: Verify `.frontier/config.json` includes the GitHub project number and that the `Frontier Project Reroute Poller` workflow is enabled
- **Manual add**: `gh project item-add <PROJECT_ID> --owner <OWNER> --url <ISSUE_URL>`

---

## Local Mode (No GitHub)

Use Frontier without GitHub -- filesystem-based issue tracking and agent coordination.

### When to Use

Recommended: Personal projects, learning Frontier, offline development, prototyping
Not recommended: Team collaboration, CI/CD, code reviews, production workflows

### Installation

**During initial setup:**
```powershell
# PowerShell
.\install.ps1 -Local

# Bash
./install.sh --local
```

**With mode flag:**
```powershell
.\install.ps1 -Local
```

**Enable later (if already installed in GitHub mode):**
```powershell
New-Item -ItemType Directory -Path ".frontier/issues" -Force

@{
  provider = "local"
  integration = "local"
    mode = "local"
    enforceIssues = $false
    nextIssueNumber = 1
    created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content ".frontier/config.json"
```

**Configure issue enforcement:**
```powershell
# Local mode: issues are optional by default
# Enable if you want commit-msg hook to require issue references:
.\.agentx\frontier.ps1 config set enforceIssues true

# Disable again:
.\.agentx\frontier.ps1 config set enforceIssues false
```

### Issue Management

```powershell
# Create issue
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Story] Add user login" `
    -Body "Implement user authentication" `
    -Labels "type:story"

# List all issues
.\.agentx\local-issue-manager.ps1 -Action list

# Get specific issue
.\.agentx\local-issue-manager.ps1 -Action get -IssueNumber 1

# Update status
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"

# Add comment
.\.agentx\local-issue-manager.ps1 -Action comment -IssueNumber 1 -Comment "Started implementation"

# Close issue
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

**Bash (Linux/Mac):**
```bash
./.agentx/local-issue-manager.sh create "[Story] Add user login" "Implement auth" "type:story"
./.agentx/local-issue-manager.sh list
```

**Optional alias** (add to `$PROFILE`):
```powershell
function issue { .\.agentx\local-issue-manager.ps1 @args }
# Then: issue -Action create -Title "[Bug] Fix login" -Labels "type:bug"
```

### Workflow

```
1. Create Issue -> 2. Update Status -> 3. Write Code -> 4. Commit -> 5. Close Issue
```

### File Structure

```
.agentx/
  config.json                    # Provider configuration (`provider` is canonical)
  agentx.ps1                     # PowerShell CLI launcher
  agentx.sh                      # Bash CLI launcher
  agentx-cli.ps1                 # CLI implementation (all subcommands)
  agentic-runner.ps1             # LLM-powered agentic loop runner
  issues/
    1.json                       # Issue #1 data
    2.json                       # Issue #2 data
  state/
    agent-status.json            # Agent state tracking
  digests/                       # Weekly issue digests
  local-issue-manager.ps1        # PowerShell issue manager
  local-issue-manager.sh         # Bash issue manager
```

### Frontier CLI Commands

The CLI works across Local, GitHub, and ADO providers. It resolves the active platform from `.frontier/config.json`, preferring `provider` and falling back to legacy `integration` and `mode` fields.

```powershell
# PowerShell
.\.agentx\frontier.ps1 ready                          # Show priority-sorted work queue
.\.agentx\frontier.ps1 state                          # Show all agent states
.\.agentx\frontier.ps1 state -a engineer -s working -i 42
.\.agentx\frontier.ps1 deps 42                        # Check issue dependencies
.\.agentx\frontier.ps1 digest                         # Generate weekly digest
.\.agentx\frontier.ps1 workflow engineer              # Show workflow steps
.\.agentx\frontier.ps1 hook -Phase start -Agent engineer -Issue 42
.\.agentx\frontier.ps1 run engineer "Fix the tests"   # Run agentic loop (LLM + tools)
.\.agentx\frontier.ps1 config show                    # View current configuration
.\.agentx\frontier.ps1 backlog-sync github --force    # Force re-sync local backlog to GitHub
```

```bash
# Bash
./.agentx/frontier.sh ready
./.agentx/frontier.sh state engineer working 42
./.agentx/frontier.sh deps 42
./.agentx/frontier.sh hook start engineer 42
./.agentx/frontier.sh run engineer "Fix the tests"
```

### Forced GitHub Backlog Re-Sync

If you want to re-apply the current local backlog state to GitHub after the initial migration, run:

```powershell
.\.agentx\frontier.ps1 backlog-sync github --force
```

This reuses the stored local-to-remote issue mapping when available, updates remote issue title/body/labels, replays any new local comments that have not been migrated yet, and reapplies the latest local open/closed status plus GitHub Project V2 status.

### Issue JSON Format

```json
{
  "number": 1,
  "title": "[Story] Add logout button",
  "labels": ["type:story"],
  "status": "In Progress",
  "state": "open",
  "created": "2026-02-04T10:00:00Z",
  "comments": [
    { "body": "Started implementation", "created": "2026-02-04T11:30:00Z" }
  ]
}
```

### Ideal Issue-First Workflow (Local Mode)

In Local Mode, issue-first workflow is **optional by default** -- you can commit freely without issue references. Issue enforcement can be turned on if preferred via `enforceIssues` config.

```powershell
# Simple mode: just commit without issue references
git commit -m "feat: add user login"
git commit -m "fix: resolve timeout"

# Enable issue enforcement if you want it:
.\.agentx\frontier.ps1 config set enforceIssues true

# Full issue workflow (optional but recommended for complex work):
# Step 1: Create issue BEFORE starting work
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Bug] Fix login timeout" `
    -Body "## Problem
Login times out after 30s on slow connections.

## Acceptance Criteria
- Increase timeout to 60s
- Add retry logic with exponential backoff
- Unit tests for retry behavior" `
    -Labels "type:bug"
# -> Creates .frontier/issues/1.json

# Step 2: Check the ready queue for prioritized work
.\.agentx\frontier.ps1 ready

# Step 3: Update status as you work
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
.\.agentx\local-issue-manager.ps1 -Action comment -IssueNumber 1 `
    -Comment "Started implementation - increasing timeout and adding retry"

# Step 4: Commit with issue reference
git commit -m "fix: resolve login timeout with retry logic (#1)"

# Step 5: Move to review, then close
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Review"
# After self-review or peer review:
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "Done"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1
```

```bash
# Bash equivalent
./.agentx/local-issue-manager.sh create "[Bug] Fix login timeout" "Fix timeout issue" "type:bug"
./.agentx/frontier.sh ready
git commit -m "fix: resolve login timeout (#1)"
./.agentx/local-issue-manager.sh close 1
```

**Emergency bypass**: Add `[skip-issue]` to the commit message. Create a retroactive issue afterward:
```powershell
.\.agentx\local-issue-manager.ps1 -Action create `
    -Title "[Bug] Fix login timeout" `
    -Body "Fixed in commit abc1234. Retroactive issue for traceability." `
    -Labels "type:bug"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber <ID>
```

### Agent Handoffs (Manual)

In Local Mode, coordination is manual:

```powershell
# PM -> Architect
issue -Action update -IssueNumber 1 -Status "Ready"
issue -Action comment -IssueNumber 1 -Comment "PRD complete at docs/artifacts/prd/PRD-1.md"

# Architect -> Engineer
issue -Action update -IssueNumber 1 -Status "In Progress"
# (Write code)
issue -Action update -IssueNumber 1 -Status "In Review"

# Reviewer -> Done
issue -Action update -IssueNumber 1 -Status "Done"
issue -Action close -IssueNumber 1
```

### Limitations

| Missing Feature | Local Mode Alternative |
|-----------------|------------------------|
| GitHub Actions | Run scripts manually: `.github/scripts/validate-handoff.sh` |
| Pull Requests | Manual code review using `docs/artifacts/reviews/` |
| Projects Board | Track status in issue JSON files |
| Notifications | Manual check with `issue -Action list` |

### Migration to GitHub

```powershell
# 1. Add remote
git remote add origin https://github.com/owner/repo.git

# 2. Create labels
gh label create "type:epic" --color "5319E7"
gh label create "type:feature" --color "A2EEEF"
gh label create "type:story" --color "0E8A16"
gh label create "type:bug" --color "D73A4A"
gh label create "type:spike" --color "FBCA04"
gh label create "type:docs" --color "0075CA"

# 3. Trigger Frontier once after GitHub is available
# Frontier auto-detects the GitHub repo, switches provider, and syncs the full
# local backlog to GitHub with the latest local status.
.\.agentx\frontier.ps1 config show

# 4. Push and verify config
git push -u origin master
Get-Content .frontier/config.json -Raw
```

What gets synced automatically:
- All local backlog items under `.frontier/issues`, not only open issues.
- Title, body, and labels for each local issue.
- Latest local workflow status into GitHub Project V2 when `project` is configured.
- Closed local items are closed remotely after migration.
- Local comments are copied into the GitHub issue as migrated comments.

If you prefer to switch explicitly before the first auto-detected command, set `repo` or `provider` in `.frontier/config.json` and the same full backlog sync will run on the next Frontier command.

### Azure DevOps Provider

Use the ADO provider when your team tracks work in Azure DevOps instead of GitHub issues.

The built-in work-item provider is MCP-only and uses Microsoft's Azure DevOps MCP Server (`@azure-devops/mcp`).

Required config:

```json
{
  "provider": "ado",
  "integration": "ado",
  "organization": "myorg",
  "project": "MyProject",
  "adapters": {
    "ado": {
      "organization": "myorg",
      "project": "MyProject",
      "mcpCommand": "npx -y @azure-devops/mcp myorg",
      "mcpTools": {
        "get": "wit_get_work_item",
        "create": "wit_create_work_item",
        "update": "wit_update_work_item",
        "comment": "wit_add_work_item_comment",
        "query": "wit_query_by_wiql"
      }
    }
  },
  "created": "2026-03-08T12:00:00Z"
}
```

`organization` may be a plain org name, `https://dev.azure.com/<org>`, or `https://<org>.visualstudio.com`. `mcpCommand` and `mcpTools` are optional overrides; the defaults work with Microsoft's official Azure DevOps MCP Server.

Authentication:
- **Work-item provider**: configure the MCP server per its documentation, typically with `AZURE_DEVOPS_PAT`.
- **Other Azure DevOps automation**: PR and pipeline flows still use Azure CLI authentication where those commands remain CLI-based.

The same harness compliance script runs locally, in GitHub Actions, and in Azure Pipelines so plan/evidence checks stay aligned across providers.

---

## GitHub MCP Server Integration

Replace CLI-based GitHub operations with MCP Server for direct API access, eliminating `workflow_dispatch` caching issues.

### Benefits

- **Immediate workflow triggers** -- no cache refresh wait
- **Structured JSON responses** -- better for agent parsing
- **Unified tooling** -- issues, PRs, Actions in one interface

### Configuration

#### Option 1: Remote Server (Recommended)

No installation required. Requires VS Code 1.101+ and GitHub Copilot subscription.

```json
// .vscode/mcp.json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

OAuth is handled automatically -- no PAT needed.

#### Option 2: Native Binary (Local)

```bash
go install github.com/github/github-mcp-server@latest
```

```json
{
  "servers": {
    "github": {
      "command": "github-mcp-server",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}",
        "GITHUB_TOOLSETS": "actions,issues,pull_requests,repos,users,context"
      }
    }
  }
}
```

#### Option 3: Docker

```json
{
  "servers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "-e", "GITHUB_TOOLSETS=actions,issues,pull_requests,repos,users,context",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_token}"
      }
    }
  }
}
```

#### Comparison

| Aspect | Remote (Hosted) | Native Binary | Docker |
|--------|-----------------|---------------|--------|
| Setup | None | `go install` | Docker running |
| Auth | OAuth (auto) | PAT required | PAT required |
| Startup | Instant | Instant | Container delay |
| Maintenance | GitHub maintains | You update | You update |

### Available Toolsets

| Toolset | Description |
|---------|-------------|
| `actions` | Workflows and CI/CD operations |
| `issues` | Issue creation, updates, comments |
| `pull_requests` | PR management |
| `repos` | Repository operations |
| `users` | User information |
| `context` | Current user/repo context |

### Key Operations

**Trigger workflow:**
```json
{ "tool": "run_workflow", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "ref": "master",
    "inputs": { "issue_number": "48" }
} }
```

**Create issue:**
```json
{ "tool": "create_issue", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "title": "[Feature] New capability",
    "body": "## Description\n...",
    "labels": ["type:feature"]
} }
```

**Monitor workflows:**
```json
{ "tool": "list_workflow_runs", "args": {
    "owner": "<OWNER>", "repo": "<REPO>",
    "workflow_id": "run-product-manager.yml",
    "status": "in_progress"
} }
```

**Workflow control:** `cancel_workflow_run`, `rerun_workflow_run`, `rerun_failed_jobs`

### Agent Orchestration via MCP

```
1. PM completes -> Status = Ready -> UX/Architect picks up
2. Architect completes -> Status = Ready -> Engineer picks up
3. Engineer completes -> Status = In Review -> Reviewer picks up
4. Reviewer approves -> Status = Done + Close issue
```

### MCP vs CLI Comparison

| Aspect | GitHub CLI | GitHub MCP Server |
|--------|------------|-------------------|
| Caching | Subject to GitHub caching | Direct API (no cache) |
| Response | Text output | Structured JSON |
| Agent Integration | Parse stdout | Native tool calls |
| Concurrent Ops | Sequential | Can batch requests |

### MCP Troubleshooting

- **Docker not running**: Start Docker Desktop
- **401 Unauthorized**: Check PAT has `repo` and `workflow` scopes
- **Workflow not found**: Verify exact filename (e.g., `run-pm.yml` not `run-pm`)
- **Rate limited**: Wait for reset or use authenticated requests

---

## Common Commands

| What | Command |
|------|---------|
| **See pending work** | `.\.agentx\frontier.ps1 ready` |
| **Check agent states** | `.\.agentx\frontier.ps1 state` |
| **View workflow steps** | `.\.agentx\frontier.ps1 workflow engineer` |
| **Check dependencies** | `.\.agentx\frontier.ps1 deps 1` |
| **Scaffold an AI agent** | `python .github/skills/ai-systems/ai-agent-development/scripts/scaffold-agent.py --name my-agent` |
| **Scaffold RAG/Memory** | `python .github/skills/ai-systems/cognitive-architecture/scripts/scaffold-cognitive.py --name my-agent` |
| **Run security scan** | `.github/skills/architecture/security/scripts/scan-secrets.ps1` |
| **Check test coverage** | `.github/skills/development/testing/scripts/check-coverage.ps1` |

### VS Code Compound Loop Commands

| What | Surface |
|------|---------|
| **Brainstorm with prior learnings** | Command Palette: `Frontier: Show Brainstorm Guide` or chat: `@frontier brainstorm auth rollout constraints` |
| **Review ranked planning learnings** | Command Palette: `Frontier: Show Planning Learnings` or chat: `@frontier learnings planning` |
| **Review ranked review learnings** | Command Palette: `Frontier: Show Review Learnings` or chat: `@frontier learnings review auth workflow` |
| **Inspect the compound loop** | Command Palette: `Frontier: Show Compound Loop` or chat: `@frontier compound` |
| **Open capture guidance** | Command Palette: `Frontier: Show Knowledge Capture Guidance` or chat: `@frontier capture guidance` |
| **Scaffold a learning artifact** | Command Palette: `Frontier: Create Learning Capture` or chat: `@frontier create learning capture` |
| **Inspect durable review findings** | Command Palette: `Frontier: Show Review Findings` or chat: `@frontier review findings` |
| **Run advisory parity review** | Command Palette: `Frontier: Show Agent-Native Review` or chat: `@frontier agent-native review` |

---

## Troubleshooting

### Installation Issues

| Problem | Solution |
|---------|----------|
| Git hooks not working | Run `agentx hooks install`; it resolves Git's active `core.hooksPath`, installs all three hook sources, and verifies their bytes. |
| Permission denied on scripts | Linux/Mac: `chmod +x .github/scripts/*.sh`; Windows: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| GitHub CLI not authenticated | `gh auth login` (install first: `winget install GitHub.cli` / `brew install gh`) |

### Workflow Issues

| Problem | Solution |
|---------|----------|
| "Issue reference required" error | In local mode: this is now off by default. In GitHub mode: include issue number `git commit -m "feat: add login (#123)"` or bypass with `[skip-issue]` |
| Issue enforcement in local mode | Toggle with `.agentx/frontier.ps1 config set enforceIssues true` (or `false`) |
| Status not updating | Verify GitHub Projects V2 (not V1), check Status field has correct values |
| Agent not triggering | Check Actions is enabled, verify workflow syntax, check Actions tab for failures |

### Validation Failures

| Failure | Fix |
|---------|-----|
| PRD missing sections | Ensure: Problem Statement, Target Users, Goals, Requirements, User Stories |
| ADR missing sections | Ensure: Context, Decision, Options Considered (3+), Consequences |
| Test coverage below 80% | Run `dotnet test /p:CollectCoverage=true` or `pytest --cov=src`, add more tests |

### Local Mode Issues

| Problem | Solution |
|---------|----------|
| Local issues not creating | Run: `mkdir .frontier/issues -Force` then init config |
| Switching Local to GitHub | Add remote: `git remote add origin <url>`, then run an Frontier command to auto-switch provider and sync the full local backlog |

### Common Error Messages

| Error | Solution |
|-------|----------|
| `VALIDATION_FAILED` | Run `validate-handoff.sh <issue> <role>` to see details |
| `STATUS_NOT_READY` | Wait for previous agent to finish |
| `PERMISSION_DENIED` | `chmod +x script.sh` |
| `GH_AUTH_REQUIRED` | `gh auth login` |
| `ISSUE_NOT_FOUND` | Verify issue number exists |

### Debug Commands

```bash
gh run list --limit 5            # Recent workflow runs
gh run view <run-id> --log       # Specific run logs
DEBUG=1 ./validate-handoff.sh 123 engineer  # Debug mode
```

### Getting Help

- [GitHub Issues](https://github.com/jnPiyush/AgentX/issues) with `type:bug` label
- Include reproduction steps

---

## Useful Links

| Resource | Description |
|----------|-------------|
| [AGENTS.md](../AGENTS.md) | Agent roles, workflow, classification rules |
| [Skills.md](../Skills.md) | 62 production skills index + workflow scenarios |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to contribute to Frontier |
