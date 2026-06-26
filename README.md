<div align="center">
  <img src="docs/assets/agentx-logo.svg" width="200" alt="AgentX Logo">
  <h1>AgentX</h1>
  <p><strong>Digital Force for Software Delivery</strong></p>
  <p>
    <a href="https://github.com/jnPiyush/AgentX/releases/tag/v8.5.1"><img src="https://img.shields.io/badge/Version-8.5.1-0EA5E9?style=for-the-badge" alt="Version 8.5.1"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-22C55E?style=for-the-badge" alt="Apache 2.0 License"></a>
    <a href="https://securityscorecards.dev/viewer/?uri=github.com/jnPiyush/AgentX"><img src="https://img.shields.io/ossf-scorecard/github.com/jnPiyush/AgentX?style=for-the-badge&amp;label=OpenSSF" alt="OpenSSF Scorecard"></a>
  </p>
  <p><em>Turn AI coding agents into a structured, highly capable development team with routing, domain skills, execution templates, long-term memory, multi-model deliberation, and validation.</em></p>
</div>

---

## Why AgentX?

Zero-shot AI generation is unpredictable for complex software engineering. AgentX introduces a **Harness-Oriented Architecture** that forces AI models to plan, execute, iterate, review, and validate -- just like a high-performing engineering team. Critical decisions are pressure-tested by a **Model Council** of diverse models that debate the call before it ships.

> **"Stop passively generating code. Start autonomously delivering software."**

---

## The AI Development Team

AgentX acts as an autonomous orchestrator, routing tasks to **24 specialized agents** based on required skills.

| Domain | Agents | Deliverables |
|:-------|:-------|:-------------|
| **Product & Design** | Product Manager, UX Designer | PRDs, Wireframes, Prototypes |
| **Architecture** | Architect, Data Scientist | ADRs, Tech Specs, ML Pipelines |
| **Engineering** | Engineer, DevOps | Code, CI/CD, Containerization |
| **Quality & Review** | Reviewer, Tester, Auto-Fix | Code Reviews, Tests, Quality Gates |
| **Analytics & Gov.** | Power BI Analyst, Research | Datasets, M metrics, Industry Briefs |

---

## Domain Skills Library

AgentX is powered by a rich knowledge layer of **127 production skills** distributed across key categories. Agents read peer-reviewed patterns before writing code, ensuring repo-driven accuracy instead of model-memory guesses.

| Category | Example Skills | Purpose |
|:---------|:---------------|:--------|
| **Architecture** | `api-design`, `security`, `database` | System design, performance, and scaling |
| **AI Systems** | `langgraph`, `foundry-sdk`, `genaiops` | Agent orchestration, Foundry implementation, release gates, and evaluations |
| **Development** | `testing`, `error-handling`, `karpathy-guidelines` | Code robustness, linting, and Karpathy-style behavioral guardrails (think-before-coding, surgical changes, assumption audits) against common LLM coding pitfalls |
| **Languages & UI** | `c`, `cpp`, `react` | Native systems work, application stacks, and frontend visuals |
| **Ops & Infra** | `github-actions`, `terraform`, `azure` | CI/CD pipelines, containerization, and IaC |
| **Data & Testing** | `databricks`, `fabric-analytics`, `e2e-testing` | Analytics pipelines, AI data platforms, and verification |
| **Low-Code (Power Platform)** | `dataverse-schema`, `canvas-app-yaml`, `power-automate-flow-json`, `copilot-studio-agents`, `pac-cli` | Generate unpacked Power Platform solution source -- Dataverse tables, Power Apps (canvas + model-driven), Power Automate (cloud + desktop/RPA), Power Pages, PCF controls, Dataverse plugins, security roles, environment variables, and Copilot Studio agents -- ready for `pac solution pack` and import |

---

## Core Capabilities

### 1. The Agentic Loop

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Generate
    Generate --> Verify
    Verify --> SelfReview
    SelfReview --> Generate : Fix Gaps
    SelfReview --> Done : Approved
```
AgentX leverages a robust, iterative execution model. The agent researches the repo, classifies the task, writes code against clear criteria, verifies the result, and loops until the task is definitively "Done."

### 2. Model Council -- Multi-Model Deliberation

**Single-model reasoning is a blind spot. Stress-test the decision, not just the code.**

High-stakes decisions -- PRD scope, ADR options, AI design, code review, and deep research -- are pressure-tested by a three-member council of diverse models that independently debate the call before it ships.

```mermaid
flowchart LR
    Q(["Decision / Artifact"]) --> Analyst["Analyst<br/>Decompose + Evidence"]
    Q --> Strategist["Strategist<br/>Frame + Second-Order"]
    Q --> Skeptic["Skeptic<br/>Contrarian + Failure Modes"]
    Analyst --> Synth{Synthesis}
    Strategist --> Synth
    Skeptic --> Synth
    Synth -->|"Consensus, Divergences,<br/>Blind Spots, Net Adjustment"| Out(["Hardened Deliverable"])
```

- Three roles by design: **Analyst** (evidence), **Strategist** (framing), **Skeptic** (contrarian risk surfacing).
- Five purpose packs: `prd-scope`, `adr-options`, `ai-design`, `code-review`, `research`.
- Agent-internal by default -- the calling agent runs the council and synthesizes silently; the user sees only the hardened output, with the council file available as supporting evidence.
- Optional `-AutoInvoke` for genuine multi-vendor diversity via `gh models`.
- Mandatory for PM, Architect, Reviewer, Data Scientist, and Consulting Research phases on high-stakes work; skip reasons must be recorded.

### 3. Deep Domain Skills
**Repo-driven knowledge, not model-memory guesses.**
AgentX is powered by the explicit knowledge layer defined above. Agents read exact, peer-reviewed technical standards before writing a single line of code. The `karpathy-guidelines` skill is wired into Engineer, Architect, Reviewer, Auto-Fix Reviewer, DevOps, Tester, and Data Scientist to enforce Andrej Karpathy's *think-before-coding, surgical-change, goal-driven* discipline and block the most common LLM coding pitfalls at authoring time.

### 4. Context Compaction
**Long sessions without context amnesia.**
Long-running AI tasks often break token limits. AgentX compacts conversational history once estimated prompt usage crosses 70% of the active model context window, preserving system rules, keeping recent turns verbatim, and replacing older history with a structured continuation summary so the agent remains stable and focused.

### 5. Self Review & Validation Gates
**Trust, but mechanically verify.**
Before any handoff, the active agent rigorously reviews its own work against the Karpathy-guideline checks (assumption audit, minimal-diff, no speculative generality) as well as domain criteria. Complex tasks require evidence-backed execution plans, and HIGH/MEDIUM severity issues block the workflow from advancing until resolved.

### 6. Standardized Templates
Every deliverable -- from PRDs to Tech Specs to Security Plans -- is written into predictable, structured templates. This makes inter-agent handoffs seamless and ensures a consistent paper trail.

### 7. Harness Engineering
Make AI execution durable and resumable. AgentX treats the workspace as the state, utilizing tracked progress files, memory files, and formal architecture decisions to keep execution grounded in reality.

### 8. Knowledge Compounding And Review Intelligence
AgentX now adds explicit brainstorm and compound-loop entry points, ranked planning and review learnings, learning-capture scaffolds tied to the active issue context, advisory agent-native review parity checks, durable review-finding records, and one-step promotion of important findings into the normal backlog workflow.

---

## Architecture at a Glance

```mermaid
flowchart LR
  UI(["User Intent"]) --> Hub{"AgentX Hub"}

  subgraph SpecialistRouting["Specialist Routing"]
    direction LR
    D["Discover and Plan"] --> I["Implement"] --> V["Validate"]
  end

  Hub --> SpecialistRouting

  D -.->|"PM, UX, Architect"| Assets[("Repo Assets")]
  I -.->|"Engineer and Skills"| Assets
  V -.->|"Reviewer, Tester"| Assets
```

- **User Surface:** VS Code extension, Copilot Chat, sidebar views, and CLI
- **Execution Layer:** AgentX Auto orchestrator, specialist phases, iterative loops
- **Knowledge Layer:** 127 skills, 24 agents, 7 instructions, 15 templates, 21 prompts -- all Markdown-defined
- **Control Layer:** Execution plans, repo-local state, automated validation gates

---

## Quick Start

For script-based repo setup and contributor bootstrap steps, see [CONTRIBUTING.md](CONTRIBUTING.md).

If you want to use AgentX from VS Code, the setup flow below covers Marketplace installation, per-workspace initialization, and the basic delivery workflow.

## Setup AgentX In VS Code

If you want to use AgentX from the VS Code Marketplace instead of bootstrapping from the install scripts, use the extension workflow below.

### 1. Install The Extension

Install [AgentX on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jnPiyush.agentx).

Recommended prerequisites:

- VS Code 1.85.0 or newer
- Git available on your PATH
- PowerShell 7.4+ on Windows, or Bash on Linux/macOS
- GitHub Copilot and GitHub Copilot Chat enabled in VS Code

### 2. Initialize Each Workspace

AgentX initialization is workspace-scoped. After you open a repo or project folder in VS Code, run:

```text
AgentX: Initialize Local Runtime
```

You can launch it from the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`, or start the same flow in chat with:

```text
@agentx initialize local runtime
```

What initialization does for the current workspace:

- creates the local AgentX runtime folders and state files
- prepares repo-local execution artifacts such as plans, progress, reviews, and learnings
- writes stable `.agentx/*` workspace entrypoints that delegate into the bundled runtime
- keeps the executable runtime bundled with AgentX while workspace state remains local to the repo

Repeat this step for every new workspace where you want AgentX to run.

### 3. Optionally Connect Remote Systems

If the workspace needs GitHub or Azure DevOps issue and workflow operations, run:

```text
AgentX: Add Remote Adapter
```

You can also start the same flow directly in chat. Common phrases include:

- `@agentx add remote adapter`
- `@agentx connect github`
- `@agentx connect ado`
- `@agentx use local`
- `@agentx switch adapter`

The extension now treats repo-adapter setup as a chat-first workflow. It asks for the next non-secret value in chat, keeps the setup pending between turns, and lets you continue or cancel the flow from follow-up suggestions.

Use local runtime only when you want repo-local planning, implementation, and review without remote backlog integration.

### 4. Switch LLM Adapters For The Workspace

If you want to run AgentX with a different model provider than the default GitHub Copilot path, run:

```text
AgentX: Add LLM Adapter
```

You can also start the same flow directly in chat. Common phrases include:

- `@agentx switch llm`
- `@agentx connect claude`
- `@agentx connect claude local`
- `@agentx connect openai`
- `@agentx use copilot`

The extension now treats LLM setup as a chat-first workflow. It asks for the next non-secret value in chat, keeps the setup pending between turns, and lets you continue or cancel the flow from follow-up suggestions.

Supported workspace adapters:

- `GitHub Copilot` keeps the current default behavior for Copilot Chat and the AgentX CLI runner.
- `Claude Subscription` uses the local Claude Code CLI after `claude auth login` succeeds.
- `Claude Code + LiteLLM + Ollama` keeps Claude Code as the runner transport, but routes requests through an Anthropic-compatible LiteLLM gateway to a local Ollama coding model such as `qwen2.5-coder:14b`.
- `Claude API` uses an Anthropic API key stored in VS Code secret storage.
- `OpenAI API` uses an OpenAI API key stored in VS Code secret storage.

What gets saved for the workspace:

- the active adapter and non-secret provider settings are written to `.agentx/config.json`
- API keys are stored in VS Code secret storage, not in repo files
- the Status sidebar shows the active `LLM Adapter` so you can verify what the runner will use

Security note:

- AgentX does not ask you to paste API keys into the chat transcript.
- When a provider needs a secret, the chat flow switches to VS Code's secure password prompt for that one step and then resumes the conversational setup.

Provider notes:

- `Claude Subscription` requires the Claude Code CLI to be installed and authenticated. AgentX uses Claude Code's official non-interactive print mode for execution.
- `Claude Code + LiteLLM + Ollama` requires Claude Code, a running LiteLLM Anthropic-compatible endpoint, Ollama, and an available local coding model. AgentX stores the local gateway URL in `.agentx/config.json`, stores the optional LiteLLM auth token in VS Code secret storage, and pins runner model routing to the configured local model.
- `Claude API` requires `ANTHROPIC_API_KEY`-equivalent credentials, but the extension stores the key for the workspace and injects it automatically when AgentX runs.
- `OpenAI API` is handled the same way with workspace-scoped secret storage and automatic injection at runtime.

## Build Software With AgentX

Once a workspace is initialized, AgentX can drive delivery from planning through review.

```mermaid
flowchart LR
    I[Install Extension] --> W[Open Workspace]
    W --> R[Initialize Local Runtime]
    R --> B[Brainstorm Or Create Work]
    B --> E[Implement With AgentX]
    E --> V[Review And Validate]
    V --> C[Capture Learnings]
```

### Recommended Flow

One practical way to use AgentX is to walk a small product idea through the same roles your team would normally use. For example, imagine you want to build a simple task-tracker app with user sign-in, a task list, and a status dashboard.

In VS Code, select the role in chat first, then send a prompt like the ones below.

| Step | Role | What To Ask AgentX | Sample Prompt |
|:-----|:-----|:-------------------|:--------------|
| **1. Define the product** | **Product Manager** | Start with the user problem, goals, and acceptance criteria | `Create a PRD for a task-tracker app for small teams with email login, task CRUD, due dates, and a dashboard for overdue work.` |
| **2. Shape the UX** | **UX Designer** | Turn the PRD into flows, screens, and interaction patterns | `Create the user flow and prototype plan for the task-tracker app, covering sign-in, task creation, task filtering, and dashboard views.` |
| **3. Design the architecture** | **Architect** | Define the technical approach, tradeoffs, and implementation boundaries | `Create an ADR and tech spec for the task-tracker app using a web frontend, backend API, persistence, and role-based access.` |
| **4. Implement the app** | **Engineer** | Build the code and tests from the approved scope and spec | `Implement the task-tracker app from the PRD and spec, including authentication, task CRUD APIs, dashboard data, and automated tests.` |
| **5. Review and verify** | **Reviewer** | Run the review workflow and call out risks before completion | `Review the task-tracker implementation for correctness, security, regressions, and missing tests.` |
| **6. Capture reusable learning** | **AgentX Auto** | Save the outcome if the workflow, architecture, or review produced reusable guidance | `Create a learning capture for the task-tracker delivery workflow and major implementation lessons.` |

If you prefer a single orchestrated session, select **AgentX Auto** in chat and use one prompt that lets it route internally:

```text
Build a task-tracker app for small teams. Start by creating the PRD, then produce UX and architecture guidance, implement the app, review it, and capture reusable learnings.
```

### Typical Chat Prompts

```text
[Product Manager selected] Create a PRD for a task-tracker app for small teams
[UX Designer selected] Create the primary flows and screen plan for the task-tracker app
[Architect selected] Create an ADR and implementation spec for the task-tracker app
[Engineer selected] Implement the task-tracker app and its tests from the approved artifacts
[Reviewer selected] Review the task-tracker app implementation before sign-off
[AgentX Auto selected] Create a learning capture
```

### When To Use Which Mode

- Use **AgentX Auto** when you want end-to-end orchestration in one session.
- Use a specialist role such as **Engineer**, **Architect**, or **Reviewer** when you want tighter control over one phase.
- Use the Command Palette and sidebars when you want a more guided, visual workflow inside VS Code.

---

## New In 8.5.1

- Cursor-native workspace support now ships with AgentX-owned `.cursor/rules/*.mdc`, `.cursor/mcp.json`, and `.cursor/commands/*.md` wrappers over the canonical AgentX agent definitions
- Installers preserve user-owned Cursor files by managing only the AgentX-owned Cursor adapter paths
- `agentx scrub` is now routed through the agentx CLI so it resolves the bundled scanner in zero-copy workspaces initialized via **AgentX: Initialize Local Runtime**
- Added `council` / `model-council` CLI commands; `model-council.ps1` now honors `AGENTX_WORKSPACE_ROOT` so COUNCIL files land in the user workspace, not the extension bundle
- Normalized 11 documentation references from `pwsh scripts/model-council.ps1` to `pwsh .agentx/agentx.ps1 council`, and bundled `model-council.ps1` into the extension asset list
- Release assets regenerated, including pack manifests, installers, package metadata, bundled VS Code assets, and the VSIX package

## Main Repo Areas

- `AGENTS.md` - Top-level guidance and routing rules
- `docs/WORKFLOW.md` - Workflow and handoffs
- `Skills.md` - Complete skill index
- `.github/agents/` - Individual agent definitions
- `.github/skills/` - Reusable implementation knowledge
- `vscode-extension/` - VS Code extension source
- `.agentx/` - workspace launchers and local workflow state
- `packs/` - optional capability bundles (e.g. [Power Platform Builder Pack](packs/agentx-power-platform-builder/README.md) -- low-code-builder agent + 12 Power Platform / Copilot Studio skills)

## Read More

- [AGENTS.md](AGENTS.md)
- [docs/WORKFLOW.md](docs/WORKFLOW.md)
- [docs/GUIDE.md](docs/GUIDE.md)
- [Skills.md](Skills.md)

## Related Work

AgentX is developed independently and predates this comparison. During a recent review we read [obra/superpowers](https://github.com/obra/superpowers) (a Claude-Code-shaped TDD methodology with strong verification, debugging, and worktree skills) and used it as a benchmark for a few specific AgentX subsystems. We did not vendor Superpowers code and we deliberately did not adopt its single-spec folder, "iron-law" absolutism, or step-level plan format, because those conflict with AgentX's multi-agent, multi-domain, multi-provider design. Concrete adoption decisions (verification-before-completion skill, systematic-debugging skill, first-class worktree workflow, two-pass review separation) are tracked in the repo rather than claimed here.





