---
description: 'Python specific coding instructions for production code.'
applyTo: '**.py, **.pyx'
---

# Python Instructions

## Code Style

- Follow PEP 8 style guide
- Use type hints for all function signatures (PEP 484)
- Maximum line length: 88 characters (Black formatter)
- Use `ruff` for linting and formatting

## Type Hints

```python
from typing import Optional, List, Dict, Any
from collections.abc import Callable, Awaitable

def get_user(user_id: str) -> Optional[User]:
 """Retrieve user by ID."""
 ...

async def process_items(
 items: List[Item],
 callback: Callable[[Item], Awaitable[None]]
) -> Dict[str, Any]:
 """Process items with callback."""
 ...
```

## Docstrings

Use Google style docstrings:

```python
def calculate_price(
 base_price: float,
 discount: float = 0.0,
 tax_rate: float = 0.1
) -> float:
 """Calculate the final price with discount and tax.

 Args:
 base_price: The original price before adjustments.
 discount: Discount percentage (0.0 to 1.0). Defaults to 0.0.
 tax_rate: Tax rate to apply (0.0 to 1.0). Defaults to 0.1.

 Returns:
 The final calculated price.

 Raises:
 ValueError: If base_price is negative.

 Example:
 >>> calculate_price(100.0, discount=0.1, tax_rate=0.08)
 97.2
 """
 if base_price < 0:
 raise ValueError("base_price cannot be negative")
 return base_price * (1 - discount) * (1 + tax_rate)
```

## Error Handling

```python
# [PASS] Catch specific exceptions
try:
 result = await process_data(data)
except ValidationError as e:
 logger.warning("Validation failed: %s", e)
 raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
 logger.exception("Unexpected error processing data")
 raise
```

## Async/Await

```python
import asyncio
from typing import List

async def fetch_all(urls: List[str]) -> List[Response]:
 """Fetch multiple URLs concurrently."""
 async with aiohttp.ClientSession() as session:
 tasks = [fetch_one(session, url) for url in urls]
 return await asyncio.gather(*tasks)
```

## Testing

- Use pytest for testing
- Use pytest-asyncio for async tests
- Use pytest-cov for coverage
- Name tests: `test_function_name_scenario_expected`

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_get_user_returns_user_when_found():
 # Arrange
 mock_repo = AsyncMock()
 mock_repo.get.return_value = User(id="123", name="Test")
 service = UserService(mock_repo)

 # Act
 result = await service.get_user("123")

 # Assert
 assert result is not None
 assert result.name == "Test"
 mock_repo.get.assert_called_once_with("123")
```

