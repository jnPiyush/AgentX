# Agent Memory System

> **Purpose**: Long-term memory for personalized agent responses.  
> **Issue**: #124

---

## Overview

The memory system lets agents learn patterns, preferences, and common mistakes across sessions. Memory stays local (never sent to external APIs) and can be viewed/edited by users.

---

## Structure

```
.agentx/memory/
├── patterns.json       # Code patterns observed
├── preferences.json    # User/team preferences
├── errors.json         # Common mistakes to avoid
└── libraries.json      # Preferred libraries/tools
```

---

## Memory Files

### patterns.json

```json
{
  "patterns": [
    {
      "name": "Repository Pattern",
      "context": "data-access",
      "description": "Uses Repository + Unit of Work for data access",
      "frequency": 12,
      "lastSeen": "2026-02-07",
      "example": "src/Repositories/UserRepository.cs"
    },
    {
      "name": "CQRS",
      "context": "api-design",
      "description": "Separates read/write operations with MediatR",
      "frequency": 5,
      "lastSeen": "2026-02-05",
      "example": "src/Commands/CreateUserCommand.cs"
    }
  ]
}
```

### preferences.json

```json
{
  "preferences": [
    {
      "category": "coding-style",
      "key": "async-pattern",
      "value": "async/await over Task.ContinueWith",
      "confidence": 0.95
    },
    {
      "category": "testing",
      "key": "framework",
      "value": "xUnit with FluentAssertions",
      "confidence": 0.9
    },
    {
      "category": "naming",
      "key": "interface-prefix",
      "value": "Always prefix interfaces with I",
      "confidence": 1.0
    }
  ]
}
```

### errors.json

```json
{
  "errors": [
    {
      "pattern": "Missing null check on navigation properties",
      "frequency": 4,
      "lastOccurrence": "2026-02-06",
      "fix": "Add null check or use ?. operator"
    },
    {
      "pattern": "Forgetting to dispose HttpClient",
      "frequency": 2,
      "lastOccurrence": "2026-02-01",
      "fix": "Use IHttpClientFactory instead"
    }
  ]
}
```

### libraries.json

```json
{
  "libraries": [
    { "name": "Serilog", "category": "logging", "preference": "always" },
    { "name": "FluentValidation", "category": "validation", "preference": "always" },
    { "name": "MediatR", "category": "messaging", "preference": "for-cqrs" },
    { "name": "Polly", "category": "resilience", "preference": "always" }
  ]
}
```

---

## How Agents Use Memory

### Before Implementation

Agent reads memory to personalize approach:

```
1. Read patterns.json → "You typically use Repository pattern"
2. Read preferences.json → "Using xUnit + FluentAssertions"
3. Read errors.json → "Watch for: missing null checks"
4. Read libraries.json → "Use Serilog for logging"
```

### After Implementation

Agent updates memory with new observations:

```
1. New pattern used → Add to patterns.json
2. Library used → Update libraries.json
3. Error caught in review → Add to errors.json
```

---

## Agent Prompt Integration

Agents include memory in their system prompt:

```text
MEMORY CONTEXT:
- This project uses Repository pattern for data access
- Preferred: xUnit + FluentAssertions for testing
- Preferred: Serilog for logging
- Common mistake: Missing null checks on navigation properties
- Always use IHttpClientFactory, never raw HttpClient
```

---

## Privacy

- All memory files stored locally in `.agentx/memory/`
- Never sent to external APIs or LLM providers
- User can view, edit, or delete any memory file
- Add `.agentx/memory/` to `.gitignore` to keep private
- Or commit to repo to share team patterns

---

## Commands

```bash
# View current memory
cat .agentx/memory/patterns.json | python -m json.tool

# Reset all memory
rm -r .agentx/memory/

# Export for team sharing
cp -r .agentx/memory/ team-memory/
```

---

**Related**: [Session Persistence](../docs/session-persistence.md) • [AGENTS.md](../AGENTS.md)

**Last Updated**: February 7, 2026
