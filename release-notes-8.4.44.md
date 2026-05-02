## v8.4.44 - Reviewer Template-Enforcement Fix

Patch release. Closes the gap where the Reviewer agent could draft an architecture review without picking up the canonical `ARCH-REVIEW-TEMPLATE.md`.

### Fixed
- **Reviewer agent** (`.github/agents/reviewer.agent.md`):
  - New hard frontmatter constraint: MUST use canonical templates, MUST `read_file` the template FIRST and copy its full section structure before populating.
  - Standalone Architecture Document Review path: rewrote step 3 with explicit `.github/templates/ARCH-REVIEW-TEMPLATE.md` path, full section list (Pre-Review Gates, Dimension Coverage Matrix, Findings, STRIDE, NFR Traceability, ATAM, Decision), and `mode: standalone` frontmatter.
  - Code Review Step 6: hard rule prefix requiring `read_file` of `REVIEW-TEMPLATE.md` first; cross-references the standalone arch-review path.

### Why this matters
The internal Architecture Reviewer sub-agent already had the rule, but is `visibility: internal`. When a user invoked `@AgentX Reviewer` in chat for a standalone arch review, the parent Reviewer ran directly and the soft "using ARCH-REVIEW-TEMPLATE.md" wording let it draft from memory instead of from the template.

### Verification
- 335/335 frontmatter checks pass
- ASCII clean
- Source and bundled extension assets in sync
- 5-iteration quality loop with subagent APPROVED

### Install
Download `agentx-8.4.44.vsix` and install via VS Code: Extensions panel -> `...` menu -> Install from VSIX.
