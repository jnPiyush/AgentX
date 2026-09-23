# CLAUDE.md - Entry Point for Claude Code

Claude Code loads this file at session start. The shared Frontier contract
(quality loop, gates, classification, commits, security) lives in `AGENTS.md`
and is imported below instead of being copied, so both stay in sync.

@AGENTS.md
@.github/instructions/project-conventions.instructions.md
@.github/instructions/memory.instructions.md

Honesty rule: report loop and gate state from `.agentx/frontier.ps1 loop status`
and the staged artifacts; never claim a check or review happened without evidence.

---

## Loading Rules For Claude Code

Claude Code does not apply `applyTo` patterns, so read the matching file when you
edit these paths:

| File pattern | Read |
|--------------|------|
| `*agent*`, `*llm*`, `*workflow*` | `.github/instructions/ai.instructions.md` |
| `*.py`, `*.pyx` | `.github/instructions/python.instructions.md` |
| `*.cs`, `*.csx` | `.github/instructions/csharp.instructions.md` |
| `*.ts` (backend) | `.github/instructions/typescript.instructions.md` |
| `*.tsx`, `*.jsx`, `components/`, `hooks/` | `.github/instructions/react.instructions.md` |
| `*.tf`, `*.bicep`, `*.razor`, `*.sql`, `*.yml`, `api/`, `**/ux/**` | the matching skill listed in `Skills.md` |

Agent definitions live in `.github/agents/` and templates in `.github/templates/`;
load only the active agent's file.

---

## Claude Code Commands

All 18 command-backed agents are available as `/project:` slash commands in Claude Code via `.claude/commands/` (other internal sub-agents remain invisible):

| Command | Agent | Purpose |
|---------|-------|---------|
| `/project:frontier` | Frontier (Hub) | Route work to specialist agents based on type and complexity |
| `/project:product-manager` | Product Manager | Create PRD, break Epics into Features and Stories |
| `/project:ux-designer` | UX Designer | Wireframes, HTML/CSS prototypes, WCAG 2.1 AA |
| `/project:architect` | Architect | ADR with 3+ options, Tech Spec with diagrams |
| `/project:engineer` | Engineer | Implement code, tests (80% coverage), quality loop |
| `/project:reviewer` | Reviewer | Code review (8 categories), approve or reject; also reviews standalone human-written architecture docs (`.md`/`.docx`/`.pptx`/`.pdf`/diagrams) via the Architecture Reviewer sub-agent |
| `/project:reviewer-auto` | Auto-Fix Reviewer | Review + auto-apply safe fixes |
| `/project:devops` | DevOps Engineer | GitHub Actions pipelines, deployment automation |
| `/project:data-scientist` | Data Scientist | ML pipelines, evaluations, drift monitoring |
| `/project:tester` | Tester | Automated testing, certification reports |
| `/project:fabric-engineer` | Fabric Engineer | Fabric Lakehouse, Warehouse, notebooks, pipelines, and data quality |
| `/project:power-platform-builder` | Power Platform Builder | Unpacked Power Platform solution source and package validation |
| `/project:powerbi-analyst` | Power BI Analyst | Power BI reports, DAX measures, semantic models |
| `/project:consulting-research` | Consulting Research | Domain-expert consulting research, client-ready materials |
| `/project:github-ops` | GitHub Ops | GitHub issue triage, sprint planning, backlog management |
| `/project:ado-ops` | ADO Ops | Azure DevOps work items, sprint planning, PRD decomposition |
| `/project:ado-prd-to-wit` | AzDO PRD to WIT | Analyze PRDs and plan ADO work item hierarchies for execution |
| `/project:agile-coach` | Agile Coach | Story creation, refinement, INVEST compliance |

**Usage**: Type `/project:engineer Implement the health endpoint for issue #1` in Claude Code.

Each command file contains the agent's constraints, boundaries, execution steps, and self-review checklist. It also instructs Claude to `read_file` the full agent definition at `.github/agents/` for retrieval-led reasoning.
