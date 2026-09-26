---
title: Applying Reviewed Instruction Changes
description: Apply instruction optimizations without losing newer edits, safeguards, or distribution consistency.
---

## Lessons

- Reconcile a proposal with current working-tree content before applying it.
  Preserve newer rules, such as the canonical suite-policy reference in
  [verification before completion](../../../.github/skills/development/verification-before-completion/SKILL.md),
  instead of replacing the file with an older proposed copy.
- Consolidate duplicated decisions in their existing table or section. Keep
  exceptions and safeguards prominent; a shorter file does not justify another
  reference dependency.
- Archive originals and validation evidence outside the repository's
  implementation scope. Copied supporting scripts are backup data, but a file
  classifier may otherwise count them as new implementation. Do not alter gates
  or fabricate implementation scores to hide that mismatch.
- Regenerate registries and bundled assets through the existing generators.
  Check canonical descriptions and both bundled path layouts rather than
  maintaining separate instruction copies by hand.
- Compare catalogue descriptions with parsed frontmatter, not just inventory
  paths. Folded YAML descriptions must retain their text rather than exposing
  the `>-` marker as the description.
- Distribution tests must use the installed `.frontier/runtime/frontier.ps1`
  launcher. Keep exit-code and baseline-artifact assertions when correcting a
  stale test path; do not skip the failed installation check.
- Verify exact edit mappings, retained commands/examples, and pre-existing user
  changes. Separate LF-normalized character reductions and deterministic
  no-regression checks from unexecuted model-quality or latency claims.
