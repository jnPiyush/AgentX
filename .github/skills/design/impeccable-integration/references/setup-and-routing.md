---
description: 'Target-only Impeccable setup, design-language routing, artifacts and recovery.'
---

# Impeccable Setup and Routing

MUST read before setup, authoring artifacts, choosing a route or recovering
failures. The root's trusted installed bridge, version/SHA-256 pin and bounded
direct native execution prerequisites govern every recipe. This source checkout
does not supply a local bridge. A package lock is not a native-engine pin.

## Install: target app only

Impeccable installs by copying a skill tree into the project. Frontier is
zero-copy, so it is never installed into the Frontier repository or its
bundled distribution. It is installed into the target app being designed.

Use the installed integration's target-only setup after explicit installation
approval. Never run a package shim during validation: `npm exec --offline`
does not prevent the shim from downloading a native engine. Verify a target-local
native engine hash and handshake, then invoke that engine directly through the
installed bridge. If the bridge or pin is absent, record `DEGRADED`.

`/impeccable init` writes `PRODUCT.md`. Establish `DESIGN.md` separately through
the design-language workflow or `/impeccable document` for existing UI. When
authoring commands are unavailable, create both from confirmed product and brand
requirements; this does not constitute a detector run.

Teams that prefer vendoring may use the upstream submodule flow
(`git submodule add` + `impeccable link`). This is a valid alternative; the
zero-copy rule still forbids copying it into Frontier's own asset tree.

## Decision Tree

Route on two questions: does a design language exist yet, and can the detector
run here. If no design language exists, authoring it comes first and the branch
depends only on whether the user supplied a reference. If one exists, the
question becomes whether the problem is measurable drift, which the detector
owns, or a judgement call about hierarchy and resonance, which `critique` owns.
Never route a judgement question to the detector; it has no opinion on whether
a layout communicates.

```text
Design language undefined for this target app?
|
+-- Yes, and the user supplied a reference (URL, screenshot, deck)?
|   -> Run brand-spec-extraction first, then codify into PRODUCT.md + DESIGN.md
|
+-- Yes, and no reference exists?
|   -> Run the 6-axis clarification form, pick a direction, THEN codify
|
+-- No, DESIGN.md already exists but the surface drifted?
|   -> Run the detector; design-system rules catch font/color/radius/size drift
|
+-- No, and the surface is wrong but you cannot name why?
|   -> /impeccable critique for judgement, not the detector
|
- Detector unavailable in this environment?
    -> Record DEGRADED with a reason, fall back to Frontier-only checks
```

MUST read [Brand Spec Extraction](../../brand-spec-extraction/SKILL.md) when a
reference exists, and [Design System Reasoning](../../design-system-reasoning/SKILL.md)
for the clarification form, posture and archetype selection.

When both a drift finding and a judgement concern are open, fix the drift
first. Conforming the surface to its own tokens often resolves the judgement
complaint, and it costs no LLM tokens to verify.

## Artifacts

| Artifact | Contains | Tracked |
|----------|----------|---------|
| `PRODUCT.md` | Audience, mode, brand voice, anti-references | yes |
| `DESIGN.md` | Visual system in Google Stitch format -- palette, type ramp, radii, components | yes |
| `.impeccable/design.json` | Token sidecar the detector reads | yes |
| `.impeccable/critique/*.md` | Review reports | yes |
| `.impeccable/*.png`, `live/`, `config.local.json` | Screenshots, session state, per-dev config | no -- gitignore |

`DESIGN.md` is plain Markdown. This matters: when the detector is unavailable,
the design language still exists and is still readable by Frontier skills. Only
automated conformance verification degrades.

## Troubleshooting

The package-install recipes below apply only to explicitly approved target setup.
`npm ci` or a devDependency cannot supply proof of a trusted bridge/native pin.
"Local binary" means the verified native engine invoked through that bridge,
never a package shim; absent prerequisites remain DEGRADED during validation.

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `command not found` | Not installed in this project | Install as devDependency, or record `DEGRADED` |
| Hangs on first run | `npx` fetching over a blocked network | Use the local binary after `npm ci` |
| Exit `1` | Detector itself failed, not a finding | Treat as `DEGRADED`, not `PASS`; capture stderr |
| Findings appear after an upstream bump | Unpinned version | Pin the version; review the new rules deliberately |
| Design-system rules never fire | No `DESIGN.md`, or stale | Run `/impeccable document` to regenerate |
| Every scan is `DEGRADED` | Dependency not pinned locally | Fix the install; the integration is otherwise decorative |
| Native iOS or Android target | Detector is web-only | Use `/impeccable audit` for the native pass |

## Evidence Interpretation

Without the root's DEGRADED record, a prototype checked at the low bar is
indistinguishable from one checked at the high bar. If `DEGRADED` appears on most
runs, the dependency is not pinned correctly and the integration has become
decorative. Record actual checks, evidence and missing coverage, not assumed runs.