# Chain-of-Thought & Few-Shot Patterns

## Chain-of-Thought (CoT)

Use when the AI needs to reason through a problem step by step.

### Trigger Phrases

```text
Think step by step:
1. First, identify the input types
2. Then, check for edge cases
3. Finally, write the implementation
```

### Example: Debugging

```text
A test is failing with NullReferenceException at UserService.cs:42.

Think step by step:
1. What is on line 42?
2. What variables could be null?
3. What inputs cause this path?
4. What is the minimal fix?

Show your reasoning, then provide the fix.
```

### Example: Architecture Decision

```text
We need a caching strategy for our product catalog API.

Think through these tradeoffs:
1. What data changes frequently vs. rarely?
2. What is the acceptable staleness (TTL)?
3. Cache invalidation: time-based vs. event-based?
4. Redis vs. in-memory vs. CDN?

Recommend one approach with justification.
```

---

## Few-Shot Examples

Provide 2-3 examples to establish a pattern.

### Format

```text
Convert these requirements into user stories.

Example 1:
Requirement: "Users should be able to reset their password"
Story: "As a user, I want to reset my password via email so that I can regain account access"
Acceptance Criteria:
- [ ] Email sent within 30 seconds
- [ ] Link expires after 24 hours
- [ ] Password must meet complexity rules

Example 2:
Requirement: "Admin can disable user accounts"
Story: "As an admin, I want to disable user accounts so that I can manage access control"
Acceptance Criteria:
- [ ] Disabled users cannot log in
- [ ] Admin sees confirmation dialog
- [ ] Audit log entry created

Now convert this requirement:
Requirement: "{user_requirement}"
```

### When to Use Few-Shot

| Scenario | Examples Needed |
|----------|-----------------|
| Output formatting | 2 examples |
| Classification | 3+ examples (one per class) |
| Code generation | 1-2 (show style) |
| Data transformation | 2 examples (show input->output) |

---
