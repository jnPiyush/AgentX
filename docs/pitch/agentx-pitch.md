% AgentX
% Digital Force for Software Delivery
% v8.4.47

# Stop generating code. Start delivering software.

## The Problem

- Zero-shot AI coding is unpredictable on real engineering work
- Single-model reasoning has blind spots
- No memory, no review, no validation across sessions
- Teams ship AI slop, then spend weeks cleaning it up

## What AgentX Is

A **harness** that turns AI coding agents into a structured engineering team.

- 21 specialized agents with strict role contracts
- 94 production skills loaded on demand (not from model memory)
- Multi-model **Council** debates high-stakes decisions
- Plan -> Work -> Review -> Capture loop, enforced

## The AI Development Team

| Domain | Agents |
|---|---|
| Product & Design | PM, UX Designer |
| Architecture | Architect, Data Scientist |
| Engineering | Engineer, DevOps |
| Quality | Reviewer, Tester, Auto-Fix |
| Analytics | Power BI, Research |

Agent X (the hub) routes work autonomously based on type and complexity.

## Skills Library - Retrieval Over Recall

Agents read peer-reviewed patterns **before** writing code.

- Architecture: api-design, security, database, performance
- AI Systems: langgraph, foundry-sdk, rag-pipelines, evaluation
- Languages: C#, Python, TypeScript, React, Rust, C++
- Ops: GitHub Actions, Terraform, Azure, containers
- Testing: unit, integration, e2e, security, performance

94 skills. Max 3-4 loaded per task. No bloat.

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

Zero-install plugins extend AgentX without bloating the runtime.

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
- **Claude Code** -- slash commands for every agent
- **CLI** -- `.agentx/agentx.ps1` for plan, work, review, ship
- **GitHub or Local mode** -- full traceability or solo flow

Works on Windows, macOS, Linux. PowerShell or Bash.

## The Pitch

Your engineers should not babysit a generative model.

**AgentX gives the model a team, a process, and a memory.**

- Repo becomes the system of record
- Every decision is defensible
- Every commit is reviewed
- Every learning compounds

## Get Started

```powershell
irm https://raw.githubusercontent.com/jnPiyush/AgentX/v8.4.47/install.ps1 | iex
```

Or install the **AgentX** VS Code extension and run:
**AgentX: Initialize Local Runtime**

Five minutes to your first reviewed feature.

## Questions?

github.com/jnPiyush/AgentX

Apache 2.0. Open source. Production-tested.
