% Frontier Corp
% Forward Deployed Engineers for Hypervelocity Engineering
% v9.2.0

# Stop generating code. Start delivering software.

## The Problem

- Zero-shot AI coding is unpredictable on real engineering work
- Single-model reasoning has blind spots
- No memory, no review, no validation across sessions
- Teams ship AI slop, then spend weeks cleaning it up

## What Frontier Is

A governed engineering platform that deploys specialized AI Forward Deployed Engineers (FDEs) across the software lifecycle.

- 26 specialized FDEs with strict role contracts
- 134 production skills loaded on demand (not from model memory)
- Multi-model **Council** debates high-stakes decisions
- Plan -> Work -> Review -> Capture loop, enforced

## The Frontier FDE Fleet

| Domain | FDE specialties |
|---|---|
| Product & Experience | Product, Experience, Agile |
| Architecture & AI | Architecture, AI Systems, RAG |
| Engineering | Engineering, DevOps, Fabric |
| Quality | Review, Test, Auto-Fix |
| Platform & Operations | Power Platform, Power BI, GitHub, ADO |

The Frontier Orchestration FDE coordinates work based on type, complexity, and evidence.

## Skills Library - Retrieval Over Recall

FDEs read peer-reviewed patterns **before** writing code.

- Architecture: api-design, security, database, performance
- AI Systems: langgraph, foundry-sdk, rag-pipelines, evaluation
- Languages: C#, Python, TypeScript, React, Rust, C++
- Ops: GitHub Actions, Terraform, Azure, containers
- Testing: unit, integration, e2e, security, performance

134 skills. Only relevant skills load for each task.

## The Agentic Loop

Generate -> Verify -> Self-Review -> Fix -> Done

- Minimum 5 review iterations enforced by CLI gate
- Pre-commit hook blocks commits without a completed loop
- Quality score, coverage, and lint checks built in

Every change is pressure-tested before it lands.

## Model Council

Single-model reasoning is a blind spot. Stress-test the decision.

- **Analyst** decomposes evidence
- **Strategist** frames second-order effects
- **Skeptic** hunts failure modes
- **Synthesis** captures the consensus call

Triggered automatically for PRD scope, ADR options, AI design, code review.

## Workflow Checkpoints

Brainstorm -> Plan -> Work -> Review -> Compound Capture -> Done

- Every checkpoint is resolved from durable evidence, not chat history
- Execution plans live in the repo and survive context loss
- Bounded work contracts scope each implementation slice
- Compound Capture turns every shipped feature into reusable learning

## Memory and Compound Engineering

- `/memories/` -- cross-session decisions, pitfalls, conventions
- `docs/artifacts/learnings/` -- promoted patterns from finished work
- Repo-local. Reviewable. Survives any model swap.

The harness gets smarter every sprint, not just the model.

## Plugins - Bring Your Own Tools

Zero-install plugins extend Frontier without bloating the runtime.

| Plugin | Capability |
|---|---|
| convert-docs | Markdown -> Word |
| convert-slides | Markdown -> PowerPoint |
| read-docs | Word/RTF/HTML -> Markdown |
| read-slides | PowerPoint -> Markdown |
| read-pdf | PDF -> Markdown with page anchors |

Markdown stays the source of truth. Binaries are generated on demand.

## How It Runs

- **VS Code extension** -- chat participant, sidebars, command palette
- **Claude Code** -- slash commands for every FDE
- **CLI** -- `.agentx/agentx.ps1` for plan, work, review, ship
- **GitHub or Local mode** -- full traceability or solo flow

Works on Windows, macOS, Linux. PowerShell or Bash.

## The Pitch

Your engineers should not babysit a generative model.

**Frontier gives the model a team, a process, and a memory.**

- Repo becomes the system of record
- Every decision is defensible
- Every commit is reviewed
- Every learning compounds

## Get Started

```powershell
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v9.2.0/install.ps1 | iex
```

Or install the **Frontier** VS Code extension and run:
**Frontier: Initialize Local Runtime**

Five minutes to your first reviewed feature.

## Questions?

github.com/jnPiyush/AgentX

Apache 2.0. Open source. Production-tested.
