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
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v9.7.0/install.ps1 | iex
```

```bash
# Bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.7.0/install.sh | bash
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
.\.frontier\runtime\local-issue-manager.ps1 -Action create -Title "[Story] Add /health endpoint" -Labels "type:story"
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
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v9.7.0/install.ps1 | iex    # PowerShell
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.7.0/install.sh | bash  # Bash
```

PowerShell install path note:
`install.ps1` requires PowerShell 7.4+ (`pwsh`). If you are on older Windows PowerShell, install PowerShell 7 and rerun with `pwsh -File .\install.ps1`.

PowerShell 7.4+ is also required on Linux/macOS: the Bash CLI launcher delegates
to `pwsh`. Installers preserve an existing `.vscode/mcp.json`, including during
forced setup; merge any new server configuration explicitly.

On macOS, use PowerShell 7.4+, Git, Node.js, and VS Code 1.134+ for the extension.
The canonical CLI entry points are `bash .frontier/runtime/frontier.sh` and
`pwsh .frontier/runtime/frontier.ps1`; there is no legacy wrapper. The Bash
launchers are tracked executable and the installer enables their executable
permissions. Extension commands preserve literal argument strings in both Bash
and PowerShell, and PowerShell version detection does not invoke an intermediate
shell.

The `Quality Loop` jobs in `.github/workflows/quality-gates.yml` run launcher,
shell-argument, review-state, parity, rollback and code-quality tests on native
Ubuntu and macOS runners. A configured job is not a passing result: inspect its
run for the current commit before claiming native platform verification.

Quality loops and reviews do not execute test suites. They use acceptance
mapping, independent review and non-test verification such as builds,
typechecks, lint and schema checks. Tests can be authored and inspected without
being reported as executed.

After successful `loop complete`, the owning agent asks whether to run the
test suite and waits. The VS Code completion command offers **Run Test Task**
or **Not Now**. Run Test Task uses VS Code's configured test task; configure a
task in the `test` group if your workspace has none. It does not guess a shell
command or report a test pass merely because the task was opened. Terminal and
MCP completion output includes the same question for the host to surface.

Approval to test is not approval to edit source or bypass workspace guards.
Use the host test runner/configured task. If a host's terminal-write guard
blocks an agent after loop completion, run the agreed command directly in
your terminal; do not reopen a loop merely to unlock a test run.

Declining or dismissing the offer leaves suites not run and coverage not
measured. Approval starts a separate verification task. A failing suite still
requires investigation; code corrections use a new fix/review loop.

`--passing` remains optional metadata for actual supplied test evidence. An
integer baseline no longer forces a count when tests are deferred. Explicit
malformed or lower counts still fail; omission never invents a zero/pass count.
The editor no longer asks for test counts during iterate/complete.
`frontier loop affected` only lists candidate tests for the post-loop offer.

CI jobs and mandatory release/certification checks remain unchanged. Local
code-review approval is not a waiver of those gates or a claim that tests pass.

### Advisory lint and optional cleanup

Lint/hygiene checks still run during loops and reviews, but cosmetic findings
are LOW advisories rather than local Done Criteria. Use:

```powershell
pwsh .\.frontier\runtime\frontier.ps1 scrub -Path <changed-area> -Advisory
```

The scan is read-only. It preserves original tool severity and strict-gate
metadata, reports LOW candidates and does not block local completion for those
findings. A scan failure is still an error, and exit code zero does not mean
lint is clean. `-Advisory` cannot be combined with `-Fix` or `-Production`.

The owning agent reports affected files and asks whether you want cleanup.
No affirmative answer means no fixes. Approved cleanup is a separate bounded
task; it is not silently added to feature work. Build/type errors and proven
correctness, security, reliability or accessibility defects retain their
impact-based severity. CI, commit and production checks may still enforce
their existing rules; advisory handling does not waive them.

### Recovering evidence verification

Loop audit subprocesses drain stdout and stderr concurrently under a 30-second
deadline; the code-quality evaluator has 90 seconds, leaving headroom within the
extension's two-minute command limit. A timeout or nonzero checker exit is a
failure, never evidence approval. Completion checks passing counts and final
artifact freshness before the expensive evaluator.

- Checker timeout/startup failure: inspect the reported checker and its dependencies,
  then retry; do not regenerate unrelated test suites or disable verification.
- Missing count: omit it while suites are deferred. Explicit regressed counts
  remain invalid; report the real evidence and offer any retest after the loop.
- Stale final evidence: run a fresh, scoped final check after the review iteration
  and submit its real output. Never touch timestamps or copy old evidence to pass.
- Changed hashes or review findings: refresh non-test checks and obtain a new
  review; suite execution still needs the separate post-loop decision.
- Complete the loop before committing; an active loop is rejected by the commit hook.

Engineer, Architect and UX Designer request GPT-6 Astra; every other agent
requests Claude Opus 5.5. Cross-family review requires a separately invoked
reviewer and host-confirmed model selection. The CLI's automatic self-review
reuses the author's model and effort. Astra resolves only on Copilot without
silent substitution. Opus 5.5 uses adaptive thinking without sampling parameters;
each account must expose the selected model.

Frontier workspaces keep a repository graph that initialization builds in the
background and session starts refresh when stale; sessions receive a bounded
primer and task-specific source pointers without waiting for discovery. Run
`frontier context -q "<task>"` to query it or `frontier context --sync` to update it now.
See [Repository graph context](guides/REPOSITORY-CONTEXT.md) for curation,
incremental refresh, output limits and host-specific startup behavior.

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

Configuration, issues, state, sessions, memory and digests are preserved under
`.frontier/`, alongside the tracked runtime code in `.frontier/runtime/`. Legacy
`.agentx/` and `.hve/` state is not read and not migrated: the runtime ignores
those folders and leaves them untouched. Copy anything you still need out of them
manually, then delete them.

### Frontier-only interfaces

AgentX/HVE compatibility aliases are no longer supported. Update automation and
configuration to current names before using the runtime:

- Use `frontier.*` editor settings and commands and `frontier_*` MCP tools.
- Use `FRONTIER_WORKSPACE_ROOT`, `FRONTIER_REPO_ROOT` and
  `FRONTIER_EXTENSION_ROOT` for workspace, server and launcher configuration.
  Old `AGENTX_*` and `HVE_*` variables are ignored.
- Use `FRONTIER_*` provider options, such as `FRONTIER_LLM_PROVIDER` and
  `FRONTIER_OPENAI_BASE_URL`. Provider-standard secrets such as `OPENAI_API_KEY`
  and `ANTHROPIC_API_KEY` retain their meaning.
- Installer overrides use `FRONTIER_MODE`, `FRONTIER_PATH`, `FRONTIER_AZURE`,
  `FRONTIER_NOSETUP` and `FRONTIER_INSTALL_ARCHIVE`. The old `AGENTX_LOCAL=true`
  shorthand was removed; use `FRONTIER_MODE=local`.
- The MCP package exposes only the `frontier-mcp` executable; `agentx-mcp` was
  removed. User-level installers leave an existing `mcpServers.agentx` entry in
  place because they do not own it. Delete that entry from your MCP client
  configuration after confirming the `frontier` entry works, so the same tools
  are not registered twice.
- Re-enter editor credentials under the Frontier namespace if they were saved
  only under AgentX/HVE keys. Those old secrets are not read, migrated or deleted.
- Plugin manifests and registry entries use `engines.frontier`, not
  `engines.agentx` or `engines.hve`. The plugin catalog skips releases and plugin
  folders that still declare the old keys instead of failing as a whole.
  Bundled plugins declare `>=8.4.0 <10.0.0`. Add Plugin prefers these compatible
  installed sources, so ordinary installs need no catalog download. If bundled
  sources are unavailable, it checks the published catalog, then the compatible
  source archive. Temporary extraction lasts through selection and installation.
  The source registry currently has no verified published releases; old 8.x
  records and placeholder checksums are not offered as current artifacts.
  Publishing compatible archives with measured checksums is a separate release
  operation, not a compatibility-range edit.
- Use the `frontier` orchestration role ID in native requests and handoffs.
- Council files written with the old `agentx:role-instruction` marker fall back
  to the other role-instruction resolution paths. Re-run the council to record the
  `frontier:role-instruction` marker.

The published `jnPiyush.agentx` extension ID and `jnPiyush/AgentX` repository
coordinate remain unchanged. Current Frontier version upgrades, state modes and
ownership checks remain supported; retiring old product aliases does not remove
their safety checks.

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
PROFILE=python curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/v9.7.0/install.sh | bash
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
instruction files directly to the host without copying those framework trees
into your workspace. Initialization still writes workspace configuration,
state and terminal launchers.

For the smallest initial scaffold, configure:

```json
{
  "frontier.initializationMode": "minimal",
  "frontier.seedRepoLocalAssets": false
}
```

Ordinary extension use now provisions private state lazily; repository setup is
optional. For these portable launchers run `Frontier: Initialize Repository
Support`, not `Initialize CLI`. The generated
launchers also support Frontier terminal commands:

```powershell
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 help
```

Minimal mode skips starter memory files and empty documentation/output
directories; those can be created when work needs them. It preserves existing
files and requires asset seeding to be disabled. The default `standard` mode
retains the previous scaffold. See the [initialization
contract](../vscode-extension/README.md#minimal-workspace-setup) for the exact
files and the conditional GitHub MCP configuration.

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

The repository root ships a `plugin.json`. A managed plugin installation keeps
its framework assets outside each application workspace:

```bash
copilot plugin install jnPiyush/AgentX
copilot plugin list
```

Alternatively, launch Copilot from your application directory and point
`--plugin-dir` at one shared Frontier checkout. On Windows, for example:

```powershell
copilot --plugin-dir "C:\Tools\AgentX" plugin list
copilot --plugin-dir "C:\Tools\AgentX"
```

Replace the example path with your shared checkout. This does not install the
VS Code extension or initialize Frontier state, and a managed plugin has its
own version/update lifecycle.

Plugin discovery is not a full workflow compatibility test. Current Frontier
hooks and some gate commands contain workspace-relative paths. Before relying
on a plugin-only application workspace, verify hook execution, reference
resolution, and gate output locations. Do not assume `--plugin-dir` rewrites
shell commands or makes every workflow portable. Use the bundled Frontier CLI
launchers for Frontier runtime operations; use workspace seeding below when
repo-local Copilot assets are required.

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
| `symlink` | Links the eight `.github/` asset trees to the installed bundle; copies supporting files | Single-user, reduced duplication; linked entries are gitignored. Activation detects broken recorded targets and matching versioned installs in this host's extension directory, then offers an explicit Repair links action |

Select the desired mode in the initialization dialog. Symlink mode still copies
supporting docs, scripts, evaluation rubrics, packs, runtime plugins and
standalone reference documents. Existing real directories are preserved, not
converted to links. Neither setting changes nor reinitialization remove old
copies; cleanup requires distinguishing generated files from project content.

Seeding never overwrites existing files, and never writes host-owned files such
as `.github/workflows`, `.github/ISSUE_TEMPLATE`, `CODEOWNERS` or `LICENSE`.

If you run both the extension and workspace seeding, suppress duplicate agent
registrations so each agent appears once in the picker:

```jsonc
// .vscode/settings.json
{
  "frontier.useBundledAgents": false,
  "chat.agentFilesLocations": { ".github/agents": true }
}
```

This selects workspace agents instead of extension agents. Reload the window
and start a new agent session after changing the selection.

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

### Guided Interaction

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

### HydraFusion Execution Engine

HydraFusion is an opt-in, experimental candidate generator. GitHub chooses its
Single, Cascade or Critique workflow; Frontier owns isolation, budgets,
validation and acceptance. Native execution remains the default. Use this
initial pilot for bounded read/edit tasks, not unattended deployment, shell
automation or a replacement for independent review.

Native entry requires `--interaction autonomous` for the explicitly authorized
candidate task. MCP obtains that authorization through client form elicitation.
Selecting `executionEngine=hydrafusion` alone does not grant it.

Requirements are Copilot CLI 1.0.89 or later with the required isolation flags,
a supported Copilot account, Git, PowerShell, an initialized Frontier workspace
and an active owner quality loop. The adapter runs the CLI in a private home;
authentication is supplied only through its process environment using
`COPILOT_GITHUB_TOKEN` or Frontier's existing GitHub-token helper.

Set an explicit aggregate credit budget in `.frontier/config.json`; the following
is an example budget, not an estimated charge:

```json
{
  "executionEngine": "native",
  "hydrafusion": {
    "maxAiCredits": 60,
    "timeoutMinutes": 15,
    "maxAttempts": 2
  }
}
```

```powershell
.\.frontier\runtime\frontier.ps1 engine
.\.frontier\runtime\frontier.ps1 loop start -p "Implement the login form"
.\.frontier\runtime\frontier.ps1 run engineer "Implement the login form" --engine hydrafusion --max 12
```

`engine` inspects CLI version/capabilities without a model call; it does not
verify account entitlement or certify production readiness.

#### Candidate lifecycle

1. Capture eligible current working-tree bytes, including dirty and untracked
   inputs, in an independent snapshot repository outside the source checkout.
   No Git metadata, remote, hardlink or branch is shared with the original.
2. Generate a temporary unpinned agent and a native `preToolUse` policy. Only
   contained read/search/edit tools are available. Shell, web, MCP and nested
   agent tools are unavailable; extra `allowTools` grants are rejected.
3. Run one bounded CLI attempt. Require a resolved HydraFusion route, matching
   phase completions, a successful terminal result and well-shaped usage data.
   Exceptions and cancellation stop the owned process before artifacts freeze.
4. Audit the full candidate filesystem, independently of the CLI's change list.
   Check additions, deletions, rename sources, ignored additions, links and
   protected paths. Save a binary-capable patch and content/policy hashes.
5. Return `candidate_ready` with exit code `3`. The source checkout is unchanged.
   `watch`, `sprint` and MCP treat this as pending rather than delivered work.
   The `ship` delivery wrapper refuses to advance while a candidate is pending.
6. A separate reviewer inspects the frozen candidate. The owner records that
   review, then explicitly accepts it. Promotion verifies the source baseline,
   exact candidate bytes, policy and approval before applying any patch.
7. The applied revision remains `applied_pending_verification`. Verify the actual
   source revision and obtain a fresh independent review before completing the
   owner loop. Candidate approval alone cannot satisfy `loop complete`.

Records and the owner-loop budget ledger live in
`.frontier/state/hydrafusion/`. The record identifies the retained temporary
workspace, patch, response and hashes; the task itself is stored only as a hash
in Frontier's record. The private CLI profile is removed after confirmed
termination. Inspect or discard owned artifacts with:

```powershell
.\.frontier\runtime\frontier.ps1 engine inspect <candidate-id> --json
.\.frontier\runtime\frontier.ps1 engine discard <candidate-id>
```

The host-side record, process receipts and budget ledger are durable under
`.frontier/state/hydrafusion/`; they do not depend on the temporary snapshot
surviving OS cleanup. Losing that snapshot prevents new acceptance or refinement,
but a stopped, unpromoted record can still be discarded. Already applied work
still needs final source review, and losing temporary files does not erase that
review obligation or block a review that was properly completed.

Discard is only for candidates that have never started promotion. Applied,
mid-apply and recovery-required records cannot be erased with this command.
The delivery gate checks every attempt, not just the latest; only the latest
settled candidate can be accepted. A discarded task still needs a fresh
independent source review before the owner loop can complete.

#### Independent review and promotion

Use the canonical code-quality rubric against the retained candidate workspace.
The report also needs `verdict` and a `candidate` object containing the exact
`runId`, `baselineSha256`, `patchSha256`, `responseSha256`, `manifestSha256` and
`policySha256` values shown by `engine inspect`. Do not synthesize reviewer
scores or treat the worker's own response as an approval.

The review file MUST be under the source workspace's `.frontier/state/`, outside
the candidate. The owner records the actual independent review through the
existing loop mechanism:

```powershell
.\.frontier\runtime\frontier.ps1 loop iterate -s "Independent candidate review" -e .frontier\state\candidate-review.json --verdict approved --reviewer <reviewer-id> --high 0 --medium 0 --low 0
.\.frontier\runtime\frontier.ps1 engine accept <candidate-id> --review .frontier\state\candidate-review.json
```

An approval label is insufficient: the report digest must match the archived
owner-loop evidence, all candidate bindings must match, and the canonical
validator must accept the report. The host/controller is trusted to attest
actual reviewer independence; hashes prove content binding, not human identity.

Promotion needs a quiescent checkout. Frontier's lock serializes Frontier
operations, not unrelated editors. Drift or conflicts reject promotion; an
interrupted or partially failed application is `recovery_required`. Inspect
the source and retained candidate rather than rerunning or rolling back the
whole working tree automatically. Application does not stage or commit files.

#### Interrupted execution recovery

Each launch writes a host-owned process receipt containing PID, executable and
process-start identity; PID reuse does not authorize terminating another
process. A durable zero-usage `preparing` record precedes budget reservation, so
setup failures before scratch creation remain recoverable. Cancellation records
a stopped terminal state even when PowerShell
skips its `catch` block. If an outer host terminates the owner before `finally`
finishes, use:

```powershell
.\.frontier\runtime\frontier.ps1 engine recover <candidate-id>
.\.frontier\runtime\frontier.ps1 engine discard <candidate-id>
```

Recovery acquires the workspace lock, stops the recorded child if necessary,
reconciles the active ledger marker once, and marks billing unknown rather than
refunding the attempt. It never promotes output or authorizes another model
call. Repeating recovery after a partial ledger write is safe; a completed
failure retains its original status, reason and known billing. A missing receipt
or interruption before child identity capture cannot
be repaired by guessing a PID: confirm process-tree shutdown externally and
cancel that owner loop explicitly. Recovery does not resolve a partial source
promotion; retain those artifacts for manual postimage inspection.

For `applying` or `recovery_required` after promotion, stop editing and inspect
the candidate manifest and the actual source files. Manually finish the named
changes or restore their recorded preimages without touching unrelated user
work. Then cancel the old owner loop and start a new one with
`--include-existing-changes`, referencing the retained run ID and recovery
evidence. Verify the repaired source and obtain a fresh independent review in
that loop before completion. Do not repeatedly call accept, or delete records
to bypass this recovery boundary.

#### Bounded refinement and budgets

- There are no automatic retries, fallbacks or unbounded self-review loops.
  Default maximum is two attempts; the configurable range is one to three.
- Attempt two needs independently recorded `changes-requested` feedback bound
  to attempt one's candidate, with a nonempty `feedback` string in the report.
  Repeat the same task/role with `--feedback <report.json>`. A patch or no-change
  response repeated from any earlier attempt stops as `no_progress`, including
  an A-to-B-to-A cycle.
- One locked owner-loop ledger reserves attempts and accumulates observed model
  calls, credits and active elapsed time. A fresh run ID cannot reset it.
  Unknown usage blocks another attempt; failures and rejected work are retained.
- `--max` limits observed model-call starts across the task, including compound
  legs. A call-start event can arrive after dispatch, so termination is not a
  guarantee of zero overshoot. Copilot's AI-credit cap is also soft.
- Credit budgets must be explicit integers from 30 to 100000. Time budgets are
  one to 120 minutes across attempts; insufficient remaining budget stops work.
  MCP adds its existing ten-minute transport deadline and passes a shorter
  inner deadline to leave cleanup time. Forced transport termination can still
  require `engine recover`.
- Native `harness.tokenBudget`, `--model`, native-session resume and extra tool
  grants are unsupported by this adapter and rejected rather than silently
  ignored. Choose `--engine native` when those contracts are required.

#### Isolation limits and pilot qualification

Snapshot limits are 20000 files, 32 MiB per file, 512 MiB total and 100000
filesystem entries. Excluded inputs include secrets, links, generated/vendor
output, mutable Frontier state and executable discovery configuration.
Omissions are recorded; if required context is excluded, use the native engine.

Private configuration and explicit native hooks prevent inherited permission
approvals from authorizing model edits. Hook errors deny operations; GitHub
documents hook timeouts as fail-open, so there is no blanket write grant and
candidate validation remains independent. This is application-level isolation,
not an OS sandbox against a malicious CLI binary or administrator.

Earlier one-file smoke runs established that CLI delegation can work, not that
HydraFusion beats the current native model configuration. Before expanding this
pilot, compare matched, representative coding tasks with the same acceptance
checks and budgets. Record accepted-task success, all-attempt cost, latency,
review effort and failure/cancellation behavior. Missing measurements remain
unknown. Live comparisons require an explicit budget; offline fixtures do not
establish model quality or cost savings.

References: [HydraFusion announcement](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/),
[Copilot CLI command reference](https://docs.github.com/en/copilot/reference/cli-command-reference),
and [custom agent tool aliases](https://docs.github.com/en/copilot/reference/custom-agents-configuration#tool-aliases).

---

## Cursor

Cursor uses thin commands and rules over the installed Frontier runtime. It does
not need copied agent or skill trees.

### Extension-based setup

1. Install/update Frontier and run `Frontier: Initialize Repository Support` in the
   target workspace.
2. Run `Frontier: Initialize Cursor`. This configures the 18 role commands,
   scoped rules, native hooks and workspace-bound MCP entry.
3. Reload Cursor if its command or hook discovery has not refreshed.

PowerShell 7.4+ and Node.js 18+ must be available to the editor's child processes.
The extension includes the pinned MCP server/SDK. Setup does not download
dependencies or change global settings. Existing user servers, hooks and custom
rules are preserved; a conflicting `frontier` server name or malformed JSON is
reported rather than overwritten.
Setup also rebinds managed workspace launchers to this installation. The
Cursor-bound launcher prefers that runtime, then its version-directory siblings
and Cursor extension locations if an update removes it. It does not select a
newer unrelated VS Code installation. Explicit runtime overrides must support
Cursor. Setup and MCP use the same workspace launcher.

### Standalone setup

Use `install.ps1 -Cursor` or `install.sh --cursor` to configure Cursor during
installation. Otherwise the installer leaves MCP/native-hook registration
disabled until this explicit step:

```powershell
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor setup --restore-mcp
```

Restoration uses the existing MCP lock with `npm ci --ignore-scripts --omit=dev`;
no global npm installation occurs. A dependency failure prevents registration.
Do not use restoration to modify an installed extension: update/reinstall the
extension if its bundled dependencies are missing.

Re-run setup after updating Frontier. Unmodified Frontier-owned files and
recognized legacy wrappers can update; edited overrides are preserved and listed.
The installer also preserves shared Cursor JSON during force upgrades.
Concurrent setup operations are rejected. After an interrupted setup, confirm
its process has stopped before removing `.frontier/cursor-setup.lock` and retrying.
The source manifest marks shared MCP/hook JSON. Installers project that inventory
onto the deployed layout: optional user JSON is excluded, while all 26 private
canonical templates are tracked. Thus installs without Cursor opt-in do not
report missing user configuration or claim ownership of unrelated user servers.

### Runtime and hook behavior

```powershell
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor status
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor read .github/AGENT-PROTOCOL.md
pwsh -NoProfile -File .\.frontier\runtime\frontier.ps1 cursor read .github/agents/engineer.agent.md
```

The read command resolves canonical framework contracts from the installed
runtime. Follow referenced contract paths through the same command; application
source and deliverables remain in the consumer workspace.
For gate scripts not wrapped by a Frontier command, `cursor status` reports
`assetRoot`. Use the script under that root and explicitly pass its workspace
selector (for example, `-WorkspaceRoot` for `score-code-quality.ps1`).

Native `sessionStart` injects the cached graph primer using Cursor's
`additional_context` contract. It does not start a quality loop. Native
`preToolUse` maps Cursor tools to the existing Frontier policy engine and emits
Cursor permission responses. Hook errors deny tool execution; session-context
failures provide explicit fallback guidance. Run shell tools from the workspace
root so relative paths have the same meaning to the host and policy engine.
MCP tools retain the shared policy's behavior and the host/server permission
boundaries; the Cursor adapter does not introduce a separate MCP authorization
policy or require an editing loop merely to inspect another server's data.
Direct MCP file-write methods are denied even when Cursor omits the provider
name. Read-only tools and subagent dispatch do not require an editing loop.

MCP uses a small Node launcher that resolves the current runtime through the
workspace wrapper before opening the protocol stream. This avoids persistent
stdio buffering through nested PowerShell script launchers. The SDK and server
remain in the installed runtime; they are not copied into the workspace.
Startup resolution is metadata-only, so the SDK loads once in the server.
The resolver allows up to 120 seconds for a cold, busy desktop and reports a
retry/restart instruction on timeout without retrying automatically. Policy
processing has a 30-second inner deadline inside a 60-second host-hook budget;
permission failures still deny the action.
Reinstalling the local runtime preserves the Cursor binding when its setup
ownership record is present.

Native hooks use the Node launcher `.frontier/runtime/cursor-hook.js`. It caches
the resolved runtime in `.frontier/state/cursor-runtime.json` and resolves it again
when the workspace wrapper changes or the cached runtime disappears. Read-only
tools never start PowerShell. Only policy-checked tools start the PowerShell
policy engine. Setup migrates unchanged PowerShell hook entries from earlier
releases. It removes unmodified commands and rules that Frontier installed but no
longer ships, and preserves edited ones.

The canonical risk-based loop, independent review and post-loop test-consent
rules apply; Cursor no longer has a separate five-iteration minimum. These hooks
are application-level controls, not an OS sandbox. Disabling hooks disables that
host enforcement. Cursor's cloud-host hook support may differ; local protocol
checks do not establish live or cross-platform Cursor qualification.

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

When the `claude-code` provider is used through `.frontier/runtime/agentic-runner.ps1`, the bridge runs in text-only mode with `--permission-mode dontAsk` and no Claude-native tools. Native Read/Write/Edit/Grep/Glob/Bash execute inside the Claude process and cannot pass through Frontier workspace-path, boundary, or command guards, so they remain disabled until a guarded MCP adapter is available. Use the Copilot or direct API adapters when an Frontier run requires tool execution.

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
.\.frontier\runtime\frontier.ps1 ready

# Step 3: Update status as work progresses
# If .frontier/config.json includes a GitHub project number, the CLI also syncs
# the Project V2 Status field for these transitions.
.\.frontier\runtime\frontier.ps1 issue update -n 42 -s "In Progress"
.\.frontier\runtime\frontier.ps1 issue update -n 42 -s "In Review"

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
.\.frontier\runtime\frontier.ps1 config set enforceIssues true

# Disable again:
.\.frontier\runtime\frontier.ps1 config set enforceIssues false
```

### Issue Management

```powershell
# Create issue
.\.frontier\runtime\local-issue-manager.ps1 -Action create `
    -Title "[Story] Add user login" `
    -Body "Implement user authentication" `
    -Labels "type:story"

# List all issues
.\.frontier\runtime\local-issue-manager.ps1 -Action list

# Get specific issue
.\.frontier\runtime\local-issue-manager.ps1 -Action get -IssueNumber 1

# Update status
.\.frontier\runtime\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"

# Add comment
.\.frontier\runtime\local-issue-manager.ps1 -Action comment -IssueNumber 1 -Comment "Started implementation"

# Close issue
.\.frontier\runtime\local-issue-manager.ps1 -Action close -IssueNumber 1
```

**Bash (Linux/Mac):**
```bash
./.frontier/runtime/local-issue-manager.sh create "[Story] Add user login" "Implement auth" "type:story"
./.frontier/runtime/local-issue-manager.sh list
```

**Optional alias** (add to `$PROFILE`):
```powershell
function issue { .\.frontier\runtime\local-issue-manager.ps1 @args }
# Then: issue -Action create -Title "[Bug] Fix login" -Labels "type:bug"
```

### Workflow

```
1. Create Issue -> 2. Update Status -> 3. Write Code -> 4. Commit -> 5. Close Issue
```

### File Structure

```
.frontier/                       # Runtime data (git-ignored)
  config.json                    # Provider configuration (`provider` is canonical)
  issues/
    1.json                       # Issue #1 data
    2.json                       # Issue #2 data
  state/
    agent-status.json            # Agent state tracking
  digests/                       # Weekly issue digests
  runtime/                       # Runtime code (tracked)
    frontier.ps1                 # PowerShell CLI launcher
    frontier.sh                  # Bash CLI launcher
    frontier-cli.ps1             # CLI implementation (all subcommands)
    agentic-runner.ps1           # LLM-powered agentic loop runner
    local-issue-manager.ps1      # PowerShell issue manager
    local-issue-manager.sh       # Bash issue manager
```

### Frontier CLI Commands

The CLI works across Local, GitHub, and ADO providers. It resolves the active platform from `.frontier/config.json`, preferring `provider` and falling back to legacy `integration` and `mode` fields.

```powershell
# PowerShell
.\.frontier\runtime\frontier.ps1 ready                          # Show priority-sorted work queue
.\.frontier\runtime\frontier.ps1 state                          # Show all agent states
.\.frontier\runtime\frontier.ps1 state -a engineer -s working -i 42
.\.frontier\runtime\frontier.ps1 deps 42                        # Check issue dependencies
.\.frontier\runtime\frontier.ps1 digest                         # Generate weekly digest
.\.frontier\runtime\frontier.ps1 workflow engineer              # Show workflow steps
.\.frontier\runtime\frontier.ps1 hook -Phase start -Agent engineer -Issue 42
.\.frontier\runtime\frontier.ps1 run engineer "Fix the tests"   # Run agentic loop (LLM + tools)
.\.frontier\runtime\frontier.ps1 config show                    # View current configuration
.\.frontier\runtime\frontier.ps1 backlog-sync github --force    # Force re-sync local backlog to GitHub
```

```bash
# Bash
./.frontier/runtime/frontier.sh ready
./.frontier/runtime/frontier.sh state engineer working 42
./.frontier/runtime/frontier.sh deps 42
./.frontier/runtime/frontier.sh hook start engineer 42
./.frontier/runtime/frontier.sh run engineer "Fix the tests"
```

### Forced GitHub Backlog Re-Sync

If you want to re-apply the current local backlog state to GitHub after the initial migration, run:

```powershell
.\.frontier\runtime\frontier.ps1 backlog-sync github --force
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
.\.frontier\runtime\frontier.ps1 config set enforceIssues true

# Full issue workflow (optional but recommended for complex work):
# Step 1: Create issue BEFORE starting work
.\.frontier\runtime\local-issue-manager.ps1 -Action create `
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
.\.frontier\runtime\frontier.ps1 ready

# Step 3: Update status as you work
.\.frontier\runtime\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
.\.frontier\runtime\local-issue-manager.ps1 -Action comment -IssueNumber 1 `
    -Comment "Started implementation - increasing timeout and adding retry"

# Step 4: Commit with issue reference
git commit -m "fix: resolve login timeout with retry logic (#1)"

# Step 5: Move to review, then close
.\.frontier\runtime\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Review"
# After self-review or peer review:
.\.frontier\runtime\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "Done"
.\.frontier\runtime\local-issue-manager.ps1 -Action close -IssueNumber 1
```

```bash
# Bash equivalent
./.frontier/runtime/local-issue-manager.sh create "[Bug] Fix login timeout" "Fix timeout issue" "type:bug"
./.frontier/runtime/frontier.sh ready
git commit -m "fix: resolve login timeout (#1)"
./.frontier/runtime/local-issue-manager.sh close 1
```

**Emergency bypass**: Add `[skip-issue]` to the commit message. Create a retroactive issue afterward:
```powershell
.\.frontier\runtime\local-issue-manager.ps1 -Action create `
    -Title "[Bug] Fix login timeout" `
    -Body "Fixed in commit abc1234. Retroactive issue for traceability." `
    -Labels "type:bug"
.\.frontier\runtime\local-issue-manager.ps1 -Action close -IssueNumber <ID>
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
.\.frontier\runtime\frontier.ps1 config show

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
| **See pending work** | `.\.frontier\runtime\frontier.ps1 ready` |
| **Check agent states** | `.\.frontier\runtime\frontier.ps1 state` |
| **View workflow steps** | `.\.frontier\runtime\frontier.ps1 workflow engineer` |
| **Check dependencies** | `.\.frontier\runtime\frontier.ps1 deps 1` |
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

### Faster loop preparation without weaker gates

The **Frontier: Iterative Loop** menu includes `preflight`, `review-packet`,
`boundary-review` and `timing`. MCP hosts use `frontier_loop_prepare` with the
corresponding action. The same native commands are available in a terminal:

```powershell
.\.frontier\runtime\frontier.ps1 loop preflight --json
.\.frontier\runtime\frontier.ps1 loop review-packet --stage boundary --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop review-packet --requirements docs\contract.md
.\.frontier\runtime\frontier.ps1 loop reviewer-check --packet <generated-packet-path> --reviewer <id>
.\.frontier\runtime\frontier.ps1 loop timing --phase implementation
.\.frontier\runtime\frontier.ps1 loop timing --phase waiting
.\.frontier\runtime\frontier.ps1 loop timing --stop
.\.frontier\runtime\frontier.ps1 loop timing --json
```

Substitute an existing workspace-relative requirements file for
`docs\contract.md`. Preparation writes only beneath the selected Frontier state
root, including private profiles. `loop start` captures a source baseline;
upgrading during an active older loop uses the whole pending worktree
conservatively instead of inventing an earlier baseline.

Preflight runs built-in non-test checks, not package scripts. It parses changed
PowerShell/JSON, checks JavaScript/TypeScript syntax and common Mocha declaration
placement without executing tests, typechecks affected TypeScript projects, and
runs one batched advisory scrub. Install-manifest and tracked-document mirror
checks apply to a Frontier source checkout before final review and completion.
Ordinary iterations defer delivery checks while the implementation is changing.
Missing required tools, parsing failures and timeouts do not count as passing.
Unsupported languages and actual UI/runtime behavior still require separate
verification evidence.

Successful receipts can be reused only for matching file bytes and membership,
checker/tool identity and workspace/loop identity. Reuse retains the original
execution timestamp and immutable receipt digest; `--force` reruns eligible
checks. JavaScript checks include package parsing-mode inputs; manifest changes
also select unchanged scripts within the affected package. New receipts become
cache-eligible only after the complete input snapshot passes the drift check.
Ancestor package context is compared to the immutable loop-start baseline, so
failed retries cannot drop affected scripts. An older or missing package baseline
selects scripts conservatively rather than assuming that the context was stable.
Typechecks run fresh when the full installed dependency closure is not
fingerprinted, with any incremental/composite metadata redirected to a unique
file in selected state. Cosmetic whitespace does not fail the correctness diff
check; conflict markers and Git errors still do. Receipt corruption fails explicitly. Preflight never installs
dependencies, edits source, executes suites or caches mutation authorization.

Review packets carry full final scope, factual check receipts, requirements
references and prior findings. Follow-ups prioritize changed files and affected
project consumers. Shared-runtime, dependency and contract changes request full
review. This prioritization is not a complete dependency graph and never inherits
approval. The final reviewer still scores the complete final scope.

Run the capability diagnostic in the actual reviewer host. A successful call
proves file/diff access for that caller only; it does not attest model identity
or grant a read-only sandbox. A reviewer without usable tools must report that
before attempting substantive review. Boundary packets guide the existing early
design checkpoint for high-risk work, not another universal approval round.

Timing separates explicitly attributed implementation, verification, review,
rework and waiting wall time. Preflight records its own phase, and final packet
creation starts review attribution. Unreported intervals remain unattributed;
these numbers are not CPU/model time and must not be added to per-check durations.
Review completion and user-approved test execution remain separate milestones.

---

## Troubleshooting

### Installation Issues

| Problem | Solution |
|---------|----------|
| Git hooks not working | Run `frontier hooks install`; it resolves Git's active `core.hooksPath`, installs all three hook sources, and verifies their bytes. |
| Permission denied on scripts | Linux/Mac: `chmod +x .github/scripts/*.sh`; Windows: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| GitHub CLI not authenticated | `gh auth login` (install first: `winget install GitHub.cli` / `brew install gh`) |

### Workflow Issues

| Problem | Solution |
|---------|----------|
| "Issue reference required" error | In local mode: this is now off by default. In GitHub mode: include issue number `git commit -m "feat: add login (#123)"` or bypass with `[skip-issue]` |
| Issue enforcement in local mode | Toggle with `.frontier/runtime/frontier.ps1 config set enforceIssues true` (or `false`) |
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
