---
description: 'Prototype audit report format, failure handling and evidence handoff requirements.'
---

# Prototype Audit Report Template

MUST read when writing the audit report. Fill values only from actual evidence;
unexecuted checks are not passes or zero findings.

## Failure Handling

On timeout, malformed detector output or unstable viewport, mark the affected
result `DEGRADED` and record the observed conditions. Do not crop a desktop capture
and call it a mobile baseline. On reproducible defects, mark `BLOCKED` until fixed
or explicitly accepted by the responsible reviewer. Do not copy prefilled axe or
PASS claims from templates, suppress output, or stop the whole audit at its first
failure. After three unsuccessful fixes, return the blocker and next action.

Repair only owned prototype files, rerun affected checks, and cap each pass at
three cycles. Retain results for unchanged passes without claiming reruns.
Return findings, screenshots, executed commands and unavailable checks to the
reviewer. Approval remains the reviewer's decision, not this skill's score.

## Skills to Compose With

For applicable fixes, MUST read
[browser automation](../../../development/browser-automation/SKILL.md) for axe,
Lighthouse and Playwright; [working prototypes](../../working-prototype-app/SKILL.md)
for route/build context; [craft](../../prototype-craft/SKILL.md) for contrast/motion;
and [error handling](../../../development/error-handling/SKILL.md) for loop discipline.
Pass recipes link accessibility (Pass 1), content (Passes 3/7), heuristics (Pass 7)
and visual regression (Pass 8) ground truth.

## Report

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