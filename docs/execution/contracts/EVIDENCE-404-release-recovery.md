# Evidence Summary: v8.7.0 Release Recovery

## Incident

The fixed-source `v8.7.0` tag and GitHub release were created from master commit `80072b8`,
but the package job invoked version stamping before `npm ci`. Asset synchronization therefore
could not find the bundled YAML runtime and stopped before VSIX, SBOM, attestation, or upload.

## Recovery design

- Keep `v8.7.0` fixed at the published source commit.
- Install extension dependencies before version stamping for normal and recovery runs.
- Add a separate manual recovery workflow with one validated SemVer tag input.
- Resolve the fully qualified tag ref to a commit, require that it is reachable from master,
	verify the existing release and source version, and checkout the resolved commit SHA.
- Reuse the same extension/MCP quality gates, package, SBOM, attestation, and upload steps.
- Add signed recovery-source predicates that bind both release subjects to the resolved tag
	commit, while retaining default SLSA provenance and signed CycloneDX SBOM attestations.
- Upload with `--clobber` because the release remains mutable and a failed partial run may be
	retried to a convergent asset set without changing the tag. Asset replacement is not atomic;
	Marketplace publication remains blocked until the full recovery run and provenance checks pass.

## Verification

- Injection-shaped tag inputs are rejected before any side effect.
- `v8.7.0`, the release target, source version, and resolved commit agree on
	`80072b855c96f6cd2b3256ba8c846fb4cd90e8c6` and `8.7.0`.
- Normal push triggers remain unchanged; dependency installation precedes stamping.
- Default SLSA provenance, custom recovery-source predicates, and SBOM attestations exist for
	both release subjects.
- Workflow YAML diagnostics and `git diff --check` pass.
- Framework regression suite: 167/167 passed.
- AgentX Reviewer: APPROVED with 0 HIGH, 0 MEDIUM, and 0 LOW findings.

The workflow is ready for commit, protected CI, and one fixed-tag recovery dispatch.

Correctness checks cover exact tag/ref/source/release consistency before repository code runs.

Security review confirms strict SemVer input, quoted environment use, commit-SHA checkout,
job-scoped write/OIDC permissions, and signed source/SLSA/SBOM predicates.

Full framework evidence remains 167/167; both workflow YAML files and the complete diff parse cleanly.

Final independent recovery review closed with no findings.

The recovery workflow is ready for protected merge and a single `v8.7.0` dispatch.
