# skill-creator: Knowledge vs Execution Principle through Anti-Patterns

> MUST read before work involving **knowledge vs execution principle through anti-patterns**. This reference preserves complete source guidance relocated for context-budget compliance.

## Knowledge vs Execution Principle

Every agent task is either a **knowledge problem** or an **execution problem**:

| Problem Type | Solution | Example |
|---|---|---|
| **Knowledge** (know something) | Skill (Markdown) | Coding standards, triage workflows, deployment conventions |
| **Execution** (do something) | MCP Server | Query a database, create a GitHub issue, send an email |
| **Hybrid** (know how to do well) | Skill that references MCP tools | Skill encodes workflow + judgment; MCP provides API calls |

**Standalone Principle**: Every skill SHOULD produce useful output without MCP connections.
If disconnecting all MCP servers makes the skill non-functional, the knowledge layer is
not properly separated from the execution layer.

When deciding whether to create a skill or an MCP server, ask:
1. Is it stable knowledge (changes weekly/monthly)? -> Skill
2. Does it require a live API call at runtime? -> MCP
3. Both? -> Skill that orchestrates MCP tools as a subordinate layer

## Decision Tree

```
Need to work on a skill?
+- Creating new skill?
| +- Run: scripts/init-skill.ps1
| - Fill in SKILL.md template
+- Auditing existing skill?
| +- Check frontmatter against spec (see Frontmatter Rules)
| +- Check line count (target < 500, ideal < 350)
| - Verify progressive disclosure structure
+- Skill too large (> 500 lines)?
| +- Extract detailed examples -> references/
| +- Extract executable logic -> scripts/
| - Keep SKILL.md as slim router
- Adding capability to existing skill?
 +- Executable automation -> scripts/
 +- Extended docs/examples -> references/
 - Templates, starter code, sample data -> assets/
```

## Progressive Disclosure Pattern

Skills load in 3 tiers to manage context window tokens:

| Tier | What Loads | Token Budget | When |
|------|-----------|--------------|------|
| **Metadata** | Frontmatter only | ~100 tokens | Always (skill discovery) |
| **Body** | SKILL.md content | < 5,000 tokens | On skill activation |
| **Extended** | references/ files | Variable | On-demand via `read_file` |

### Structure Rules

1. **SKILL.md** (< 500 lines, ideal < 350): Decision tree, quick start, core rules, pattern summaries
2. **references/**: Detailed examples, extended documentation, edge cases
3. **scripts/**: Executable automation (scanners, scaffolders, validators)
4. **assets/**: Reusable templates, starter code, sample data, report templates

### Assets Directory Convention

| Content Type | Example | When to Use |
|-------------|---------|-------------|
| Code templates | `pyspark_transforms.py` | Reusable starter code for the skill domain |
| Report templates | `completion_report_template.md` | Structured output documents |
| Config templates | `pipeline-templates.json` | Pre-built configurations |
| Sample data | `sample-input.csv` | Test/demo data for the skill |
| Prompt templates | `system-prompt.md` | AI prompt patterns for the skill |

## Required Sections Standard

Every SKILL.md MUST include these sections:

| Section | Purpose |
|---------|---------|
| Frontmatter | `name`, `description` (50+ chars) |
| When to Use | WHEN: trigger phrase describing file patterns and keywords |
| Decision Tree | Quick routing for sub-decisions |
| Core Rules | 3-5 actionable rules |
| Error Handling | What to do when things go wrong in this skill domain |
| Checklist | Pre-handoff verification items |

**Required for `development/` category**: skills under `.github/skills/development/` MUST also include a `## Rationalization Table` section between `## Prerequisites` (or `## When to Use`) and `## Decision Tree`. The table lists 5-8 common excuses an agent or human uses to skip the skill's discipline, paired with a one-line rebuttal. This is the highest-leverage section against LLM rationalization patterns. Format:

```markdown
## Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "{the excuse the agent would make}" | {why the excuse is wrong and what to do instead} |
```

Other categories (architecture, languages, ai-systems, etc.) MAY include a Rationalization Table when the skill encodes a discipline that is commonly skipped under pressure.

**WHEN: Trigger Phrase**: Every skill SHOULD start with a `> WHEN:` blockquote after the title
that describes when to load the skill. This enables better routing by agents.

Example:
```markdown
# API Design

> WHEN: Creating REST endpoints, designing API versioning, adding pagination or rate limiting.
```

## Anti-Patterns

- **Monolith skills**: > 500 lines with no references/ -> split them
- **Missing frontmatter**: No `name` or `description` -> spec violation
- **Code-dump skills**: Walls of example code -> move to references/
- **Undiscoverable skills**: Not listed in Skills.md -> invisible to routing
- **Stale metadata**: `version` never bumped after changes -> unreliable
- **MCP-dependent skills**: Skills that do nothing without an MCP server -> separate knowledge from execution
- **Token-tax skills**: Encoding knowledge via MCP tool schemas (~23K-50K tokens) instead of a skill file (~200-500 tokens)

## Scripts

- `../scripts/init-skill.ps1` - Scaffold a new skill with proper structure and frontmatter
