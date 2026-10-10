---
title: Validate the Packaged README Instead of Only Its Source
description: Preserve branding and diagram readability across GitHub, Marketplace and extension details.
---

## Cause and correction

- The extension lives under `vscode-extension/`, but vsce inferred image links
  from the repository root. The published logo URL omitted that subdirectory.
  Declare `vsce.baseContentUrl` and `vsce.baseImagesUrl` in the extension
  manifest so all packaging entry points apply the same paths.
- The source Mermaid diagrams parsed successfully. Preview hosts do not all
  render Mermaid fences. Keep `.mmd` as the maintained source and embed PNG
  exports for portable README display; Marketplace also rejects ordinary SVG
  README images.
- Both READMEs use the canonical `frontier-ai-coding-harness.png`, not a second
  independently maintained logo.
- Use compact top-to-bottom diagrams with explicit display widths, white
  backgrounds and useful alt text. Keep source links and rendering commands
  beside the exports so documentation can be maintained without reverse
  engineering the images.

## Verification boundary

- Test vsce's actual README processor, then inspect a real locally built VSIX:
  the rewritten URLs, image bytes and editable sources must all agree.
- Validate local browser rendering at desktop/mobile widths and light/dark
  themes, and click the editable-source links. A local preview is not proof of
  an updated public Marketplace page.
- New image URLs are unavailable publicly until the source is published.
  Updating local files or building a verification-only VSIX does not update
  the installed extension or Marketplace listing.
- The organization-managed gallery may still serve an older extension with
  old branding; repository changes do not refresh that gallery.
