# Prototype Audit Report Template

```markdown
# Prototype Audit -- Issue <issue>

Prototype: <path or URL>
Auditor: prototype-auditor
Date: <yyyy-mm-dd>

## Summary
- Passes: <n>/10
- Fixed automatically: <count>
- Blocked: <count>

## Pass 0: Design-language conformance
- Status: PASS | FIXED | BLOCKED | DEGRADED
- Detector: <version> | not run
- Findings: <count by rule id>
- If DEGRADED, reason: <no network | binary unresolved | node <22.18 | other>

## Pass 1: Accessibility
...
## Pass 2: Performance
...
## Pass 3: Content
...
## Pass 4: Responsive
...
## Pass 5: Routes
...
## Pass 6: Build hygiene
...
## Pass 7: Usability heuristics
...
## Pass 8: Visual regression
...
## Pass 9: Anti-slop self-critique
- Philosophy: <score>/5 -- <one-line justification>
- Hierarchy: <score>/5 -- <one-line justification>
- Execution: <score>/5 -- <one-line justification>
- Specificity: <score>/5 -- <one-line justification>
- Restraint: <score>/5 -- <one-line justification>
- Forbidden tells found: <T-numbers or none>

## Blocked findings (escalate)
- <finding> -- owner: <agent> -- next action: <text>
```