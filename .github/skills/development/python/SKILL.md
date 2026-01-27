---
description: 'Python development best practices for production-ready code'
---

# Python Development

> **Purpose**: Production-ready Python development standards for building secure, performant, maintainable applications.  
> **Audience**: Engineers building Python applications, APIs, data pipelines, or AI/ML systems.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) Python development patterns.

---

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Type hints** | Use everywhere | `def get_user(id: int) -> Optional[User]:` |
| **Async code** | Use `async`/`await` | `async def fetch_data() -> str:` |
| **Error handling** | Specific exceptions | `try-except ValueError` |
| **Testing** | pytest | `def test_user_creation():` |
| **Logging** | Standard library | `logger.info("User %s created", user_id)` |
| **Docstrings** | Google style | `"""Gets user by ID.\n\nArgs:\n    id: User identifier` |

---

## Python Version

**Current**: Python 3.11+  
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

## Async Programming

```python
import asyncio
from typing import List

# ✅ GOOD: Async function with proper types
async def fetch_user(user_id: int) -> dict[str, Any]:
    """Fetch user data from API."""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"/users/{user_id}") as response:
            return await response.json()

# ✅ GOOD: Parallel async operations
async def fetch_multiple_users(user_ids: List[int]) -> List[dict[str, Any]]:
    """Fetch multiple users in parallel."""
    tasks = [fetch_user(user_id) for user_id in user_ids]
    return await asyncio.gather(*tasks)

# ✅ GOOD: Async context manager
class DatabaseConnection:
    async def __aenter__(self):
        self.conn = await asyncpg.connect(DATABASE_URL)
        return self.conn
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.conn.close()

# Usage
async def get_users():
    async with DatabaseConnection() as conn:
        return await conn.fetch("SELECT * FROM users")

# ✅ GOOD: Async generator
async def stream_large_dataset():
    """Stream large dataset without loading all into memory."""
    async with DatabaseConnection() as conn:
        async for row in conn.cursor("SELECT * FROM large_table"):
            yield process_row(row)
```

---

## Error Handling

```python
# ✅ GOOD: Specific exceptions
class UserNotFoundError(Exception):
    """Raised when user is not found."""
    pass

class ValidationError(Exception):
    """Raised when validation fails."""
    pass

def get_user(user_id: int) -> User:
    """Get user by ID.
    
    Args:
        user_id: User identifier
    
    Returns:
        User object
    
    Raises:
        ValueError: If user_id is invalid
        UserNotFoundError: If user not found
    """
    if user_id <= 0:
        raise ValueError(f"Invalid user_id: {user_id}")
    
    user = db.query(User).filter_by(id=user_id).first()
    if user is None:
        raise UserNotFoundError(f"User {user_id} not found")
    
    return user

# ✅ GOOD: Context-specific exception handling
def process_order(order_id: int) -> None:
    try:
        order = get_order(order_id)
        validate_order(order)
        process_payment(order)
    except ValidationError as e:
        logger.warning("Order validation failed: %s", e)
        raise
    except PaymentError as e:
        logger.error("Payment processing failed: %s", e)
        send_failure_notification(order_id)
        raise
    except Exception as e:
        logger.exception("Unexpected error processing order %s", order_id)
        raise

# ❌ BAD: Bare except
try:
    do_something()
except:  # Don't do this!
    pass
```

---

## Docstrings (Google Style)

```python
def calculate_price(base_price: float, discount: float = 0.0, tax_rate: float = 0.0) -> float:
    """Calculate final price with discount and tax.
    
    Args:
        base_price: The original price before modifications
        discount: Discount percentage (0-100), defaults to 0
        tax_rate: Tax rate percentage (0-100), defaults to 0
    
    Returns:
        The final calculated price
    
    Raises:
        ValueError: If base_price is negative or discount/tax_rate out of range
    
    Examples:
        >>> calculate_price(100.0, discount=10.0, tax_rate=5.0)
        94.5
        
        >>> calculate_price(100.0)
        100.0
    """
    if base_price < 0:
        raise ValueError("base_price cannot be negative")
    if not 0 <= discount <= 100:
        raise ValueError("discount must be between 0 and 100")
    if not 0 <= tax_rate <= 100:
        raise ValueError("tax_rate must be between 0 and 100")
    
    price_after_discount = base_price * (1 - discount / 100)
    final_price = price_after_discount * (1 + tax_rate / 100)
    return final_price

class UserRepository:
    """Repository for user data access.
    
    Provides methods for CRUD operations on users.
    
    Attributes:
        db: Database connection instance
        cache: Optional cache instance for performance
    """
    
    def __init__(self, db: Database, cache: Optional[Cache] = None):
        """Initialize repository.
        
        Args:
            db: Database connection
            cache: Optional cache instance
        """
        self.db = db
        self.cache = cache
```

---

## Testing with pytest

```python
import pytest
from unittest.mock import Mock, patch

# Test fixtures
@pytest.fixture
def user():
    """Create a test user."""
    return User(id=1, name="John Doe", email="john@example.com")

@pytest.fixture
def user_repository():
    """Create a mock user repository."""
    return Mock(spec=UserRepository)

# Basic test
def test_user_creation():
    """Test user can be created with valid data."""
    user = User(id=1, name="Alice", email="alice@example.com")
    assert user.name == "Alice"
    assert user.email == "alice@example.com"
    assert user.is_active is True

# Parametrized tests
@pytest.mark.parametrize("user_id,expected", [
    (1, True),
    (999, False),
])
def test_user_exists(user_id: int, expected: bool):
    """Test user existence check."""
    assert user_exists(user_id) == expected

# Exception testing
def test_invalid_user_id_raises_error():
    """Test that negative user_id raises ValueError."""
    with pytest.raises(ValueError, match="Invalid user_id"):
        get_user(-1)

# Async testing
@pytest.mark.asyncio
async def test_fetch_user():
    """Test async user fetching."""
    user_data = await fetch_user(1)
    assert user_data["id"] == 1
    assert "name" in user_data

# Mocking
def test_user_service_with_mock(user_repository):
    """Test UserService with mocked repository."""
    user = User(id=1, name="Test")
    user_repository.get_by_id.return_value = user
    
    service = UserService(user_repository)
    result = service.get_user(1)
    
    assert result == user
    user_repository.get_by_id.assert_called_once_with(1)
```

---

## Logging

```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# ✅ GOOD: Structured logging with parameters
def process_user(user_id: int) -> None:
    logger.info("Processing user %s", user_id)
    
    try:
        user = get_user(user_id)
        logger.debug("User data: %s", user)
        
        process_user_data(user)
        logger.info("User %s processed successfully", user_id)
    
    except Exception as e:
        logger.exception("Error processing user %s", user_id)
        raise

# ✅ GOOD: Log levels
logger.debug("Detailed debug information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error occurred")
logger.exception("Exception with traceback")
logger.critical("Critical error")

# ❌ BAD: String formatting in log call
logger.info(f"Processing user {user_id}")  # Formats even if not logged
```

---

## Dataclasses

```python
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

@dataclass
class User:
    """User data model."""
    id: int
    name: str
    email: str
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Validate after initialization."""
        if not self.email or '@' not in self.email:
            raise ValueError(f"Invalid email: {self.email}")

@dataclass(frozen=True)  # Immutable
class Config:
    """Immutable configuration."""
    api_url: str
    timeout: int = 30
    retry_count: int = 3

# Usage
user = User(id=1, name="Alice", email="alice@example.com")
config = Config(api_url="https://api.example.com")
```

---

## Context Managers

```python
from contextlib import contextmanager
from typing import Generator

# ✅ GOOD: Custom context manager
@contextmanager
def database_transaction() -> Generator[Connection, None, None]:
    """Context manager for database transactions."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# Usage
with database_transaction() as conn:
    conn.execute("INSERT INTO users ...")

# Class-based context manager
class Timer:
    """Context manager for timing code execution."""
    
    def __enter__(self):
        self.start = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration = time.time() - self.start
        print(f"Execution took {self.duration:.2f} seconds")

with Timer() as timer:
    expensive_operation()
```

---

## Best Practices Summary

### Code Style (PEP 8)

```python
# ✅ GOOD: Follow PEP 8
def calculate_total(items: List[Item]) -> float:
    """Calculate total price of items."""
    return sum(item.price * item.quantity for item in items)

# Variable naming
user_count = 10  # snake_case for variables
MAX_RETRIES = 3  # UPPER_CASE for constants
UserService    # PascalCase for classes

# ✅ GOOD: List comprehensions
active_users = [u for u in users if u.is_active]

# ❌ BAD: Mutable default arguments
def add_item(item, items=[]):  # Don't do this!
    items.append(item)
    return items

# ✅ GOOD: Use None as default
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Performance

```python
# ✅ GOOD: Use generators for large datasets
def process_large_file(filename: str):
    """Process large file line by line."""
    with open(filename) as f:
        for line in f:  # Generator - memory efficient
            yield process_line(line)

# ✅ GOOD: Use collections.defaultdict
from collections import defaultdict

user_groups = defaultdict(list)
for user in users:
    user_groups[user.group].append(user)

# ✅ GOOD: Use set for membership testing
valid_ids = {1, 2, 3, 4, 5}
if user_id in valid_ids:  # O(1) lookup
    process_user(user_id)
```

---

## Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **Mutable defaults** | `def func(items=[]):` | Use `items=None` then `if items is None: items = []` |
| **Missing type hints** | No type information | Add types everywhere |
| **Broad exceptions** | `except Exception:` | Catch specific exceptions |
| **No docstrings** | Undocumented code | Add Google-style docstrings |
| **String concatenation** | `s = s + "text"` in loop | Use `"".join(list)` or f-strings |
| **Not using context managers** | Manual file.close() | Use `with open(...) as f:` |

---

## Project Structure

```
my_project/
├── src/
│   ├── my_project/
│   │   ├── __init__.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── user_service.py
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   └── user_repository.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── helpers.py
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_services.py
│   └── test_repositories.py
├── requirements.txt
├── pyproject.toml
├── README.md
└── .gitignore
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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md)

**Last Updated**: January 27, 2026
