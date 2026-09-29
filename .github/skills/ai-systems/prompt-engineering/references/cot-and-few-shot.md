# Reasoning Guidance & Few-Shot Patterns

## Reasoning Guidance

Current reasoning models (Claude Opus 5.5, GPT-6 Astra) think internally. Control
depth with the provider effort setting, not with prompt phrases. Do not ask them
to "think step by step" or to write out their reasoning: it adds tokens, and
Opus 5.5 can decline it as reasoning extraction. Give the goal, the constraints,
the evidence to check and the output you need.

Classic chain-of-thought phrasing ("Think step by step") is only for models
without built-in reasoning; confirm the benefit with an eval before keeping it.

### Example: Debugging

```text
A test is failing with NullReferenceException at UserService.cs:42.

Identify which variable can be null on that line, the input that reaches that
path, and the minimal fix. Return: root cause (one sentence), evidence (file and
line references), and the patch.
```

### Example: Architecture Decision

```text
We need a caching strategy for our product catalog API.

Weigh data volatility, acceptable staleness (TTL), time- vs event-based
invalidation, and Redis vs in-memory vs CDN. Recommend one approach with a short
justification and the main trade-off you accepted.
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
