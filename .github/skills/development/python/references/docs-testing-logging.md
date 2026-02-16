# Python Docstrings, Testing & Logging

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

# [PASS] GOOD: Structured logging with parameters
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

# [PASS] GOOD: Log levels
logger.debug("Detailed debug information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error occurred")
logger.exception("Exception with traceback")
logger.critical("Critical error")

# [FAIL] BAD: String formatting in log call
logger.info(f"Processing user {user_id}") # Formats even if not logged
```

---
