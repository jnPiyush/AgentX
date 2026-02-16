# Pattern: Memory Systems

> **Goal**: Define standard schemas for Short-term (Session) and Long-term (Entity) memory.

---

## 1. Memory Types

| Type | Persistence | Storage | Purpose |
|------|-------------|---------|---------|
| **Short-term** | Session only | Redis / InMemory | Conversation history, immediate context. |
| **Long-term** | Indefinite | CosmosDB / SQL | User preferences, facts learned about user. |
| **Working** | Task duration | Agent State | Current plan steps, reasoning scratchpad. |

## 2. Short-term Memory (Conversation History)

**Schema**:
```json
{
 "session_id": "sess_123",
 "messages": [
 { "role": "user", "content": "My name is Piyush." },
 { "role": "assistant", "content": "Hello Piyush!" }
 ],
 "window_strategy": "sliding_window_summary",
 "max_tokens": 4000
}
```

**Summarization Pattern**:
When history > `threshold` tokens:
1. Summarize first 50% of messages into a `system_message` update.
2. Keep last 50% raw.

## 3. Long-term Memory (Entity Store)

**Schema (CosmosDB NoSQL)**:
```json
{
 "user_id": "user_456",
 "facts": [
 {
 "key": "programming_language",
 "value": "python",
 "confidence": 0.9,
 "source_message_id": "msg_88"
 },
 {
 "key": "cloud_provider",
 "value": "azure",
 "confidence": 1.0,
 "source_message_id": "msg_92"
 }
 ],
 "preferences": {
 "tone": "concise",
 "theme": "dark"
 }
}
```

## 4. Implementation Code (Python)

```python
class MemoryManager:
 def __init__(self, session_id):
 self.history = RedisHistory(session_id)
 self.profile = CosmosDBProfile(user_id)

 async def add_interaction(self, user_msg, ai_msg):
 # 1. Update Short-term
 await self.history.add_pair(user_msg, ai_msg)
 
 # 2. Extract Facts (Background Task)
 facts = await extract_entities(user_msg)
 if facts:
 await self.profile.upsert_facts(facts)

 async def get_context(self):
 # Merge history + relevant profile facts
 history = await self.history.get_recent(k=10)
 profile = await self.profile.get_all()
 return build_prompt(history, profile)
```
