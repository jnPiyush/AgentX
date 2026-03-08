---
name: token-optimizer
description: >-
  Manage token budgets for instruction files, skills, and agent definitions to prevent
  context window waste. Use when creating or editing SKILL.md, .instructions.md, .agent.md,
  or copilot-instructions.md files, or when context loading feels slow or agents fail to
  load expected context. Enforce limits, measure usage, and optimize content density.
---

# Token Optimizer

## When to Use This Skill

- Creating or editing SKILL.md, .instructions.md, .agent.md, or copilot-instructions.md
- Context loading feels slow or agents fail to load expected context
- Optimizing file sizes to fit within token budget limits
- Moving detailed content into progressive disclosure (references/ subdirectories)
- Measuring token usage across the project with token-counter.ps1

## Limits

| File Type | Max Tokens | Source |
|-----------|-----------|--------|
| SKILL.md | 5,000 | Golden Principle |
| .instructions.md | 3,000 | Golden Principle |
| copilot-instructions.md | 2,000 | Golden Principle |
| .agent.md (external) | 6,000 | Practical limit |
| .agent.md (internal) | 4,000 | Practical limit |
| references/*.md | 4,000 | Recommended |

## Token Estimation

Approximate: **1 token per 4 characters** (English). For precise counts:

```powershell
.\scripts\token-counter.ps1 -Action check    # Validate all files
.\scripts\token-counter.ps1 -Action count     # List token counts
.\scripts\token-counter.ps1 -Action report    # Category summary
```

## Optimization Techniques

### 1. Progressive Disclosure

Move detail into `references/` subdirectories. SKILL.md holds the compact essence;
references hold extended docs, examples, and deep dives.

```
SKILL.md           (500 tokens - core rules)
references/
  EXAMPLES.md      (1500 tokens - code examples)
  DEEP-DIVE.md     (2000 tokens - extended patterns)
```

### 2. Pipe-Delimited Tables

Use pipe-delimited formats instead of verbose Markdown tables for dense reference data:

```
category|skill|path|keywords
arch|security|.github/skills/architecture/security/SKILL.md|validation,auth
```

### 3. Compressed Headings

Use terse headings: "Rules" not "Rules and Guidelines for Implementation".

### 4. Link, Do Not Duplicate

Reference other skills and docs by path. Never copy content between files.

### 5. Quantify Ruthlessly

Replace prose with tables. Replace explanations with examples. Cut adjectives.

## CI Enforcement

The `quality-gates.yml` workflow includes a token budget check step. Files exceeding
limits block PR merge.

## Error Handling

If a file exceeds its token limit:

1. Run `.\scripts\token-counter.ps1 -Action check` to identify violations
2. Extract verbose sections into `references/` subdirectory
3. Replace inline examples with links to reference files
4. Re-run check to confirm compliance

## Checklist

- [ ] All SKILL.md files under 5,000 tokens
- [ ] All instruction files under 3,000 tokens
- [ ] Progressive disclosure used for files approaching limits
- [ ] No duplicated content between files
- [ ] CI token check passing
