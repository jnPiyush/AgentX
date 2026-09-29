---
title: Separate Advisory Lint from Required Defect Fixes
description: Keep cosmetic cleanup optional without hiding failures or weakening independent strict gates.
---

## Local loop and review contract

- Cosmetic lint/style findings are LOW advisories, not local Done Criteria.
  Report paths, rules, original tool severity and proposed cleanup scope.
- The owner explicitly asks before cleanup. Selecting an auto-fix role or
  mentioning the word "fix" is not consent for incidental formatting changes.
- `scrub -Advisory` is read-only and non-blocking for hygiene candidates. It
  preserves original severity and production-blocker metadata, so a successful
  advisory scan must not be described as clean lint or a passed strict gate.
- Advisory mode rejects `-Fix` and `-Production` combinations before scanning.
  Missing/unreadable inputs still fail. Existing default and production modes
  remain unchanged.
- A proven build/type, correctness, security, reliability or accessibility
  defect keeps its impact-based severity, even if a linter discovered it.
- Cleanup consent and post-loop test consent are separate decisions. No
  affirmative answer means no cleanup or test execution for that offer.
