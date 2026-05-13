# VS Extension Smoke-Test Screenshots

This folder holds screenshots captured during a manual run of [`docs/ux/vs-extension-smoke-test.md`](../../vs-extension-smoke-test.md). Filenames must match the placeholders in the checklist so a reviewer can scan the table and the file at the same time.

## Naming convention

```
<section-number>-<topic>-<state>.png
```

For example:

| Checklist row | Filename                       |
|---------------|--------------------------------|
| 2.1           | `02-install-installer.png`     |
| 4.5           | `04-status-fallback.png`       |
| 6.3           | `06-loop-iterate.png`          |
| 11.1          | `11-uninstall-marked.png`      |

## Capture guidance

- **Resolution**: 1920x1080 minimum. Crop to the relevant tool window or dialog.
- **Format**: PNG (lossless, supports transparency).
- **Privacy**: redact tenant names, repository URLs, and any local paths that include real user names. Use `agentx-bootstrapped-repo` as the visible workspace name in screenshots when convenient.
- **Theme**: capture in the default Visual Studio dark theme. The extension renders correctly in light mode too; that variant is optional.
- **Avoid placeholder PNGs**. If a row cannot be captured (skipped step, irreproducible failure), leave the file out and write the explanation in the row's notes column on the checklist.

## Sign-off

When the full 11-section checklist passes:

1. Replace any older PNGs from prior smoke passes.
2. Fill in the sign-off block at the bottom of [`vs-extension-smoke-test.md`](../../vs-extension-smoke-test.md).
3. Commit the screenshots and the updated checklist on the same branch as the version bump that flips `Preview="false"`.
