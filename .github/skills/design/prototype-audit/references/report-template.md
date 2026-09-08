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
- Detector: <native version, SHA256, command, exit, JSON evidence path> | not run
- Findings: <primary and advisory counts by rule id; waiver review separately>
- Coverage: <eligible files, limitations, token semantic review; scanned count unknown>
- If DEGRADED, reason: <exact gate reason; stderr; unavailable checks>
- Required fallback checks: T1-T10 + Honest Placeholders + axe + Pass 9 critique
- Actually run: <commands, results and evidence>
- Not run: <checks and reasons>

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