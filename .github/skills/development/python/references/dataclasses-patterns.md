# Python Dataclass Patterns

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

@dataclass(frozen=True) # Immutable
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
