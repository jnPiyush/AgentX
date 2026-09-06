---
name: "Bug Triage"
agent: "AgentX Engineer"
description: Analyze and triage bug reports for proper classification and routing
inputs:
 issue_number:
 description: "Issue number for the bug report"
 required: true
 default: ""
---

# Bug Triage Prompt

## Context
Triage Issue #{{issue_number}} using the report and repository evidence. Triage
does not authorize a code fix, production mutation or unrequested issue updates.
Use [AGENTS.md](../../AGENTS.md) for actual role routing and
[systematic debugging](../skills/development/systematic-debugging/SKILL.md) for
reproduction and hypothesis testing.

## Workflow

1. Collect expected/actual behavior, minimal reproduction, affected version,
   environment, logs, onset and recent changes. Redact secrets and sensitive data.
2. Attempt a safe reproduction using existing tools. Record reproduced,
   not-reproduced or blocked with evidence and exact limitations. An unconfirmed
   report is not evidence that no bug exists.
3. Assess user/business impact, production blocking, data loss and security risk.
   Mark missing facts unknown, not false. Keep observation, hypothesis and
   confirmed root cause separate; state confidence and the next discriminating
   test.
4. Apply the project's severity and priority policy. If unavailable, use the
   provisional impact guide below and state that it is provisional. Do not invent
   response SLAs, deadlines, effort estimates or service commitments.
5. Identify affected components and dependencies; route through the existing
   role registry. Separate product decisions, design questions and operational
   failures. Escalate suspected security/data-loss risks through the project's
   authorized process without exposing sensitive details.
6. Recommend the smallest next action and any verified safe workaround. State
   whether labels/routing were proposed or actually applied. Any subsequent fix
   follows the implementation pipeline, tests and mandatory documentation-drift
   review; do not bypass those gates during triage.

## Provisional Severity Guide

| Severity | Observed impact |
|----------|-----------------|
| Critical | System unavailable, data loss or confirmed security breach |
| High | Major capability broken with no viable workaround |
| Medium | Capability impaired with a viable workaround |
| Low | Limited, non-blocking impact |

Severity describes impact; priority also depends on urgency and project policy.
Do not downgrade an unverified high-impact report merely because reproduction
is currently blocked.

## Output

- Classification: severity/priority with rationale, component and routing target.
- Evidence: reproduction status, expected/actual behavior and affected environment.
- Impact: users, production, data and security; retain unknowns explicitly.
- Hypothesis: evidence, confidence and the next test, or confirmed root cause.
- Recommended action: owner, proposed labels and verified workaround if any.
- Open questions: missing context, blocked checks and immediate escalation needs.
