# split-model-drift-judge-implementation

> Source: [model-drift-judge-patterns.md](model-drift-judge-patterns.md)
> Source hash (LF-normalized original file): `97FC504BDF0A789795EC626C20A3B4EE4E417AF3174FD95B96CFF3C7CFB25244`
> Relocation manifest:
- `## 3. Judge LLM Implementation` -> original lines 195-342
> Preservation rule: retained verbatim except for file-level routing and any required link rebases.

---

## 3. Judge LLM Implementation

### The Problem

When you use an LLM to evaluate another LLM's outputs (LLM-as-judge), you need the judge to be:

- **Consistent** - Same input should get same score
- **Calibrated** - Scores should mean what you think they mean
- **Grounded** - Judging on specific criteria, not vibes
- **Validated** - The judge itself needs to be tested

Most teams either skip evaluation entirely, or implement a judge so vague it's useless.

### Decision Tree

```
Need to evaluate agent quality?
+- Objective metric? (exact match, count, format check)
| - Use code-based evaluator (no LLM needed)
+- Subjective metric? (quality, tone, helpfulness)
| +- Use LLM-as-judge with structured rubric
| +- Define explicit scoring criteria per level
| - Validate judge with known-answer set
- Critical decision? (safety, compliance, accuracy)
 +- Use multiple judges (judge ensemble)
 +- Include human review sample
 - Cross-validate judge agreement rate
```

### Judge Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| "Rate 1-5" with no rubric | Judge has no criteria -> random scores | Define what each score level means |
| Same model as agent and judge | Self-evaluation bias | Use different model for judging |
| No judge validation | Don't know if judge is reliable | Test judge on known-answer pairs |
| Single judge for everything | Different aspects need different criteria | Separate judges per dimension |
| Binary pass/fail | Loses nuance, hard to improve | Use 1-5 scale with rubric per level |
| No inter-rater agreement check | Judge may be inconsistent | Run same input 3x, check variance |

### Proper Judge Implementation

```python
"""Structured judge evaluator with rubric and validation."""

JUDGE_PROMPT = """You are evaluating an AI agent's response quality.

RUBRIC - Score each dimension on 1-5:

**Accuracy** (Is the information correct?):
 5: Fully accurate, all facts verified
 4: Mostly accurate, minor imprecision
 3: Partially accurate, some errors but core is right
 2: Significant errors that mislead the user
 1: Fundamentally wrong or fabricated

**Completeness** (Does it address the full query?):
 5: Addresses all aspects with appropriate depth
 4: Addresses most aspects, minor gaps
 3: Addresses core question but misses secondary points
 2: Partially addresses the question
 1: Does not address the query

**Helpfulness** (Is the response actionable?):
 5: Directly actionable, user can proceed immediately
 4: Helpful with minor clarification needed
 3: Somewhat helpful but requires additional research
 2: Minimally helpful, mostly filler
 1: Not helpful, confusing, or harmful

INPUT:
Query: {query}
Response: {response}
Context: {context}

OUTPUT (JSON only):
{{
 "accuracy": <int 1-5>,
 "completeness": <int 1-5>,
 "helpfulness": <int 1-5>,
 "overall": <float, weighted average>,
 "reasoning": "<2-3 sentence justification>"
}}
"""
```

### Judge Validation Process

Every judge LLM needs its own validation:

```
1. CREATE KNOWN-ANSWER SET
 - 20-30 examples with human-assigned "gold" scores
 - Include clear good (5), clear bad (1), and ambiguous (3) cases
 - Have 2+ humans score independently for agreement baseline

2. RUN JUDGE ON KNOWN-ANSWER SET
 - Score all 20-30 examples with your judge prompt
 - Run 3x to check consistency (variance < 0.5 on 1-5 scale)

3. MEASURE JUDGE QUALITY
 - Cohen's Kappa vs human scores (target > 0.6 = substantial agreement)
 - Mean Absolute Error (target < 0.8 on 1-5 scale)
 - Check for position bias (does order of examples affect scores?)
 - Check for length bias (do longer responses get higher scores?)

4. ITERATE
 - If agreement is low, refine the rubric
 - If variance is high, add more specific criteria
 - If biased, add de-biasing instructions to prompt
```

### Judge Ensemble Pattern

For critical evaluations, use multiple judges:

```python
"""Judge ensemble: majority vote from 3 independent judges."""

JUDGE_MODELS = [
 {"model": os.environ["JUDGE_PRIMARY_MODEL"], "role": "primary"},
 {"model": os.environ["JUDGE_SECONDARY_MODEL"], "role": "secondary"},
 {"model": os.environ["JUDGE_TIEBREAKER_MODEL"], "role": "tiebreaker", "temperature": 0.3},
]

async def ensemble_judge(query: str, response: str) -> dict:
 """Run 3 judges and take weighted average."""
 scores = []
 for judge_config in JUDGE_MODELS:
 score = await run_single_judge(
 query=query,
 response=response,
 model=judge_config["model"],
 temperature=judge_config.get("temperature", 0.0),
 )
 scores.append(score)

 # Aggregate
 return {
 "accuracy": sum(s["accuracy"] for s in scores) / len(scores),
 "completeness": sum(s["completeness"] for s in scores) / len(scores),
 "helpfulness": sum(s["helpfulness"] for s in scores) / len(scores),
 "judge_agreement": max(s["overall"] for s in scores) - min(s["overall"] for s in scores),
 "individual_scores": scores,
 }
```

---
