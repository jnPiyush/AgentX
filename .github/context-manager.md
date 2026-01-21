# Context Manager: Token Budget & Context Health

> **Purpose**: Intelligent context management to optimize token usage and prevent context overflow.  
> **Usage**: Guidelines for AI agents to manage context budget, layer content by priority, and maintain context health.

---

## Token Budget

**Model**: Claude Sonnet 4.5 (128K window)  
**Usable**: 72K tokens (reserve 28K for output)

**Allocation**:
- Tier 1 (Critical): 5K - System prompt, issue, orchestration
- Tier 2 (Important): 20K - Task skills, current file, specs
- Tier 3 (Relevant): 35K - Related code, docs (on-demand)
- Tier 4 (Supplementary): 10K - History, examples (optional)
- Buffer: 2K

## Context Tiers

**Tier 1** (5K) - Never pruned:
- System prompt, current issue, orchestration state, security rules

**Tier 2** (20K) - Auto-loaded by task type ([skills-registry.json](../skills-registry.json) → `taskMappings`):
- API: #09, #04, #02, #11 (18K)
- Database: #06, #04, #02 (15K)
- Security: #04, #10, #02, #13, #15 (20K)
- Bug Fix: #03, #02, #15 (10K)
- Performance: #05, #06, #02, #15 (15K)
- Documentation: #11 (5K)

**Quick Lookup**: `skills-registry.json.taskMappings["{task-type}"].skills`

**Tier 3** (35K) - Retrieved on-demand (relevance > 0.7):
- Related code (semantic search), documentation, examples

**Tier 4** (10K) - Optional (can summarize):
- Old conversation turns (>5), supplementary examples

---

## Pruning

**Triggers**:
- >80% → Prune Tier 4 (oldest)
- >90% → Prune Tier 3 (relevance <0.7)
- >95% → Compress Tier 2 (summarize skills)
- >100% → ERROR (reject new content)

**Never Prune**: Tier 1, current issue, security rules, orchestration state

## Health Monitoring

**Thresholds**:
- 🟢 Healthy: 60-80% usage, relevance >0.8
- 🟡 Warning: 80-90% usage, relevance 0.6-0.8
- 🔴 Critical: >90% usage, relevance <0.6

## Pre-Load Gates

1. **Relevance**: Similarity >0.7 → pass, else reject
2. **Recency**: Updated <90 days → pass, else warn
3. **Budget**: Fits in remaining budget → pass, else prune first
4. **Duplication**: Not already loaded → pass, else skip

## Agent Workflow

**Session Start**:
1. Load Tier 1 (5K): System prompt, issue, orchestration
2. Classify task → auto-load Tier 2 skills (15-20K) per [Skills.md](../Skills.md#-quick-reference-by-task-type)
3. Check budget: Should be <30K after start

**During Work**:
1. Monitor usage (prune at 80%)
2. Load Tier 3 on-demand (semantic search, relevance >0.7)
3. Prune proactively

**Before Handoff**:
1. Generate session summary ([session-manager.md](session-manager.md))
2. Archive Tier 3/4 to issue comments
3. Report context health

---

## References

- **Task Classification**: [Skills.md Quick Reference](../Skills.md#-quick-reference-by-task-type)
- **Session Management**: [.github/session-manager.md](session-manager.md)
- **Context Engineering**: [docs/context-engineering.md](../docs/context-engineering.md)

---

**Version**: 1.0  
**Last Updated**: January 20, 2026  
**Related Issue**: #77
