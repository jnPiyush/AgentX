# python: Quick Reference through Project Structure

> MUST read before work involving **quick reference through project structure**. This reference preserves complete source guidance relocated for context-budget compliance.

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Type hints** | Use everywhere | `def get_user(id: int) -> Optional[User]:` |
| **Async code** | Use `async`/`await` | `async def fetch_data() -> str:` |
| **Error handling** | Specific exceptions | `try-except ValueError` |
| **Testing** | pytest | `def test_user_creation():` |
| **Logging** | Standard library | `logger.info("User %s created", user_id)` |
| **Docstrings** | Google style | `"""Gets user by ID.\n\nArgs:\n id: User identifier` |

---

## Python Version

**Current**: Python 3.14+
**Minimum**: Python 3.9+

### Modern Python Features (Use These)

```python
# Type hints (PEP 484) - Use everywhere
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

def get_user(user_id: int) -> Optional[dict[str, Any]]:
 """Get user by ID."""
 return users.get(user_id)

# Dataclasses for data structures
@dataclass
class User:
 id: int
 name: str
 email: str
 is_active: bool = True

# f-strings for formatting
name = "Alice"
age = 30
message = f"User {name} is {age} years old"

# Walrus operator (:=) in Python 3.8+
if (user := get_user(123)) is not None:
 print(f"Found user: {user['name']}")

# Pattern matching (Python 3.10+)
def process_response(status: int) -> str:
 match status:
 case 200:
 return "Success"
 case 404:
 return "Not found"
 case 500:
 return "Server error"
 case _:
 return "Unknown status"
```

---

## Type Hints

**Always use type hints** for function parameters, return values, and class attributes.

```python
from typing import Optional, List, Dict, Any, Union, TypeVar, Generic

# Basic types
def calculate_total(price: float, quantity: int) -> float:
 return price * quantity

# Optional types
def find_user(user_id: int) -> Optional[User]:
 """Returns None if user not found."""
 return db.query(User).filter_by(id=user_id).first()

# Collections
def get_active_users() -> List[User]:
 return [u for u in users if u.is_active]

def get_user_map() -> Dict[int, User]:
 return {u.id: u for u in users}

# Union types
def process_data(data: Union[str, bytes]) -> str:
 if isinstance(data, bytes):
 return data.decode('utf-8')
 return data

# Generic types
T = TypeVar('T')

def first_or_none(items: List[T]) -> Optional[T]:
 """Get first item or None if list is empty."""
 return items[0] if items else None

# Type aliases for complex types
UserId = int
UserData = Dict[str, Any]

def create_user(user_id: UserId, data: UserData) -> User:
 return User(id=user_id, **data)
```

---

## Project Structure

```
my_project/
+-- src/
| +-- my_project/
| | +-- __init__.py
| | +-- models/
| | | +-- __init__.py
| | | -- user.py
| | +-- services/
| | | +-- __init__.py
| | | -- user_service.py
| | +-- repositories/
| | | +-- __init__.py
| | | -- user_repository.py
| | -- utils/
| | +-- __init__.py
| | -- helpers.py
+-- tests/
| +-- __init__.py
| +-- test_models.py
| +-- test_services.py
| -- test_repositories.py
+-- requirements.txt
+-- pyproject.toml
+-- README.md
-- .gitignore
```

---

## Resources

- **Official Docs**: [docs.python.org](https://docs.python.org)
- **PEP 8**: [pep8.org](https://pep8.org)
- **Type Hints**: [PEP 484](https://peps.python.org/pep-0484/)
- **pytest**: [pytest.org](https://pytest.org)
- **Async**: [docs.python.org/asyncio](https://docs.python.org/3/library/asyncio.html)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../../Skills.md) - [AGENTS.md](../../../../../AGENTS.md)

**Last Updated**: January 27, 2026

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| [`scaffold-project.py`](../scripts/scaffold-project.py) | Generate Python project with pyproject.toml, ruff, mypy, pre-commit | `python ../scripts/scaffold-project.py --name myapp [--fastapi]` |

## References

- [Async Errors Context](async-errors-context.md)
- [Docs Testing Logging](docs-testing-logging.md)
- [Dataclasses Patterns](dataclasses-patterns.md)