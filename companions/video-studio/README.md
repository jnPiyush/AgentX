# AgentX Video Studio

Programmatic persona demo videos rendered with [Remotion](https://www.remotion.dev/).

Three compositions, each 60 seconds at 1920x1080 / 30 fps, scripted to match the prompts used in the landing page tab section.

## Compositions

| ID | Persona | Prompt shown | Output |
|----|---------|--------------|--------|
| `PMDemo` | Product Manager | "Create a PRD for a customer feedback widget" | `out/pm.mp4` |
| `ArchitectDemo` | Architect | "Design the architecture for the feedback widget" | `out/architect.mp4` |
| `UXDemo` | UX Designer | "Design the UX for the feedback widget" | `out/ux.mp4` |

Captions ship as WebVTT in `public/*.vtt` and are mirrored by the landing page tabs for accessibility.

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

These are scripted explainer videos, not raw recordings of live AgentX runs. Every artifact shown (PRD body, ADR options, prototype HTML) mirrors what AgentX actually produces, but the timings on screen are designed for clarity, not benchmarking.

## Brand tokens

Tokens in `src/brand.ts` mirror `docs/ux/prototypes/landing/index.html`: cyan `#06b6d4`, violet `#8b5cf6`, mint `#34d399`, dark mesh background, Inter for prose, JetBrains Mono for code and prompts. Do not introduce new accent colors without updating the landing page first.

## Where outputs are consumed

The landing page preview at `docs/ux/prototypes/landing/v2.html` references the MP4 paths above directly. Once rendered, drop the files into `docs/ux/prototypes/landing/videos/` (or host on Mux / Cloudflare Stream) and update the `<source>` paths in `v2.html` accordingly.
