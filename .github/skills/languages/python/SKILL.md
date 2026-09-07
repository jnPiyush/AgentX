---
name: "python"
description: 'Write production-ready Python code following modern best practices. Use when building Python applications, adding type hints, writing async code, implementing error handling, testing with pytest, or structuring Python project layouts.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["python"]
 frameworks: ["flask", "django", "fastapi"]
 platforms: ["windows", "linux", "macos"]
---

# Python Development

> **Purpose**: Production-ready Python development standards for building secure, performant, maintainable applications. 
> **Audience**: Engineers building Python applications, APIs, data pipelines, or AI/ML systems. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) Python development patterns.

---

## When to Use This Skill

- Building Python applications or APIs
- Adding type hints to Python code
- Writing async/await patterns in Python
- Testing with pytest
- Structuring Python project layouts

## Decision Tree

```
Python Project Decision
+-- Building a web API?
|   +-- High-performance async? -> FastAPI
|   +-- Full-featured framework? -> Django + DRF
|   +-- Lightweight / microservice? -> Flask
+-- Data processing / ML?
|   +-- Data pipelines? -> pandas + polars
|   +-- ML models? -> scikit-learn, PyTorch, or transformers
|   +-- Notebooks? -> Jupyter + ipykernel
+-- CLI tool?
|   +-- Simple? -> argparse (stdlib)
|   +-- Complex multi-command? -> click or typer
+-- Async I/O needed?
|   +-- HTTP client? -> httpx or aiohttp
|   +-- Task queue? -> Celery or asyncio
+-- Package management?
|   +-- Modern standard? -> pyproject.toml + poetry or hatch
|   +-- Legacy? -> requirements.txt + pip
```

## Prerequisites

- Python 3.14+ installed
- pip or poetry package manager
- pytest for testing

## Core Rules

### Code Style (PEP 8)

```python
# [PASS] GOOD: Follow PEP 8
def calculate_total(items: List[Item]) -> float:
 """Calculate total price of items."""
 return sum(item.price * item.quantity for item in items)

# Variable naming
user_count = 10 # snake_case for variables
MAX_RETRIES = 3 # UPPER_CASE for constants
UserService # PascalCase for classes

# [PASS] GOOD: List comprehensions
active_users = [u for u in users if u.is_active]

# [FAIL] BAD: Mutable default arguments
def add_item(item, items=[]): # Don't do this!
 items.append(item)
 return items

# [PASS] GOOD: Use None as default
def add_item(item, items=None):
 if items is None:
 items = []
 items.append(item)
 return items
```

### Performance

```python
# [PASS] GOOD: Use generators for large datasets
def process_large_file(filename: str):
 """Process large file line by line."""
 with open(filename) as f:
 for line in f: # Generator - memory efficient
 yield process_line(line)

# [PASS] GOOD: Use collections.defaultdict
from collections import defaultdict

user_groups = defaultdict(list)
for user in users:
 user_groups[user.group].append(user)

# [PASS] GOOD: Use set for membership testing
valid_ids = {1, 2, 3, 4, 5}
if user_id in valid_ids: # O(1) lookup
 process_user(user_id)
```

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **Mutable defaults** | `def func(items=[]):` | Use `items=None` then `if items is None: items = []` |
| **Missing type hints** | No type information | Add types everywhere |
| **Broad exceptions** | `except Exception:` | Catch specific exceptions |
| **No docstrings** | Undocumented code | Add Google-style docstrings |
| **String concatenation** | `s = s + "text"` in loop | Use `"".join(list)` or f-strings |
| **Not using context managers** | Manual file.close() | Use `with open(...) as f:` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Type hint errors with mypy | Install type stubs, use type: ignore sparingly |
| Async event loop already running | Use asyncio.run() at top level only, use await inside async functions |
| pytest not finding tests | Name test files test_*.py and functions test_*, check pytest.ini paths |

## Workflow

1. Confirm version and project tooling.
2. Define typed inputs, outputs, and failure behavior.
3. Implement the smallest module consistent with the layout.
4. Run formatter/linter, type checker, and focused pytest tests.

## Verification Checklist

- [ ] Configured lint and type checks pass.
- [ ] Focused pytest cases cover boundaries.
- [ ] Package imports cleanly in the supported environment.
- [ ] No hidden global state or leaked resource remains.

## Required Detailed Guidance

Load each reference when its named topic applies; the MUST-read routes below are part of this skill's operating contract.

- [Quick Reference through Project Structure](references/details-quick-reference-and-project-structure.md) - MUST read before work involving quick reference through project structure.

Existing focused references are reused, not duplicated:

- [Python Async, Error Handling & Context Managers](references/async-errors-context.md) - MUST read before applying the focused python async, error handling & context managers guidance.
- [Python Dataclass Patterns](references/dataclasses-patterns.md) - MUST read before applying the focused python dataclass patterns guidance.
- [Python Docstrings, Testing & Logging](references/docs-testing-logging.md) - MUST read before applying the focused python docstrings, testing & logging guidance.
