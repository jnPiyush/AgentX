---
name: "skill-creator"
description: 'Create, validate, and maintain AgentX skills following the agentskills.io specification. Use when scaffolding a new skill, auditing skill compliance, restructuring for progressive disclosure, or adding scripts/references/assets to an existing skill.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 frameworks: ["agentx"]
 platforms: ["windows", "linux", "macos"]
---

# Skill Creator

> Create, validate, and maintain skills that follow the [agentskills.io](https://agentskills.io) open specification.

## When to Use

- Creating a new skill from scratch
- Auditing existing skills for spec compliance
- Restructuring a skill for progressive disclosure
- Adding scripts/, references/, or assets/ to an existing skill

## Quick Start: Create a New Skill

```powershell
# Scaffold a new skill with all directories
./.github/skills/development/skill-creator/scripts/init-skill.ps1 `
 -Name "my-new-skill" `
 -Category "development" `
 -Description "Brief description of the skill" `
 -WithScripts -WithReferences
```

This creates:
```
.github/skills/development/my-new-skill/
+-- SKILL.md # Main skill document
+-- scripts/
| -- example.ps1 # Starter script
+-- references/
| -- reference-guide.md # Extended content
-- assets/ # (with -WithAssets)
 -- .gitkeep # Templates, starter code, sample data
```

## Core Rules (Frontmatter)

### Required Fields

| Field | Rules | Example |
|-------|-------|---------|
| `name` | lowercase, hyphens, 1-64 chars | `"api-design"` |
| `description` | 1-1024 chars, plain text | `"REST API design patterns"` |

### Recommended Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `metadata.author` | Attribution | `"AgentX"` |
| `metadata.version` | Skill version (SemVer) | `"1.0.0"` |
| `metadata.created` | Creation date | `"2025-01-15"` |
| `metadata.updated` | Last update date | `"2025-01-15"` |
| `compatibility.languages` | Language scope | `["csharp", "python"]` |
| `compatibility.frameworks` | Framework scope | `["dotnet", "flask"]` |
| `compatibility.platforms` | OS scope | `["windows", "linux"]` |
| `prerequisites` | Required tools, MCP servers, env | `["Node.js 24+", "Docker"]` |
| `allowed-tools` | Space-delimited tool names | `"read_file run_in_terminal"` |
| `argument-hint` | Slash-command input hint | `"[target] [options]"` |
| `user-invocable` | Show in slash-command menu | `false` for background knowledge |
| `disable-model-invocation` | Disable automatic activation | `true` for manual-only workflows |
| `context` | Inline or forked execution | `fork` for read-heavy focused reports |

### Frontmatter Template

```yaml
---
name: "skill-name"
description: 'Create, validate, and maintain AgentX skills following the agentskills.io specification. Use when scaffolding a new skill, auditing skill compliance, restructuring for progressive disclosure, or adding scripts/references/assets to an existing skill.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "YYYY-MM-DD"
 updated: "YYYY-MM-DD"
compatibility:
 languages: ["lang1", "lang2"]
 frameworks: ["framework1"]
 platforms: ["windows", "linux", "macos"]
prerequisites: ["tool or runtime required"]
allowed-tools: "tool1 tool2 tool3"
---
```

## Skill Quality Checklist

The executable quality gate is `scripts/score-skill.ps1`, using the deterministic
[Skill Quality Rubric](../../../../evaluation/rubrics/skill-quality.md). It emits
eight weighted dimensions, blocking findings, a 0-100 score, a tier, and JSON
evidence. Use `-Enforce` for new or changed skills; all-inventory mode reports
existing score debt while always failing universal blockers.

- [ ] Frontmatter has `name` and `description` (required)
- [ ] Frontmatter has `metadata.version` (recommended)
- [ ] SKILL.md is under 500 lines
- [ ] Has a decision tree section
- [ ] Has "When to Use" section with WHEN: trigger phrase
- [ ] Has "Core Rules" section
- [ ] Has "Error Handling" section
- [ ] Has "Anti-Patterns" section
- [ ] Large examples are in references/ (not inline)
- [ ] Executable tools are in scripts/ (not just documented)
- [ ] Reusable templates/starter code in assets/ (not inline)
- [ ] `prerequisites` listed if skill requires external tools
- [ ] Added to Skills.md master index

## Prerequisites

Define the trigger, exclusions, expected user outcome, validation method, and evidence that the capability belongs in a reusable skill.

## Error Handling

- Over budget: move complete sections without splitting fences or tables.
- Broken reference: rebase the relative path from its new location.
- Low score: improve actual decisions or verification, never add keyword padding.

## Rationalization Table

| Temptation | Why reject it |
|------------|---------------|
| create a skill for one-off trivia. | Use valid frontmatter and a precise positive trigger. |
| copy the same guidance into root and references. | Create a skill for repeatable knowledge or workflow; use a script for deterministic execution, an instruction for always-on policy, and a prompt for a single reusable task. |

## Why This Is a Skill

A skill is a durable operational contract, not a long prompt; it must route context and executable resources without flooding every invocation.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Knowledge vs Execution Principle through Anti-Patterns](references/details-knowledge-vs-execution-principle-and-anti-patterns.md) - MUST read before work involving knowledge vs execution principle through anti-patterns.

Existing focused references are reused, not duplicated:

- [Improvement Loop Reference](references/IMPROVEMENT-LOOP.md) - MUST read before applying the focused improvement loop reference guidance.
