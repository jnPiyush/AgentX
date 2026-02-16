# Python Async, Error Handling & Context Managers

## Async Programming

```python
import asyncio
from typing import List

# [PASS] GOOD: Async function with proper types
async def fetch_user(user_id: int) -> dict[str, Any]:
 """Fetch user data from API."""
 async with aiohttp.ClientSession() as session:
 async with session.get(f"/users/{user_id}") as response:
 return await response.json()

# [PASS] GOOD: Parallel async operations
async def fetch_multiple_users(user_ids: List[int]) -> List[dict[str, Any]]:
 """Fetch multiple users in parallel."""
 tasks = [fetch_user(user_id) for user_id in user_ids]
 return await asyncio.gather(*tasks)

# [PASS] GOOD: Async context manager
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

# [PASS] GOOD: Async generator
async def stream_large_dataset():
 """Stream large dataset without loading all into memory."""
 async with DatabaseConnection() as conn:
 async for row in conn.cursor("SELECT * FROM large_table"):
 yield process_row(row)
```

---

## Error Handling

```python
# [PASS] GOOD: Specific exceptions
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

# [PASS] GOOD: Context-specific exception handling
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

# [FAIL] BAD: Bare except
try:
 do_something()
except: # Don't do this!
 pass
```

---

## Context Managers

```python
from contextlib import contextmanager
from typing import Generator

# [PASS] GOOD: Custom context manager
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
