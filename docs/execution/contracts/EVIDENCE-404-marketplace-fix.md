# Evidence Summary: v8.7.0 Marketplace Provenance Fix

## Incident

Marketplace run `31283100869` downloaded the attested `v8.7.0` VSIX and passed extension
quality gates, but `gh attestation verify` exited 4 because the step did not expose
`GH_TOKEN`. Publication was skipped, so no unverified artifact reached the Marketplace.

## Fix

Provide `${{ github.token }}` only to the provenance-verification step. Workflow permissions
remain `attestations: read` and `contents: read`; Marketplace publication still requires the
existing `VSCE_PAT` secret and the exact downloaded release VSIX.

## Verification

- Workflow YAML diagnostics and `git diff --check`: passed.
- Release contains one VSIX; its SHA-256 and repository SLSA attestation verify.
- Incident log confirms publication was skipped before the fix.
- AgentX Reviewer: APPROVED with 0 HIGH, 0 MEDIUM, and 0 LOW findings.

The token is unavailable to dependency, download, and publish steps; `VSCE_PAT` remains publish-only.

Manual-dispatch and release-download boundaries prevent fork-triggered secret exposure.

The downloaded release VSIX verifies against the repository's default SLSA provenance policy.

Final source review closed with no findings; publication remains to be rerun after merge.

The fix is ready for protected merge and one Marketplace retry for `v8.7.0`.