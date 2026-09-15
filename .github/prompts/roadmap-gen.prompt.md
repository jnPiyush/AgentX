---
name: "Roadmap Generation"
agent: "Frontier Product FDE"
description: Generate a portfolio roadmap and release plan from epic, PRD, and workstream context
inputs:
 issue_number:
 description: "Epic issue number for the roadmap"
 required: true
 default: ""
---

# Roadmap Generation Prompt

## Context
You are a Product Manager agent generating a shared roadmap for Epic #{{issue_number}}.

Before drafting, read these files first:
- `.github/templates/ROADMAP-TEMPLATE.md`
- related PRDs under `docs/artifacts/prd/`
- any relevant ADR, UX, or execution-plan artifacts that establish delivery constraints

## When to Use This Prompt

Use this prompt when one or more of these are true:
- the epic spans multiple workstreams, products, or business domains
- several PRDs need one shared milestone and release plan
- the user explicitly asks for a roadmap, release plan, portfolio calendar, or planning wave view
- UAT, pilot go-live, and later release waves need one coordinated schedule

## Instructions

### 1. Analyze the Planning Scope
- Read the epic description and related PRDs thoroughly
- Identify the workstreams that need to be coordinated
- Determine whether the roadmap is MVP-only, annual, or multi-wave
- Capture shared dependencies, release gates, and operational readiness expectations

### 2. Build the Roadmap Structure

Using `.github/templates/ROADMAP-TEMPLATE.md`, populate:
- portfolio purpose and planning assumptions
- portfolio planning rules
- dated MVP sprint calendar and gate dates
- dated release plan with release owners and readiness statuses
- capability waves and planning workshops
- cross-workstream dependencies
- milestone timeline for the planning horizon
- Mermaid visuals for gantt, milestone sequence, and MVP release shape
- quality gates, release readiness, rollback, and hypercare expectations
- workstream mapping by release wave

### 3. File Naming Guidance
- If the workspace already uses semantic artifact names, preserve that pattern
- Otherwise create the roadmap at `docs/artifacts/prd/ROADMAP-{{issue_number}}.md`
- Link all related PRDs in the roadmap header

### 4. Quality Checklist
- [ ] Scope covers the full portfolio or multi-workstream release surface
- [ ] Sprint and release dates are explicit and internally consistent
- [ ] Shared dependencies are called out, not buried in PRDs
- [ ] Release readiness and hypercare expectations are operationally clear
- [ ] Milestones, waves, and workshops tell one coherent planning story
- [ ] Mermaid diagrams match the dates and sequencing in the tables

## References
- `.github/templates/ROADMAP-TEMPLATE.md`
- `.github/templates/PRD-TEMPLATE.md`
- `AGENTS.md`
- `docs/WORKFLOW.md`