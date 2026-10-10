---
title: Validate Release Automation Against Current Documentation
description: Release 9.8.1 repairs for PR 439 and issue 411.
status: reviewed
confidence: 0.9
observations: 3
---

# Validate Release Automation Against Current Documentation

* PR #439 / issue #411: removing published-version claims from documentation
  also requires updating strict version-stamper patterns and regression cases.
  Keep source badges stampable without fabricating a published tag or rewriting
  historical package availability. Validate with the real stamper entry point.
* An independently reviewed local loop is not proof that remote CI will pass.
  Run the actual plan-schema and lint-ratchet commands; parse/type checks alone
  missed five required headings and six curly findings in the preceding commit.
* Dependency audits can change after a successful earlier release check. Patch
  the exact reported packages, preserve lockfile integrity and canonical public
  URLs, and re-audit each shipped runtime. Do not raise thresholds or disable TLS
  to obtain a pass. Clean installation still requires CI confirmation.
* Protected master needs code-owner approval. A local agent review does not
  substitute for that approval, and tagging early would bypass release preflight.

Evidence: PR 439 CI runs 37995035783, 37995035810 and 37995035687;
`docs/execution/plans/EXEC-PLAN-release-9.8.1.md`;
`build/release-9.8.1-blockers.json`; `build/release-9.8.1-audits.json`.