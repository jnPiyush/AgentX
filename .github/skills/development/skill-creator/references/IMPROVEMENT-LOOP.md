---
name: improvement-loop
description: 12-step Sensei-style iterative improvement loop for agent output quality.
---

# Improvement Loop Reference

> Quantitative scoring loop layered on top of the existing Iterative Quality Loop.
> Agents iterate until their deliverable scores Medium-High or above.

## Loop Steps

1. **Produce** - Agent creates initial deliverable (PRD, ADR, code, etc.)
2. **Score** - Run `scripts/score-output.ps1 -Role <role> -IssueNumber <n>`
3. **Evaluate** - Check tier: High (90%+), Medium-High (70-89%), Medium (50-69%), Low (<50%)
4. **Gate** - If tier >= Medium-High, proceed to Step 9. Otherwise continue.
5. **Diagnose** - Read individual check results to identify failing criteria
6. **Fix** - Address the highest-point failing check first
7. **Re-score** - Run score-output.ps1 again
8. **Repeat** - Loop Steps 5-7 until tier >= Medium-High (max 5 iterations)
9. **Self-review** - Agent evaluates with [HIGH]/[MEDIUM]/[LOW] findings
10. **Address** - Fix all HIGH and MEDIUM findings
11. **Final score** - Run score-output.ps1 one last time to confirm
12. **Handoff** - Mark loop complete via CLI: `.agentx/agentx.ps1 loop complete <issue>`

## Integration with CLI

```powershell
# Score after implementation
.\scripts\score-output.ps1 -Role engineer -IssueNumber 42

# Score exits 0 for Medium-High+, 1 otherwise
# CLI blocks handoff if loop not complete
.\.agentx\agentx.ps1 loop complete 42
```

## Scoring Rubrics

### Engineer (45 points)

| Check | Points | How |
|-------|--------|-----|
| Tests pass | 10 | npm test / dotnet test / pytest exit 0 |
| Coverage >= 80% | 10 | Test-to-source ratio proxy |
| Lint clean | 5 | npm run lint exit 0 |
| No hardcoded secrets | 5 | Regex scan for password/key/secret patterns |
| SQL parameterized | 5 | No string concat in SQL |
| Docs updated | 3 | Recent commits touch .md files |
| No TODO/FIXME | 2 | Grep source for markers |

### Architect (40 points)

| Check | Points | How |
|-------|--------|-----|
| ADR exists | 3 | docs/adr/ADR-{id}.md present |
| 3+ options | 5 | Count Option headings in ADR |
| Mermaid diagrams | 5 | ```mermaid blocks present |
| Zero code | 5 | No implementation code blocks |
| 13 spec sections | 13 | Count required headings in SPEC |
| Confidence markers | 3 | [Confidence:] tags present |
| AI assessment | 3 | AI-first assessment section |
| Research sources | 3 | 2+ URLs cited |

### PM (33 points)

| Check | Points | How |
|-------|--------|-----|
| PRD exists | 3 | docs/prd/PRD-{id}.md present |
| 12 sections | 12 | Count required headings |
| Research URLs | 5 | Research Summary with 3+ sources |
| User stories + AC | 5 | As a/Given-When-Then patterns |
| Issue references | 5 | #NNN patterns in PRD |
| GenAI section | 3 | If needed, GenAI Requirements present |

## Tier Thresholds

| Tier | Percentage | Meaning | Gate |
|------|-----------|---------|------|
| High | 90-100% | Exceptional quality | PASS |
| Medium-High | 70-89% | Production quality | PASS |
| Medium | 50-69% | Needs improvement | FAIL - iterate |
| Low | 25-49% | Significant gaps | FAIL - iterate |
| Invalid | 0-24% | Missing core deliverables | FAIL - iterate |
