---
description: 'Python specific coding instructions for production code.'
applyTo: '**.py, **.pyx'
---

# Python Instructions

> Auto-loads when editing Python files. For comprehensive standards, load the skill.

**Skill**: [.github/skills/development/python/SKILL.md](../skills/development/python/SKILL.md)

## Key Rules

- Follow PEP 8 style guide
- Use type hints for all function signatures (PEP 484)
- Maximum line length: 88 characters (Black formatter)
- Use `ruff` for linting and formatting
- Google style docstrings
- Catch specific exceptions, never bare `except:`
- pytest for testing, pytest-asyncio for async
- Name tests: `test_function_name_scenario_expected`

