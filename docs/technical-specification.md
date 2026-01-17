# Technical Specification: AI Agent Guidelines System

> **Version**: 1.1  
> **Date**: January 17, 2026  
> **Status**: Implemented & Verified  
> **Standard**: [github/awesome-copilot](https://github.com/github/awesome-copilot) • [agentskills.io](https://agentskills.io/specification)  
> **E2E Tests**: ✅ All Passed (January 17, 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [Core Concepts](#4-core-concepts)
5. [Implementation Patterns](#5-implementation-patterns)
6. [Security Architecture](#6-security-architecture)
7. [File Structure & Organization](#7-file-structure--organization)
8. [Integration Points](#8-integration-points)
9. [Design Decisions & Justifications](#9-design-decisions--justifications)
10. [Operational Workflows](#10-operational-workflows)
11. [Implementation Verification](#11-implementation-verification)

---

## 1. Executive Summary

### 1.1 Purpose

This specification defines a comprehensive framework for AI coding agents to produce **production-ready code** with consistent quality, security, and operational standards. The system enables both supervised and fully autonomous (YOLO) execution modes while maintaining safety through architectural controls.

### 1.2 Key Capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI Agent Guidelines System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Execution  │  │   Security   │  │    Task      │  │   Quality    │    │
│  │    Modes     │  │ Architecture │  │  Management  │  │  Standards   │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ • Standard   │  │ • 4-Layer    │  │ • GitHub     │  │ • 18 Skills  │    │
│  │ • YOLO       │  │   Model      │  │   Issues     │  │ • Checklists │    │
│  │              │  │ • Kill Switch│  │ • Labels     │  │ • Automation │    │
│  │              │  │ • Audit Trail│  │ • Workflows  │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Multi-Agent  │  │  Contextual  │  │  Reusable    │  │  Technology  │    │
│  │Orchestration │  │ Instructions │  │   Prompts    │  │    Stack     │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ • Parallel   │  │ • C#/.NET    │  │ • Code Review│  │ • .NET 8     │    │
│  │   Execution  │  │ • Python     │  │ • Refactoring│  │ • Python     │    │
│  │ • File Locks │  │ • React      │  │ • Test Gen   │  │ • PostgreSQL │    │
│  │ • Coordination│ │ • API        │  │              │  │ • React      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Target Audience

- AI coding agents (GitHub Copilot, Claude, custom agents)
- Software development teams using AI-assisted development
- DevOps engineers configuring autonomous pipelines
- Security teams reviewing AI agent permissions

---

## 2. Problem Statement

### 2.1 Challenges with AI Coding Agents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Current Challenges                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Inconsistency  │    │  Security Risks │    │  Context Loss   │         │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤         │
│  │ • Varying code  │    │ • Unchecked     │    │ • Session       │         │
│  │   quality       │    │   commands      │    │   boundaries    │         │
│  │ • Different     │    │ • No audit      │    │ • No persistent │         │
│  │   patterns      │    │   trail         │    │   memory        │         │
│  │ • No standards  │    │ • Dangerous     │    │ • Lost progress │         │
│  │   enforcement   │    │   operations    │    │   tracking      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ No Coordination │    │ Manual Overhead │    │ Quality Drift   │         │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤         │
│  │ • Parallel      │    │ • Constant      │    │ • Missing tests │         │
│  │   conflicts     │    │   supervision   │    │ • No docs       │         │
│  │ • Duplicate     │    │ • Repetitive    │    │ • Security      │         │
│  │   work          │    │   approvals     │    │   gaps          │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Requirements

| Requirement | Priority | Solution Component |
|-------------|----------|-------------------|
| Consistent code quality | P0 | Skills framework (18 skills) |
| Security without friction | P0 | 4-layer security architecture |
| Autonomous execution option | P1 | YOLO mode with guardrails |
| Persistent task tracking | P1 | GitHub Issues integration |
| Multi-agent coordination | P2 | Orchestration protocol |
| Context-aware instructions | P2 | `.instructions.md` files |

---

## 3. Solution Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Solution Architecture                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   User/Trigger  │
                              │  (Request/Task) │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXECUTION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌────────────────────┐              ┌────────────────────┐               │
│    │   Standard Mode    │◄────────────►│     YOLO Mode      │               │
│    ├────────────────────┤   Toggle     ├────────────────────┤               │
│    │ • Pause at critical│              │ • Full autonomy    │               │
│    │   decision points  │              │ • Auto quality     │               │
│    │ • Human approval   │              │   gates            │               │
│    │   for sensitive    │              │ • Auto deploy to   │               │
│    │   operations       │              │   staging          │               │
│    └────────────────────┘              └────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SECURITY LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Layer 1    │ │   Layer 2    │ │   Layer 3    │ │   Layer 4    │       │
│  │    Actor     │ │  Protected   │ │    Kill      │ │    Audit     │       │
│  │  Allowlist   │ │    Paths     │ │   Switch     │ │    Trail     │       │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤       │
│  │ Who can      │ │ What files   │ │ Emergency    │ │ What was     │       │
│  │ auto-merge?  │ │ need review? │ │ stop all?    │ │ done & when? │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KNOWLEDGE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Skills Framework                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Foundation          Architecture        Development      Operations │   │
│  │  ┌──────────┐       ┌──────────┐        ┌──────────┐     ┌────────┐ │   │
│  │  │01 Core   │       │05 Perf   │        │10 Config │     │16 Git  │ │   │
│  │  │02 Testing│       │06 DB     │        │11 Docs   │     │18 Review│ │   │
│  │  │03 Errors │       │07 Scale  │        │12 VCS    │     └────────┘ │   │
│  │  │04 Security│      │08 Org    │        │13 Types  │                │   │
│  │  └──────────┘       │09 API    │        │14 Deps   │     AI Systems │   │
│  │                     └──────────┘        │15 Logging│     ┌────────┐ │   │
│  │                                         └──────────┘     │17 Agent│ │   │
│  │                                                          └────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COORDINATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      GitHub Issues (Persistent Memory)                │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │   type:epic ──► type:feature ──► type:story ──► type:task            │  │
│  │        │              │               │              │                │  │
│  │        ▼              ▼               ▼              ▼                │  │
│  │   priority:p0-p3  status:ready  status:in-progress  status:done      │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Multi-Agent Orchestration                        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │   Agent 1 ────┐                                                       │  │
│  │   (Feature A) │    ┌─────────────┐    ┌─────────────┐                │  │
│  │               ├───►│ Coordination │───►│   Merge     │                │  │
│  │   Agent 2 ────┤    │   Layer      │    │  Resolution │                │  │
│  │   (Feature B) │    └─────────────┘    └─────────────┘                │  │
│  │               │                                                       │  │
│  │   Agent 3 ────┘                                                       │  │
│  │   (Bug Fix)                                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Request Processing Flow                                │
└─────────────────────────────────────────────────────────────────────────────┘

    User Request                     Agent Processing                  Output
    ───────────                      ────────────────                  ──────

    ┌─────────┐     ┌─────────────────────────────────────────┐    ┌─────────┐
    │         │     │                                         │    │         │
    │ "Add    │     │  1. Load Context                        │    │ Code    │
    │  email  │────►│     ├─► Agents.md (behavior)            │───►│ Changes │
    │  valid- │     │     ├─► Skills.md (standards)           │    │         │
    │  ation" │     │     └─► .instructions.md (language)     │    │ Tests   │
    │         │     │                                         │    │         │
    └─────────┘     │  2. Security Check                      │    │ Docs    │
                    │     ├─► Is command allowed?             │    │         │
                    │     ├─► Is path protected?              │    │ PR      │
                    │     └─► Within iteration limit?         │    │         │
                    │                                         │    └─────────┘
                    │  3. Execute Workflow                    │
                    │     ├─► Research existing code          │
                    │     ├─► Design solution                 │
                    │     ├─► Implement changes               │
                    │     ├─► Write tests                     │
                    │     ├─► Run quality gates               │
                    │     └─► Commit & push                   │
                    │                                         │
                    │  4. Update State                        │
                    │     ├─► Close GitHub Issue              │
                    │     └─► Create audit trail              │
                    │                                         │
                    └─────────────────────────────────────────┘
```

---

## 4. Core Concepts

### 4.1 Execution Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Execution Modes                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STANDARD MODE (Default)                    YOLO MODE (Autonomous)          │
│  ─────────────────────────                  ────────────────────────         │
│                                                                              │
│  ┌─────────┐                                ┌─────────┐                     │
│  │ Request │                                │ Request │                     │
│  └────┬────┘                                └────┬────┘                     │
│       │                                          │                          │
│       ▼                                          ▼                          │
│  ┌─────────┐                                ┌─────────┐                     │
│  │Research │                                │Research │                     │
│  └────┬────┘                                └────┬────┘                     │
│       │                                          │                          │
│       ▼                                          ▼                          │
│  ┌─────────┐    ┌─────────┐                 ┌─────────┐                     │
│  │ Design  │───►│ CONFIRM │                 │ Design  │──────┐              │
│  └────┬────┘    └────┬────┘                 └────┬────┘      │              │
│       │              │                           │           │              │
│       │◄─────────────┘                           ▼           │              │
│       ▼                                     ┌─────────┐      │              │
│  ┌─────────┐                                │Implement│      │              │
│  │Implement│                                └────┬────┘      │              │
│  └────┬────┘                                     │           │              │
│       │                                          ▼           │ Auto        │
│       ▼                                     ┌─────────┐      │ Loop        │
│  ┌─────────┐    ┌─────────┐                 │  Test   │      │              │
│  │  Test   │───►│ CONFIRM │                 └────┬────┘      │              │
│  └────┬────┘    └────┬────┘                      │           │              │
│       │              │                           ▼           │              │
│       │◄─────────────┘                      ┌─────────┐      │              │
│       ▼                                     │ Quality │      │              │
│  ┌─────────┐    ┌─────────┐                 │  Gates  │      │              │
│  │ Deploy  │───►│ CONFIRM │                 └────┬────┘      │              │
│  └────┬────┘    └────┬────┘                      │           │              │
│       │              │                           ▼           │              │
│       │◄─────────────┘                      ┌─────────┐      │              │
│       ▼                                     │ Deploy  │◄─────┘              │
│  ┌─────────┐                                │ Staging │                     │
│  │  Done   │                                └────┬────┘                     │
│  └─────────┘                                     │                          │
│                                                  ▼                          │
│                                             ┌─────────┐    ┌─────────┐     │
│                                             │  Prod   │───►│ CONFIRM │     │
│                                             │ Deploy  │    └─────────┘     │
│                                             └─────────┘                     │
│                                                                              │
│  Confirmations: 3-5 per task                Confirmations: 1 (prod only)   │
│  Speed: Slower, safer                       Speed: Fast, guardrailed       │
│  Use: High-risk changes                     Use: Routine development       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Skills Framework

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Skills Framework                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Purpose: Single source of truth for technical standards                     │
│  Format: YAML frontmatter + Markdown content (agentskills.io spec)          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Skills Hierarchy                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│              Skills.md (Index)                                              │
│                    │                                                         │
│         ┌─────────┼─────────┬─────────┬─────────┐                          │
│         ▼         ▼         ▼         ▼         ▼                          │
│    Foundation  Architect  Develop  Operations   AI                         │
│    ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                  │
│    │01-04  │  │05-09  │  │10-15  │  │16,18  │  │  17   │                  │
│    └───────┘  └───────┘  └───────┘  └───────┘  └───────┘                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Skill File Structure                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    ---                                                                       │
│    name: testing                     ◄── Lowercase, hyphenated              │
│    description: 'Production testing  ◄── 10-1024 characters                 │
│      strategies including...'                                                │
│    ---                                                                       │
│                                                                              │
│    # Testing                         ◄── Human-readable title               │
│                                                                              │
│    > **Purpose**: ...                ◄── Quick reference                    │
│    > **Goal**: 80%+ coverage...                                             │
│                                                                              │
│    ## Section                        ◄── Detailed content                   │
│    [Code examples, patterns, etc.]                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 GitHub Issues as Persistent Memory

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GitHub Issues: Persistent Memory Model                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Why GitHub Issues?                                                          │
│  ─────────────────                                                           │
│  • Survives session boundaries (unlike in-memory context)                   │
│  • Distributed & cloud-native (multiple agents, any device)                 │
│  • Integrated with code (commits, PRs, branches)                            │
│  • Auditable history (who did what, when)                                   │
│  • Searchable knowledge base (past decisions, patterns)                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Issue Lifecycle                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│     Create              Claim                Work                 Close     │
│    ─────────           ─────────           ─────────           ─────────    │
│                                                                              │
│    ┌───────┐           ┌───────┐           ┌───────┐           ┌───────┐   │
│    │ type: │           │status:│           │status:│           │status:│   │
│    │ task  │──────────►│ ready │──────────►│in-prog│──────────►│ done  │   │
│    │       │           │       │           │ress   │           │       │   │
│    │priority           │       │           │       │           │       │   │
│    │ :p1   │           │assign │           │comment│           │close  │   │
│    └───────┘           │ @me   │           │progress           │+ PR   │   │
│                        └───────┘           └───────┘           └───────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Label Taxonomy (Implemented)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    TYPE                    PRIORITY                STATUS                   │
│    ────                    ────────                ──────                   │
│    type:task       ✅      priority:p1 (High)  ✅  status:ready        ✅  │
│    type:feature    ✅                              status:in-progress  ✅  │
│    type:story              priority:p2 (Medium)    status:in-progress      │
│    type:task               priority:p3 (Low)       status:review           │
│    type:bug                                        status:done             │
│    type:spike                                                               │
│    type:adr                                                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   Session Protocol                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    SESSION START          DURING SESSION          SESSION END              │
│    ─────────────          ──────────────          ───────────              │
│                                                                              │
│    1. git pull            1. Progress updates     1. Update issues         │
│    2. Check in-progress   2. Commit with #ref     2. Close completed       │
│    3. Find ready work     3. Handle blockers      3. Commit all            │
│    4. Claim issue         4. Frequent pushes      4. Push                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Patterns

### 5.1 awesome-copilot File Format Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     awesome-copilot File Formats                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AGENT FILES (*.agent.md)                                                   │
│  ────────────────────────                                                    │
│  Purpose: Define agent roles and capabilities                               │
│  Location: .github/agents/                                                  │
│                                                                              │
│    ---                                                                       │
│    description: 'Brief description'     ◄── Required                        │
│    tools:                               ◄── Recommended                     │
│      - run_in_terminal                                                       │
│      - read_file                                                             │
│    model: claude-sonnet-4-20250514      ◄── Recommended                     │
│    ---                                                                       │
│    # Agent Name                                                              │
│    [Instructions for the agent]                                              │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  INSTRUCTION FILES (*.instructions.md)                                      │
│  ─────────────────────────────────────                                       │
│  Purpose: Context-specific rules that auto-apply based on file patterns    │
│  Location: .github/instructions/                                            │
│                                                                              │
│    ---                                                                       │
│    description: 'C# coding standards'   ◄── Required                        │
│    applyTo: '**.cs, **.csx'             ◄── Required (glob patterns)        │
│    ---                                                                       │
│    # C# Instructions                                                         │
│    [Language-specific rules]                                                 │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  SKILL FILES (SKILL.md in folder)                                           │
│  ────────────────────────────────                                            │
│  Purpose: Detailed technical knowledge on specific topics                   │
│  Location: skills/<skill-name>/SKILL.md (or skills/<skill>.md)              │
│                                                                              │
│    ---                                                                       │
│    name: security                       ◄── Required (lowercase-hyphens)    │
│    description: 'Production security    ◄── Required (10-1024 chars)        │
│      practices covering...'                                                  │
│    ---                                                                       │
│    # Security                                                                │
│    [Detailed documentation]                                                  │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  PROMPT FILES (*.prompt.md)                                                 │
│  ─────────────────────────                                                   │
│  Purpose: Reusable prompt templates for common tasks                        │
│  Location: .github/prompts/                                                 │
│                                                                              │
│    ---                                                                       │
│    description: 'Code review prompt'    ◄── Required                        │
│    ---                                                                       │
│    # Prompt Title                                                            │
│    [Prompt template]                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Single Source of Truth Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Single Source of Truth Pattern                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROBLEM: Duplicated content leads to inconsistencies and maintenance debt  │
│                                                                              │
│  SOLUTION: Each piece of information exists in exactly ONE place            │
│            All other files REFERENCE that location                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Content Ownership                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    CONTENT TYPE           OWNER FILE              REFERENCERS              │
│    ────────────           ──────────              ───────────              │
│                                                                              │
│    Agent Behavior         Agents.md               • .github/agents/*.md    │
│    YOLO Mode                                      • copilot-instructions   │
│    Security Architecture                                                    │
│    GitHub Issues Protocol                                                   │
│    Development Workflow                                                     │
│                                                                              │
│    Technical Standards    Skills.md               • Agents.md              │
│    Production Rules       (index)                 • .github/prompts/*.md   │
│    Deployment Checklist                                                     │
│                                                                              │
│    Detailed Practices     skills/*.md             • Skills.md (links)      │
│    Code Examples          (18 files)              • .github/prompts/*.md   │
│    Patterns & Anti-patterns                       • .github/agents/*.md    │
│                                                                              │
│    Security Config        autonomous-mode.yml     • Agents.md (reference)  │
│    Kill Switch                                                              │
│    Protected Paths                                                          │
│    Command Whitelist                                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Reference Pattern                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    ❌ WRONG (Duplication):                                                  │
│    ────────────────────────                                                  │
│    In agent.md:                                                              │
│    ## Review Checklist                                                       │
│    - [ ] Input validation on all user inputs                                │
│    - [ ] SQL queries parameterized                                          │
│    ... (full checklist repeated)                                            │
│                                                                              │
│    ✅ CORRECT (Reference):                                                  │
│    ──────────────────────                                                    │
│    In agent.md:                                                              │
│    ## Review Checklist                                                       │
│    > **Full Checklist**: See [18-code-review-and-audit.md](...)             │
│    **Quick Check**: Security, Quality, Performance, Maintainability        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Quality Gate Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Quality Gate Pattern                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  All code changes MUST pass these gates before deployment:                  │
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────┐  │
│  │  Build   │───►│  Tests   │───►│  Lint    │───►│ Security │───►│PASS │  │
│  │  Pass    │    │  Pass    │    │  Pass    │    │  Scan    │    │     │  │
│  │          │    │  80%+    │    │  0 errors│    │  Pass    │    │     │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └─────┘  │
│       │               │               │               │                     │
│       ▼               ▼               ▼               ▼                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  FAIL    │    │  FAIL    │    │  FAIL    │    │  FAIL    │             │
│  │  Stop &  │    │  Stop &  │    │  Stop &  │    │  Stop &  │             │
│  │  Fix     │    │  Fix     │    │  Fix     │    │  Fix     │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│                                                                              │
│  Gate Configuration (.github/autonomous-mode.yml):                          │
│  ─────────────────────────────────────────────────                           │
│                                                                              │
│    quality_gates:                                                            │
│      tests_required: true                                                    │
│      min_coverage: 80                                                        │
│      lint_required: true                                                     │
│      security_scan_required: true                                            │
│      build_required: true                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Security Architecture

### 6.1 4-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       4-Layer Security Model                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Philosophy: Security by architecture, not by interruption                  │
│  Goal: Enable autonomy while preventing catastrophic errors                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: ACTOR ALLOWLIST                                            │   │
│  │  ─────────────────────────                                            │   │
│  │                                                                       │   │
│  │  Question: WHO can perform autonomous operations?                    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  allowed_actors:                                             │    │   │
│  │  │    - "copilot[bot]"      ✅ Auto-merge allowed               │    │   │
│  │  │    - "github-actions"    ✅ CI/CD automation allowed         │    │   │
│  │  │    - "team-member"       ✅ Trusted human                    │    │   │
│  │  │    - "unknown-actor"     ❌ Requires manual review           │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                        │                                     │
│                                        ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: PROTECTED PATHS                                            │   │
│  │  ────────────────────────                                             │   │
│  │                                                                       │   │
│  │  Question: WHAT files need human review regardless of actor?         │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  protected_paths:                                            │    │   │
│  │  │    - ".github/workflows/**"   🔒 CI/CD pipelines             │    │   │
│  │  │    - "**/secrets.*"           🔒 Secrets files               │    │   │
│  │  │    - "**/*.env*"              🔒 Environment config          │    │   │
│  │  │    - "package.json"           🔒 Dependencies (supply chain) │    │   │
│  │  │    - "*.csproj, *.sln"        🔒 Project configuration       │    │   │
│  │  │    - "**/terraform/**"        🔒 Infrastructure as code      │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                        │                                     │
│                                        ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: KILL SWITCH                                                │   │
│  │  ────────────────────                                                 │   │
│  │                                                                       │   │
│  │  Question: Can we STOP everything instantly?                         │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  autonomous:                                                 │    │   │
│  │  │    enabled: true   ◄── Set to false to halt ALL autonomy    │    │   │
│  │  │                                                              │    │   │
│  │  │  iteration_limits:                                           │    │   │
│  │  │    task: 15        ◄── Max 15 iterations per task           │    │   │
│  │  │    bugfix: 5       ◄── Max 5 attempts to fix a bug          │    │   │
│  │  │    test_retry: 3   ◄── Max 3 test retries                   │    │   │
│  │  │    deploy_retry: 2 ◄── Max 2 deployment attempts            │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                        │                                     │
│                                        ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: AUDIT TRAIL                                                │   │
│  │  ────────────────────                                                 │   │
│  │                                                                       │   │
│  │  Question: Can we see WHAT was done and WHEN?                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  audit:                                                      │    │   │
│  │  │    create_issues: true    ◄── GitHub Issue for each decision│    │   │
│  │  │    pr_comments: true      ◄── Document actions in PRs       │    │   │
│  │  │    log_commands: true     ◄── Full command history          │    │   │
│  │  │                                                              │    │   │
│  │  │  Audit Record Contains:                                      │    │   │
│  │  │    • Timestamp                                               │    │   │
│  │  │    • Actor (which agent)                                     │    │   │
│  │  │    • Action (what command/change)                            │    │   │
│  │  │    • Context (why this action)                               │    │   │
│  │  │    • Result (success/failure)                                │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Command Safety Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Command Safety Model                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                            Command Received                                  │
│                                   │                                          │
│                                   ▼                                          │
│                         ┌─────────────────┐                                 │
│                         │ Is command in   │                                 │
│                         │ BLOCKED list?   │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                           │
│                    ┌─────────────┴─────────────┐                            │
│                    │                           │                             │
│                   YES                         NO                             │
│                    │                           │                             │
│                    ▼                           ▼                             │
│            ┌──────────────┐          ┌─────────────────┐                    │
│            │    REJECT    │          │ Is command in   │                    │
│            │              │          │ ALLOWED list?   │                    │
│            │ Never execute│          └────────┬────────┘                    │
│            │ Log attempt  │                   │                             │
│            │ Alert human  │     ┌─────────────┴─────────────┐               │
│            └──────────────┘     │                           │               │
│                                YES                         NO               │
│                                 │                           │               │
│                                 ▼                           ▼               │
│                         ┌──────────────┐          ┌──────────────┐          │
│                         │   EXECUTE    │          │    PROMPT    │          │
│                         │              │          │              │          │
│                         │ Run command  │          │ Ask human    │          │
│                         │ Log action   │          │ for approval │          │
│                         └──────────────┘          └──────────────┘          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │ ALLOWED (Auto-Execute)          │ BLOCKED (Never Execute)              ││
│  │ ─────────────────────           │ ──────────────────────               ││
│  │ git add, commit, push, pull     │ rm -rf, rm -r                        ││
│  │ npm test, build, lint, install  │ git reset --hard, push --force       ││
│  │ dotnet build, test, run         │ kill, pkill, taskkill                ││
│  │ python -m pytest, pip install   │ chmod 777, drop database             ││
│  │ ruff check, ruff format         │ curl | bash, Invoke-Expression       ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. File Structure & Organization

### 7.1 Repository Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Repository Structure                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Repository Root/                                                            │
│  │                                                                           │
│  ├── Agents.md                 ◄── Agent behavior guidelines                │
│  │                                 (execution modes, security, workflow)    │
│  │                                                                           │
│  ├── Skills.md                 ◄── Technical standards index                │
│  │                                 (links to 18 skill files)                │
│  │                                                                           │
│  ├── Requirements.md           ◄── Project requirements (if applicable)     │
│  │                                                                           │
│  ├── .github/                                                                │
│  │   │                                                                       │
│  │   ├── copilot-instructions.md  ◄── Global Copilot config                │
│  │   │                                                                       │
│  │   ├── autonomous-mode.yml      ◄── Security configuration               │
│  │   │                                (kill switch, protected paths)        │
│  │   │                                                                       │
│  │   ├── agents/                  ◄── Agent role definitions                │
│  │   │   ├── engineer.agent.md        (implementation focus)               │
│  │   │   ├── architect.agent.md       (design focus)                       │
│  │   │   ├── ux-designer.agent.md     (user experience focus)              │
│  │   │   └── reviewer.agent.md        (quality assurance focus)            │
│  │   │                                                                       │
│  │   ├── instructions/            ◄── Language/context-specific rules      │
│  │   │   ├── csharp.instructions.md   (applyTo: '**.cs')                   │
│  │   │   ├── python.instructions.md   (applyTo: '**.py')                   │
│  │   │   ├── react.instructions.md    (applyTo: '**.tsx')                  │
│  │   │   └── api.instructions.md      (applyTo: '**/Controllers/**')       │
│  │   │                                                                       │
│  │   ├── prompts/                 ◄── Reusable prompt templates            │
│  │   │   ├── code-review.prompt.md                                          │
│  │   │   ├── refactor.prompt.md                                             │
│  │   │   └── test-gen.prompt.md                                             │
│  │   │                                                                       │
│  │   └── ISSUE_TEMPLATE/          ◄── Issue templates for agents           │
│  │                                                                           │
│  ├── skills/                      ◄── Detailed technical documentation      │
│  │   ├── 01-core-principles.md                                              │
│  │   ├── 02-testing.md                                                      │
│  │   ├── 03-error-handling.md                                               │
│  │   ├── 04-security.md                                                     │
│  │   ├── 05-performance.md                                                  │
│  │   ├── 06-database.md                                                     │
│  │   ├── 07-scalability.md                                                  │
│  │   ├── 08-code-organization.md                                            │
│  │   ├── 09-api-design.md                                                   │
│  │   ├── 10-configuration.md                                                │
│  │   ├── 11-documentation.md                                                │
│  │   ├── 12-version-control.md                                              │
│  │   ├── 13-type-safety.md                                                  │
│  │   ├── 14-dependency-management.md                                        │
│  │   ├── 15-logging-monitoring.md                                           │
│  │   ├── 16-remote-git-operations.md                                        │
│  │   ├── 17-ai-agent-development.md                                         │
│  │   └── 18-code-review-and-audit.md                                        │
│  │                                                                           │
│  └── docs/                        ◄── Additional documentation              │
│      ├── technical-specification.md   (this document)                       │
│      └── adr/                         (architecture decision records)       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Content Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Content Flow                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌──────────────────┐                                 │
│                        │   User Request   │                                 │
│                        └────────┬─────────┘                                 │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         CONTEXT LOADING                               │  │
│  │                                                                       │  │
│  │   1. copilot-instructions.md        (global behavior)                │  │
│  │            │                                                          │  │
│  │            ▼                                                          │  │
│  │   2. Agents.md                      (execution mode, workflow)       │  │
│  │            │                                                          │  │
│  │            ▼                                                          │  │
│  │   3. <agent>.agent.md               (role-specific instructions)     │  │
│  │            │                                                          │  │
│  │            ▼                                                          │  │
│  │   4. <lang>.instructions.md         (if working on matching files)   │  │
│  │            │                                                          │  │
│  │            ▼                                                          │  │
│  │   5. Skills.md → skills/*.md        (as needed for technical detail) │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      SECURITY VALIDATION                              │  │
│  │                                                                       │  │
│  │   autonomous-mode.yml → Check actor, paths, commands, limits         │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         TASK EXECUTION                                │  │
│  │                                                                       │  │
│  │   GitHub Issues → Track progress, maintain state                     │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 │                                            │
│                                 ▼                                            │
│                        ┌──────────────────┐                                 │
│                        │     Output       │                                 │
│                        │  Code, Tests,    │                                 │
│                        │  Docs, PRs       │                                 │
│                        └──────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Integration Points

### 8.1 GitHub Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GitHub Integration                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        GitHub Issues                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Usage: Persistent memory, task tracking, coordination              │   │
│  │                                                                      │   │
│  │  Commands:                                                           │   │
│  │  ┌────────────────────────────────────────────────────────────┐    │   │
│  │  │ # Create task                                               │    │   │
│  │  │ gh issue create --title "..." --label "type:task,status:ready"   │   │
│  │  │                                                             │    │   │
│  │  │ # Claim work                                                │    │   │
│  │  │ gh issue edit 123 --add-label "status:in-progress"          │    │   │
│  │  │                                                             │    │   │
│  │  │ # Update progress                                           │    │   │
│  │  │ gh issue comment 123 --body "Progress: ..."                 │    │   │
│  │  │                                                             │    │   │
│  │  │ # Close with reference                                      │    │   │
│  │  │ gh issue close 123 --comment "Completed in PR #456"         │    │   │
│  │  └────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Pull Requests                                  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Usage: Code review, auto-close issues, audit trail                 │   │
│  │                                                                      │   │
│  │  Linking: "Closes #123" or "Fixes #123" in PR body                  │   │
│  │                                                                      │   │
│  │  Commands:                                                           │   │
│  │  ┌────────────────────────────────────────────────────────────┐    │   │
│  │  │ gh pr create --title "feat: ..." --body "Closes #123"       │    │   │
│  │  └────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      GitHub Actions                                  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  Usage: CI/CD, automated quality gates                              │   │
│  │                                                                      │   │
│  │  Workflow triggers: push, pull_request, issue_comment              │   │
│  │                                                                      │   │
│  │  Quality gates: build → test → lint → security scan → deploy       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 VS Code / Copilot Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VS Code / Copilot Integration                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  File Discovery:                                                             │
│  ─────────────────                                                           │
│  Copilot automatically discovers and loads:                                 │
│                                                                              │
│    .github/copilot-instructions.md    → Always loaded                       │
│    .github/agents/*.agent.md          → When agent is invoked               │
│    .github/instructions/*.md          → When applyTo pattern matches        │
│    .github/prompts/*.prompt.md        → When prompt is referenced           │
│                                                                              │
│  Context Priority:                                                           │
│  ────────────────                                                            │
│    1. User message (highest)                                                │
│    2. Current file content                                                  │
│    3. Instructions (applyTo matching)                                       │
│    4. Agent definition                                                       │
│    5. Global copilot-instructions                                           │
│    6. Skills (when referenced)                                              │
│                                                                              │
│  Tool Access:                                                                │
│  ───────────────                                                             │
│  Agents define their tool access in frontmatter:                            │
│                                                                              │
│    tools:                                                                    │
│      - run_in_terminal        ◄── Execute commands                          │
│      - read_file              ◄── Read file contents                        │
│      - replace_string_in_file ◄── Edit files                                │
│      - create_file            ◄── Create new files                          │
│      - semantic_search        ◄── Search codebase                           │
│      - grep_search            ◄── Pattern search                            │
│      - get_errors             ◄── Check diagnostics                         │
│      - get_changed_files      ◄── Git diff                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Design Decisions & Justifications

### 9.1 Decision Record

| Decision | Choice | Justification |
|----------|--------|---------------|
| **Task Tracking** | GitHub Issues (not local files) | Cloud-native, survives sessions, integrated with code, auditable, searchable |
| **Security Model** | 4-layer architecture | Defense in depth - no single failure mode compromises system |
| **Execution Modes** | Standard + YOLO | Flexibility for different risk levels; routine vs. critical changes |
| **Skills Format** | Markdown with YAML frontmatter | Human-readable, machine-parseable, follows agentskills.io spec |
| **File Organization** | awesome-copilot patterns | Industry standard, automatic discovery by Copilot |
| **Single Source of Truth** | One owner per content type | Prevents inconsistencies, reduces maintenance burden |
| **Production Checklist** | In Skills.md (not duplicated) | Single authoritative source, always up-to-date |
| **Kill Switch** | External YAML file | Can be modified without code changes, version controlled |
| **Iteration Limits** | Configurable per context | Prevents runaway automation while allowing flexibility |
| **Command Whitelist/Blocklist** | Explicit lists | Safe by default, auditable, easily extensible |

### 9.2 Trade-offs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Trade-off Analysis                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTONOMY vs. SAFETY                                                        │
│  ─────────────────────                                                       │
│                                                                              │
│    More Autonomy ◄──────────────────────────────────► More Safety           │
│         │                                                    │              │
│         │  YOLO Mode                     Standard Mode       │              │
│         │  • Faster delivery             • More oversight    │              │
│         │  • Less friction               • Lower risk        │              │
│         │  • Requires trust              • More interrupts   │              │
│         │                                                    │              │
│    Solution: Configurable modes with architectural guardrails              │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  FLEXIBILITY vs. CONSISTENCY                                                │
│  ──────────────────────────────                                              │
│                                                                              │
│    More Flexibility ◄────────────────────────────► More Consistency         │
│         │                                                    │              │
│         │  Free-form coding              Strict standards    │              │
│         │  • Creative solutions          • Predictable code  │              │
│         │  • Tech debt risk              • Learning curve    │              │
│         │                                                    │              │
│    Solution: Skills framework with clear guidelines, not rigid rules       │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  SIMPLICITY vs. COMPLETENESS                                                │
│  ────────────────────────────                                                │
│                                                                              │
│    Simpler System ◄──────────────────────────────► More Complete            │
│         │                                                    │              │
│         │  Fewer files                   18 skill files      │              │
│         │  • Easier to learn             • Comprehensive     │              │
│         │  • Less context                • More maintenance  │              │
│         │                                                    │              │
│    Solution: Index file (Skills.md) + detailed files loaded on-demand      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Operational Workflows

### 10.1 Development Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Complete Development Workflow                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: PLANNING                                                          │
│  ─────────────────                                                           │
│                                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│    │ Research │───►│  Design  │───►│   ADR    │───►│  Backlog │            │
│    │          │    │          │    │          │    │          │            │
│    │ • Reqs   │    │ • Arch   │    │ • Context│    │ • Epics  │            │
│    │ • Context│    │ • Models │    │ • Decision    │ • Features│           │
│    │ • Code   │    │ • APIs   │    │ • Conseq │    │ • Tasks  │            │
│    └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                              │
│  PHASE 2: IMPLEMENTATION                                                    │
│  ───────────────────────                                                     │
│                                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│    │  Claim   │───►│   Code   │───►│  Test    │───►│   Docs   │            │
│    │  Issue   │    │          │    │          │    │          │            │
│    │          │    │ • Feature│    │ • Unit   │    │ • XML    │            │
│    │ status:  │    │ • Error  │    │ • Integ  │    │ • README │            │
│    │ in-prog  │    │   handling    │ • E2E    │    │ • API    │            │
│    └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                              │
│  PHASE 3: SECURITY & DELIVERY                                               │
│  ────────────────────────────                                                │
│                                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│    │ Security │───►│  Commit  │───►│  Push    │───►│  Close   │            │
│    │  Review  │    │          │    │  + PR    │    │  Issue   │            │
│    │          │    │ • Atomic │    │          │    │          │            │
│    │ • OWASP  │    │ • Clear  │    │ "Closes  │    │ status:  │            │
│    │ • Input  │    │   message│    │  #123"   │    │ done     │            │
│    └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                              │
│  PHASE 4: OPERATIONS                                                        │
│  ───────────────────                                                         │
│                                                                              │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│    │  CI/CD   │───►│ Staging  │───►│   Prod   │───►│  Monitor │            │
│    │          │    │  Deploy  │    │  Deploy  │    │          │            │
│    │ • Build  │    │          │    │          │    │ • Logs   │            │
│    │ • Test   │    │ • Verify │    │ • Approval    │ • Metrics│            │
│    │ • Lint   │    │ • Test   │    │ • Rollback    │ • Alerts │            │
│    └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Multi-Agent Coordination Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Coordination Workflow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              GitHub Issues Queue                             │
│                                     │                                        │
│          ┌──────────────────────────┼──────────────────────────┐            │
│          │                          │                          │            │
│          ▼                          ▼                          ▼            │
│    ┌───────────┐             ┌───────────┐             ┌───────────┐        │
│    │  Agent 1  │             │  Agent 2  │             │  Agent 3  │        │
│    │ (Engineer)│             │ (Engineer)│             │ (Engineer)│        │
│    └─────┬─────┘             └─────┬─────┘             └─────┬─────┘        │
│          │                         │                         │              │
│          │  1. Claim issue         │  1. Claim issue         │  1. Claim   │
│          │  2. Add file lock label │  2. Add file lock label │     issue   │
│          │  3. Create branch       │  3. Create branch       │             │
│          │                         │                         │              │
│          ▼                         ▼                         ▼              │
│    ┌───────────┐             ┌───────────┐             ┌───────────┐        │
│    │ files:    │             │ files:    │             │ files:    │        │
│    │ src/auth/ │             │ src/api/  │             │ tests/    │        │
│    └─────┬─────┘             └─────┬─────┘             └─────┬─────┘        │
│          │                         │                         │              │
│          │                         │                         │              │
│          │  Frequent commits       │  Frequent commits       │  Frequent   │
│          │  & pushes               │  & pushes               │  commits    │
│          │                         │                         │              │
│          │         ┌───────────────┼───────────────┐         │              │
│          │         │               │               │         │              │
│          │         │    CONFLICT DETECTION         │         │              │
│          │         │    (same file modified)       │         │              │
│          │         │               │               │         │              │
│          │         └───────────────┼───────────────┘         │              │
│          │                         │                         │              │
│          │                         ▼                         │              │
│          │                  ┌───────────┐                    │              │
│          │                  │Coordination│                   │              │
│          │                  │  Issue     │                   │              │
│          │                  │ Created    │                   │              │
│          │                  └─────┬─────┘                    │              │
│          │                        │                          │              │
│          │      Resolution: P0 wins, or earlier timestamp    │              │
│          │                        │                          │              │
│          ▼                        ▼                          ▼              │
│    ┌───────────┐             ┌───────────┐             ┌───────────┐        │
│    │   PR #1   │             │   PR #2   │             │   PR #3   │        │
│    │ Closes    │             │ Closes    │             │ Closes    │        │
│    │ #123      │             │ #124      │             │ #125      │        │
│    └───────────┘             └───────────┘             └───────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Agent Handoff Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent Handoff Workflow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AGENT A (Source)                              AGENT B (Target)             │
│  ────────────────                              ───────────────               │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │  1. PREPARE     │  • Complete current unit of work                       │
│  │     HANDOFF     │  • Commit & push all changes                           │
│  │                 │  • Run tests to verify state                           │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │  2. CREATE      │  Create handoff issue with:                            │
│  │     PACKAGE     │  • Current state summary                               │
│  │                 │  • Files modified + status                             │
│  └────────┬────────┘  • Decisions made + rationale                          │
│           │           • Work remaining (checklist)                          │
│           │           • How to continue (exact steps)                       │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │  3. RELEASE     │  • Remove file lock labels                             │
│  │     LOCKS       │  • Update issue: status:handoff                        │
│  │                 │  • Unassign self                                       │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           │         ┌─────────────────────────────────────────┐             │
│           └────────►│         HANDOFF ISSUE                   │             │
│                     │    (Persistent State Transfer)          │             │
│                     │  Labels: type:handoff, status:handoff   │             │
│                     └──────────────────┬──────────────────────┘             │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌─────────────────┐                           │
│                               │  4. CLAIM       │  • Assign to self         │
│                               │     HANDOFF     │  • status:in-progress     │
│                               │                 │  • Pull latest changes    │
│                               └────────┬────────┘                           │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌─────────────────┐                           │
│                               │  5. VERIFY      │  • Review handoff package │
│                               │     STATE       │  • Run tests locally      │
│                               │                 │  • Confirm understanding  │
│                               └────────┬────────┘                           │
│                                        │                                     │
│                                        ▼                                     │
│                               ┌─────────────────┐                           │
│                               │  6. ACK &       │  • Comment: "Accepted"    │
│                               │     CONTINUE    │  • Add file lock labels   │
│                               │                 │  • Resume work            │
│                               └─────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Handoff Types

| Type | When | From → To | Key Content |
|------|------|-----------|-------------|
| **Design → Implement** | ADR approved | Architect → Engineer | Architecture, interfaces, constraints |
| **Implement → Review** | PR created | Engineer → Reviewer | Changes, test coverage, concerns |
| **Review → Fix** | Changes requested | Reviewer → Engineer | Required fixes, suggestions |
| **UX → Implement** | Wireframes done | UX Designer → Engineer | Specs, interactions, accessibility |
| **Session End** | Context limit | Any → Any | Full state, progress, next steps |
| **Escalation** | Blocker hit | Any → Architect | Problem, attempts, options |

### 10.5 Handoff Safety Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Handoff Safety Rules                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ✅ ALWAYS DO                              ❌ NEVER DO                      │
│   ────────────                              ───────────                      │
│                                                                              │
│   Commit all changes before handoff         Leave uncommitted changes       │
│   Push all branches to remote               Keep local-only branches        │
│   Document decisions with rationale         Assume context is obvious       │
│   Release file locks before handoff         Hold locks during handoff       │
│   Wait for ACK before leaving               Abandon without confirmation    │
│   Include exact "how to continue"           Just list what was done         │
│   Link all related issues/PRs               Reference by memory only        │
│   Run tests before handoff                  Hand off broken state           │
│   Create handoff issue (audit trail)        Handoff via chat only           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Quick Reference

### A.1 File Purposes

| File | Purpose | When to Read |
|------|---------|--------------|
| `Agents.md` | Agent behavior, modes, security, workflow | Always |
| `Skills.md` | Technical standards index | When checking standards |
| `skills/*.md` | Detailed technical content | When implementing specific areas |
| `.github/autonomous-mode.yml` | Security configuration | When configuring autonomy |
| `.github/agents/*.agent.md` | Agent role definitions | When invoking specific agent |
| `.github/instructions/*.md` | Language-specific rules | Auto-loaded by file type |
| `.github/prompts/*.md` | Reusable templates | When performing specific tasks |

### A.2 Label Quick Reference

| Label | Meaning |
|-------|---------|
| `type:epic` | Large initiative |
| `type:feature` | User-facing capability |
| `type:task` | Atomic work unit |
| `type:bug` | Defect to fix |
| `priority:p0` | Critical, do immediately |
| `priority:p1` | High, do next |
| `status:ready` | Can start now |
| `status:in-progress` | Currently working |
| `status:done` | Completed |

### A.3 Command Quick Reference

```bash
# Start session
git pull --rebase
gh issue list --label "status:ready,priority:p0"

# Claim work
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"

# Update progress
gh issue comment <ID> --body "Progress: ..."

# Complete work
git commit -m "feat: Description (#ID)"
gh pr create --title "feat: ..." --body "Closes #ID"
gh issue close <ID>
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **YOLO Mode** | Fully autonomous execution mode with architectural guardrails |
| **Kill Switch** | Emergency mechanism to halt all autonomous operations |
| **Protected Path** | File path that always requires human review |
| **Actor Allowlist** | List of users/bots authorized for auto-merge |
| **Quality Gate** | Automated check that must pass before deployment |
| **Skill** | Documented technical knowledge on a specific topic |
| **Instruction** | Context-specific rules that auto-apply based on file patterns |
| **Prompt** | Reusable template for common tasks |

---

## 11. Implementation Verification

### 11.1 E2E Test Results (January 17, 2026)

All workflow management systems have been verified against the live GitHub repository.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     E2E Test Results Summary                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TEST CATEGORY                STATUS     DETAILS                            │
│  ─────────────                ──────     ───────                            │
│                                                                              │
│  Layer 1: Working Memory      ✅ PASS    manage_todo_list, get_changed_files│
│                                          get_errors - all operational       │
│                                                                              │
│  Layer 2: Repository State    ✅ PASS    Git sync, commit history, branch   │
│                                          tracking verified                  │
│                                                                              │
│  Layer 3: GitHub Issues       ✅ PASS    Create, label, comment, status     │
│                                          update, close - all working        │
│                                                                              │
│  Multi-Agent Workflow         ✅ PASS    Parallel tasks, file locks,        │
│                                          handoff protocol verified          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Verified Repository Structure

```
AgentX/
├── Agents.md                          ✅ Agent behavior guidelines
├── Skills.md                          ✅ Technical standards index
├── docs/
│   └── technical-specification.md     ✅ This document
├── skills/                            ✅ 18 skill files
│   ├── 01-core-principles.md
│   ├── 02-testing.md
│   ├── ... (03-17)
│   └── 18-code-review-and-audit.md
└── .github/
    ├── copilot-instructions.md        ✅ Global Copilot config
    ├── autonomous-mode.yml            ✅ Security configuration
    ├── agents/                        ✅ 4 agent definitions
    │   ├── architect.agent.md
    │   ├── engineer.agent.md
    │   ├── reviewer.agent.md
    │   └── ux-designer.agent.md
    ├── instructions/                  ✅ 4 instruction files
    │   ├── api.instructions.md
    │   ├── csharp.instructions.md
    │   ├── python.instructions.md
    │   └── react.instructions.md
    ├── prompts/                       ✅ 3 prompt templates
    │   ├── code-review.prompt.md
    │   ├── refactor.prompt.md
    │   └── test-gen.prompt.md
    └── skills/
        └── ai-agent-development/      ✅ AI agent skill
```

### 11.3 Implemented GitHub Labels

The following labels have been created in the repository:

| Label | Color | Description | Status |
|-------|-------|-------------|--------|
| `type:task` | #0E8A16 | Atomic unit of work | ✅ Verified |
| `type:feature` | #A2EEEF | User-facing capability | ✅ Verified |
| `status:ready` | #C2E0C6 | No blockers, can start | ✅ Verified |
| `status:in-progress` | #FBCA04 | Currently working | ✅ Verified |
| `status:done` | #0E8A16 | Completed | ✅ Verified |
| `priority:p1` | #D93F0B | High priority - Do next | ✅ Verified |
| `files:docs/**` | #1D76DB | Agent working on documentation | ✅ Verified |
| `files:skills/**` | #5319E7 | Agent working on skills | ✅ Verified |

### 11.4 Verified GitHub Issues

| Issue | Title | Purpose | Status |
|-------|-------|---------|--------|
| #2 | [Test] Workflow E2E Test - Task Management | Task management verification | ✅ Closed |
| #3 | [Test] Multi-Agent Simulation - Agent 1 (Docs) | Multi-agent workflow test | ✅ Closed |
| #4 | [Test] Multi-Agent Simulation - Agent 2 (Skills) | Parallel execution test | ✅ Closed |

### 11.5 Verified Tool Operations

| Tool | Operation | Test Result |
|------|-----------|-------------|
| `manage_todo_list` | Create, update, complete todos | ✅ Working |
| `get_changed_files` | Detect uncommitted changes | ✅ Working |
| `get_errors` | Check compilation state | ✅ Working |
| `gh issue create` | Create GitHub issues | ✅ Working |
| `gh issue edit` | Update issue labels/assignees | ✅ Working |
| `gh issue comment` | Add progress comments | ✅ Working |
| `gh issue close` | Close completed issues | ✅ Working |
| `gh label create` | Create workflow labels | ✅ Working |
| `git pull --rebase` | Sync with remote | ✅ Working |
| `git push` | Push to remote | ✅ Working |

### 11.6 Test Execution Log

```
Test Session: January 17, 2026
Branch: master
Commits: 3 (ae7191e → c548eb3 → 23e879d)

1. Memory Management Test
   - manage_todo_list: ✅ Created 5 todos, tracked through completion
   - get_changed_files: ✅ Detected file changes correctly
   - get_errors: ✅ No errors in workspace

2. State Management Test
   - git pull --rebase: ✅ Synced with origin/master
   - git log: ✅ Verified commit history
   - git branch -a: ✅ Confirmed branch tracking

3. GitHub Issues Test
   - gh auth login: ✅ Authenticated as jnPiyush
   - gh issue create: ✅ Created issues #2, #3, #4
   - gh label create: ✅ Created 8 custom labels
   - gh issue edit: ✅ Applied labels successfully
   - gh issue comment: ✅ Added progress updates
   - gh issue close: ✅ Closed all test issues

4. Multi-Agent Workflow Test
   - File lock labels: ✅ files:docs/**, files:skills/**
   - Parallel task tracking: ✅ 2 agents tracked simultaneously
   - Handoff protocol: ✅ Session state documented in comments
   - Conflict detection: ✅ Label-based ownership verified

ALL TESTS PASSED ✅
```

---

**Document Version**: 1.1  
**Last Updated**: January 17, 2026  
**Maintainer**: AI Agent Guidelines System  
**Verification Status**: ✅ E2E Tests Passed
