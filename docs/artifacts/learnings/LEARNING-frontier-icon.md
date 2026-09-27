---
title: Keep Brand Icon Surfaces Consistent
description: Reuse canonical icon artwork across editor, Marketplace, website and Teams surfaces.
---

## Icon ownership

- Release tracking: #437. Build the release from selected source files when
  unrelated agent edits remain in the worktree; package contents must match the
  committed source rather than an earlier working-tree preview.
- Use the coloured SVG as the vector master, the 256x256 transparent PNG for
  Marketplace/chat surfaces, and matching monochrome paths for the themed Activity
  Bar. Do not use a coloured SVG as the Marketplace package icon.
- Generate website/logo copies through the existing landing build. Keep prototype
  and generated-site paths valid without maintaining separate artwork.
- Derive Teams colour and white-outline images from the same silhouette rather
  than drawing a different initial. Test dimensions, alpha and white visible pixels.
- An icon change requires checking manifest paths, compiled chat wiring,
  documentation, packaging and small-screen rendering, not just replacing a file.
- Preserve functional codicons, layout and theme tokens during a brand-icon update.
  An unpublished local preview does not replace an existing release.
