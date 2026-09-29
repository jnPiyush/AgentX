---
title: Separate Loop Review from User-Approved Test Execution
description: Preserve review and evidence gates without repeatedly launching suites inside agent loops.
---

## Policy and implementation

- The canonical boundary lives in AGENTS.md and `.github/AGENT-PROTOCOL.md`
  section 1.4. Loops and reviews use non-test verification and inspect authored
  cases. The owning agent asks about suite execution after successful completion.
- A suite offer is not permission. Decline, dismissal or no answer must not
  dispatch a test task. VS Code delegates an affirmative choice to the configured
  native test task rather than guessing a shell command.
- Failure to complete the loop must not produce a test offer. Failure to open
  a post-loop task must not be reported as failure of the already-completed loop.
- Optional passing counts are supplied evidence, not a command to run tests.
  Omitting counts remains valid with legacy integer baselines; explicit malformed
  or regressed values still fail. No omitted value becomes a fabricated zero.
- Keep review scoring, phase registries, role prompts, skills and templates
  aligned with the same boundary. Otherwise a lower-level recipe can reintroduce
  automatic execution even when the core loop never starts a test process.
- CI and release/certification requirements are separate. A reviewed change
  with deferred tests is not a tested or production-certified change.
- Preserve terminal-write and protected-state guards. Use a host test runner
  or configured test task; where the host cannot run an approved suite outside
  an active loop, report that constraint and provide a manual command rather
  than reopening the loop or disabling enforcement.

## Verification limits

The change is checked with type compilation, PowerShell/Node syntax parsing,
frontmatter/schema validation and independent code/policy review. Regression
cases cover approval, decline, dismissal, completion failure, task-launch
failure, optional counts and the CLI follow-up question. Their execution is
offered separately after the implementation loop, not claimed by this document.
