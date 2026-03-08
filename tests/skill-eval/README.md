# Skill Evaluation Framework

Deterministic evaluation harness for AgentX skills, inspired by
[Phil Schmid's Practical Guide to Evaluating and Testing Agent Skills](https://www.philschmid.de/testing-skills).

## Quick Start

```powershell
# Evaluate all 66 skills
.\tests\skill-eval\eval-harness.ps1

# Evaluate a single skill with verbose output
.\tests\skill-eval\eval-harness.ps1 -SkillPath .github/skills/architecture/api-design -Verbose

# Include prompt-set testing
.\tests\skill-eval\eval-harness.ps1 -WithPrompts

# JSON output for CI pipelines
.\tests\skill-eval\eval-harness.ps1 -Json
```

## Three Evaluation Dimensions

### 1. Trigger Quality (description is the trigger mechanism)

| Check | Severity | What It Tests |
|-------|----------|---------------|
| `trigger_description_exists` | HIGH | Frontmatter description present |
| `trigger_description_specificity` | HIGH | >= 10 words (not too vague) |
| `trigger_has_when_phrase` | MEDIUM | Contains "Use when" / "TRIGGER" phrasing |
| `trigger_no_negative_keywords` | MEDIUM | No "DO NOT USE" that causes false triggers |
| `trigger_no_description_overlap` | LOW | Jaccard < 0.5 with other skill descriptions |

### 2. Instruction Quality (directives beat information)

| Check | Severity | What It Tests |
|-------|----------|---------------|
| `instruction_directive_ratio` | MEDIUM | >= 70% directive phrasing (MUST/Always/Never) |
| `instruction_has_actionable_rules` | LOW | >= 5 actionable rule indicators |
| `instruction_has_code_examples` | LOW | >= 1 code block present |
| `instruction_has_anti_patterns` | LOW | Has anti-pattern or error guidance |

### 3. Convention Compliance (AgentX-specific)

| Check | Severity | What It Tests |
|-------|----------|---------------|
| `convention_token_budget` | HIGH | <= 5000 tokens |
| `convention_kebab_case` | HIGH | Directory name is valid kebab-case |
| `convention_structure` | MEDIUM | Only SKILL.md, scripts/, references/, assets/ at root |
| `convention_name_matches_dir` | MEDIUM | Frontmatter name matches directory name |
| `convention_when_section` | MEDIUM | Has "When to Use" section |
| `convention_ascii_only` | MEDIUM | Content uses ASCII-only characters |

## Prompt Sets (Optional)

Create `tests/skill-eval/prompts/<skill-name>.json` with test cases:

```json
[
  {
    "id": "positive_rest_api",
    "prompt": "Design a REST API for user accounts",
    "should_trigger": true,
    "expected_keywords": ["REST", "API"]
  },
  {
    "id": "negative_database",
    "prompt": "Create a PostgreSQL migration",
    "should_trigger": false,
    "expected_keywords": []
  }
]
```

**Best practices from the article:**
- 10-20 prompts per skill (positive + negative)
- Include negative tests (skill should NOT trigger)
- Grade outcomes, not paths
- Start small, extend from failures
- Run 3-5 trials per case for nondeterministic checks

## Scoring

Checks are weighted by severity: HIGH (3 pts), MEDIUM (2 pts), LOW (1 pt).

| Tier | Score Range |
|------|-------------|
| Excellent | >= 90% |
| Good | >= 75% |
| Fair | >= 60% |
| Needs Work | >= 40% |
| Poor | < 40% |

## Architecture

```
tests/skill-eval/
  eval-harness.ps1        # Main evaluator (15 deterministic checks)
  prompts/                # Per-skill prompt sets (JSON)
    api-design.json       # Sample prompt set
  README.md               # This file
```

## Related

- `scripts/score-skill.ps1` - Structural quality scoring (7 categories, 40 pts)
- `scripts/validate-skill.ps1` - Validation pipeline (frontmatter + tokens + scoring)
- [Phil Schmid: Testing Skills](https://www.philschmid.de/testing-skills)
- [SkillsBench](https://arxiv.org/html/2602.12670v1)
