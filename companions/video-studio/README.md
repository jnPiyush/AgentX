# Frontier Video Studio

Programmatic persona demo videos rendered with [Remotion](https://www.remotion.dev/).

Three compositions, each 60 seconds at 1920x1080 / 30 fps, scripted to match the prompts used in the landing page tab section.

## Compositions

| ID | Persona | Prompt shown | Output |
|----|---------|--------------|--------|
| `PMDemo` | Product Manager | "Create a PRD for a customer feedback widget" | `out/pm.mp4` |
| `ArchitectDemo` | Architect | "Design the architecture for the feedback widget" | `out/architect.mp4` |
| `UXDemo` | UX Designer | "Design the UX for the feedback widget" | `out/ux.mp4` |

Captions are maintained WebVTT assets in `public/*.vtt`; there is no automatic
caption-generation command. The current static landing page does not load them.

## Setup

```powershell
cd companions/video-studio
npm install
```

First install pulls a Remotion-bundled Chromium (~170 MB). Subsequent renders reuse it.

## Preview interactively

```powershell
npm run studio
```

Opens the Remotion Studio at http://localhost:3000 with hot reload of every composition.

## Render videos

```powershell
npm run render:all       # produces out/pm.mp4, out/architect.mp4, out/ux.mp4
npm run render:posters   # produces out/<persona>-poster.png for landing page <video poster>
```

Or render a single persona:

```powershell
npm run render:pm
npm run render:architect
npm run render:ux
```

## Honesty disclaimer

These are scripted illustrations, not recordings of live Frontier runs or proof
of generated artifacts, timings, accessibility compliance, or audit results.
The UX composition displays that disclosure throughout. Changes to source and
captions do not update previously rendered binaries: rerender and inspect the
actual video before publishing it. Source tests are not playback or pixel checks.

## Brand tokens

Tokens in `src/brand.ts` mirror `docs/ux/prototypes/landing/index.html`: cyan `#06b6d4`, violet `#8b5cf6`, mint `#34d399`, dark mesh background, Inter for prose, JetBrains Mono for code and prompts. Do not introduce new accent colors without updating the landing page first.

## Where outputs are consumed

The current public landing page is intentionally static and does not load these optional videos. Rendered clips can be published separately or added to a future reviewed media surface; do not copy them into the landing output without updating its performance, accessibility, and CSP evidence.
