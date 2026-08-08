# Skill Quality Rubric

Use this deterministic rubric for every AgentX `SKILL.md`. It measures whether a skill is discoverable, actionable, safe, maintainable, and efficient without requiring a model judge.

## Scoring

| Dimension | Weight | Deterministic evidence |
|-----------|-------:|------------------------|
| Specification | 20 | Valid kebab-case directory and matching frontmatter name; description is 50-1024 characters; standard skill root structure |
| Discoverability | 15 | Description contains positive trigger language; `When to Use` or `WHEN:` section exists with substantive text; description avoids negative trigger contamination |
| Decision Support | 15 | Substantive decision tree/routing guidance; prerequisites or explicit none statement; anti-patterns/pitfalls/rationalization guidance |
| Actionability | 20 | Substantive core rules; workflow/steps/quick-start guidance; verification checklist; executable scripts when automation is promised |
| Safety and Reliability | 15 | Error handling/failure guidance; local links resolve; external requirements are declared; development skills contain a rationalization table |
| Maintainability | 10 | Main file stays within 500 lines; detailed examples are progressively disclosed when large; metadata version is present; no unexpected root files/directories |
| Efficiency | 5 | Main file is within the 5,000-token hard limit and earns more points below 3,000/1,500 tokens |

Total: 100 points.

## Tiers

| Score | Tier |
|------:|------|
| 90-100 | Exemplary |
| 80-89 | Strong |
| 70-79 | Adequate |
| 50-69 | Needs Improvement |
| 0-49 | Invalid |

A blocking finding always makes the result fail regardless of score.

## Blocking Floors

- `SKILL.md` missing or YAML frontmatter invalid
- Directory name is invalid or differs from frontmatter `name`
- Description missing, shorter than 50 characters, or longer than 1024 characters
- Main skill body exceeds 5,000 estimated tokens
- A local Markdown reference is broken
- Unexpected files/directories exist at the skill root
- A development-category skill lacks a Rationalization Table when score enforcement is enabled for a new or changed skill
- Discoverability, Actionability, or Safety and Reliability dimension score is zero when score enforcement is enabled

## CI Semantics

- Single-skill mode always fails on blockers. It fails below `-MinScore` (default 70) when `-Enforce` is supplied.
- All-skills mode always fails on blockers.
- All-skills aggregate score enforcement is opt-in with `-Enforce`; this exposes current inventory debt without silently breaking every existing pipeline.
- Changed skills use `validate-changed-skills.ps1`: skills that exist at the trusted base revision may not lose points or add blockers; newly added skills must score at least 70 with no blockers.
- `-Json` emits stable objects with score, tier, pass state, dimensions, findings, tokens, and blockers. `validate-skill.ps1` consumes this JSON directly.
- Frontmatter is parsed with the bundled `yaml` package in strict mode; regex matching is not accepted as YAML validation.

## Model-Backed Evaluation

LLM or SkillOpt evaluation may score usefulness, originality, or task success as a separate diagnostic. It MUST NOT silently change deterministic CI scores. Promote model-backed dimensions only after human calibration, fixed datasets, reproducible model/version settings, and explicit threshold changes.
