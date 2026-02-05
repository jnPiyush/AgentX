---
agent: "Engineer"
description: Analyze and triage bug reports for proper classification and routing
---

# Bug Triage Prompt

## Context
You are triaging a bug report for Issue #{{issue_number}}.

## Instructions

### 1. Gather Information

**From Bug Report:**
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
- Screenshots/logs

**Additional Information Needed:**
- [ ] Can it be reproduced consistently?
- [ ] What is the affected scope?
- [ ] Are there workarounds?
- [ ] When did it start occurring?

### 2. Classify Severity

| Severity | Description | SLA |
|----------|-------------|-----|
| **Critical** | System down, data loss, security breach | 4 hours |
| **High** | Major feature broken, no workaround | 1 day |
| **Medium** | Feature broken with workaround | 3 days |
| **Low** | Minor issue, cosmetic | 1 week |

### 3. Identify Root Cause Area

**Categories:**
- Frontend (UI, UX)
- Backend (API, Logic)
- Database (Data, Query)
- Infrastructure (Deploy, Config)
- External (Third-party, Integration)
- Documentation (Docs, Help)

### 4. Assess Impact

**Questions:**
- How many users affected?
- Is it blocking production?
- Is there data corruption risk?
- Is there a security implication?
- What is the business impact?

### 5. Determine Complexity

| Complexity | Description | Typical Effort |
|------------|-------------|----------------|
| **Simple** | Typo, config change, obvious fix | < 2 hours |
| **Medium** | Logic change, single component | 2-8 hours |
| **Complex** | Multiple components, investigation needed | 1-3 days |
| **Major** | Architecture change, extensive testing | 3+ days |

### 6. Routing Decision

**Route to:**
- **Engineer (Direct)**: Simple bugs, clear fix
- **PM**: Needs product decision
- **Architect**: Needs design review
- **DevOps**: Infrastructure/deployment issue
- **Security**: Potential vulnerability

### 7. Output Format

```markdown
## Bug Triage: Issue #{{issue_number}}

### Classification
- **Severity**: Critical | High | Medium | Low
- **Priority**: P0 | P1 | P2 | P3
- **Category**: [Frontend | Backend | Database | Infra | External]
- **Complexity**: Simple | Medium | Complex | Major

### Impact Assessment
- **Users Affected**: [All | Some | Few]
- **Production Blocking**: Yes | No
- **Data Risk**: Yes | No
- **Security Risk**: Yes | No

### Root Cause Hypothesis
[Brief hypothesis of what's causing the bug]

### Recommended Action
- **Route to**: [Agent/Team]
- **Labels**: [Labels to add]
- **Milestone**: [If applicable]

### Workaround
[If available, describe temporary workaround]

### Additional Context Needed
- [Any missing information needed]
```

### 8. Quick Triage Checklist

- [ ] Bug is reproducible
- [ ] Severity assigned
- [ ] Priority assigned
- [ ] Category determined
- [ ] Root cause hypothesis formed
- [ ] Routed to appropriate agent
- [ ] Labels applied
- [ ] Workaround documented (if exists)

## References
- AGENTS.md for routing rules
- Severity definitions in Skills.md
