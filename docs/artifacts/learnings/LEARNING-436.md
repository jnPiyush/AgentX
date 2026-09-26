---
title: Align Current Versions Without Rewriting History
description: Distinguish current release metadata from historical versions and regenerate hash-bearing artifacts.
---

## Version alignment

- For #436, align current project metadata, installer URLs, documentation and
  new artifacts to 9.5.0 without relabelling the published 9.4.1 release.
- Keep dependency versions, upgrade fixtures, historical release notes and
  independent asset revisions separate from the current project version.
- Regenerate an install manifest through its existing generator. Changing only
  its version string leaves its file hashes stale.
- Refresh local CLI version metadata without changing the original installation
  timestamp or claiming a deployment occurred.
- Verify the new package identity, source contents and provenance independently
  of the previous version's checksums and CI evidence.
