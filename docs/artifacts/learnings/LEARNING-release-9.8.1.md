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

## PR 450 Follow-Up

* A clean audit is not proof that `npm ci` can install the lockfile. The merged
  collaboration lock selected ip-address 10.7.3 while its override still forced
  10.7.2. Align the override with the patched resolution and validate all runtime
  manifests with `npm ci --dry-run --ignore-scripts --no-audit --offline` before
  relying on audit results.
* Exact initialization footprint tests must include intentional new managed
  launchers. PR 450 CI passed 1181 extension tests but failed the single fixture
  that omitted `.frontier/runtime/policy-hook.js`; keep the exact assertion and
  add the intended file rather than loosening it.
* Redirect long `gh run watch` output to a file. Its alternate terminal screen
  can obscure subsequent command results; inspect actual loop state after
  recovering the terminal instead of assuming a gate command ran.

Evidence: PR 450 runs 38058505751 and 38058505810 on bc996d6d; local
`build/pr450-repair1.json` records the focused non-test checks.

## Release Preflight Recovery

* Release run 38060260841 passed extension validation but failed one of 29 MCP
  tests before creating v9.8.1. The real-CLI fixture copied guided-interaction.ps1
  without its required workspace-state.ps1 dependency. Keep that fixture complete
  and run the MCP test/audit gate in PR CI, not only after merge.
* A failed untagged source version needs a retry path when its repair does not
  change version.json. Gate retries on the tag being absent and retain successful
  preflight as a publication requirement; never fabricate an early tag or move an
  existing tag to work around a failed release.