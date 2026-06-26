---
description: Python coding standards (AgentX)
globs: **/*.py,**/*.pyx
alwaysApply: false
---

# Python (AgentX)

Canonical: `.github/instructions/python.instructions.md` and
`.github/skills/languages/python/SKILL.md` -- read for full standards.

- PEP 8; type hints on all signatures; Black 88-col; `ruff` lint/format.
- Google-style docstrings; pytest (+ pytest-asyncio); name tests
  `test_function_scenario_expected`.
- Catch specific exceptions, never bare `except:`.
- Parameterize SQL via ORM or `cursor.execute(sql, params)` -- never f-strings.
- Secrets via env/Key Vault, never hardcoded.
