# Learning: Generated Assets Are Not Independent Sources

- Repository-wide duplicate hashes identify candidates, not permission to delete.
  Extension bundles, compatibility documents, seed trees and licenses can have
  distinct installation or relative-link contracts.
- Keep generated extension compatibility documents and build scratch files
  (`tsc-out.txt`) ignored and untracked. Generate each transformed
  compatibility document once from the canonical root sources and share the
  markdown-rewrite loop across bundled and seed targets; do not copy raw
  documents and overwrite them later.
- Preserve nested Git workspaces with uncommitted or divergent files. A nested
  workspace is not equivalent to an extension build artifact.
- Validate behavior-preserving packaging changes against pre-change output
  hashes and the generator's read-only parity check. Scope out intentional
  source-document updates when comparing generated output.
- Evidence: #455, tracked-file duplicate inventory (29 compatibility documents
  and 1 scratch file untracked), nested workspace comparison, scrub verification,
  and generated asset parity checks performed on 2026-10-13.
