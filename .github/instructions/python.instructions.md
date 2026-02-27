---
description: 'Python specific coding instructions for production code.'
applyTo: '**.py, **.pyx'
---

# Python Instructions

> Auto-loads when editing Python files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/languages/python/SKILL.md](../skills/languages/python/SKILL.md)

## Key Rules

- Follow PEP 8 style guide
- Use type hints for all function signatures (PEP 484)
- Maximum line length: 88 characters (Black formatter)
- Use `ruff` for linting and formatting
- Google style docstrings
- Catch specific exceptions, never bare `except:`
- pytest for testing, pytest-asyncio for async
- Name tests: `test_function_name_scenario_expected`

## Critical Rules (Embedded -- Always Active)

### Security
- Validate/sanitize ALL inputs at API boundaries
- Parameterize SQL via ORM or `cursor.execute(sql, params)` -- NEVER f-strings or `.format()`
- Secrets in env vars (`os.environ`) or Key Vault -- NEVER hardcode
- Use `secrets.compare_digest()` for constant-time comparisons

### Testing
- 80%+ code coverage required (`pytest --cov`)
- Pyramid: 70% unit, 20% integration, 10% e2e
- AAA pattern (Arrange-Act-Assert) in every test
- No bare `assert True` -- assert specific values

### Error Handling
- Catch specific exceptions (`ValueError`, `KeyError`, etc.)
- Log with context: `logger.error("msg", extra={"agent": ..., "issue": ...})`
- Retry transient failures with exponential backoff (`tenacity`)
- Fail fast on invalid input at module boundaries

