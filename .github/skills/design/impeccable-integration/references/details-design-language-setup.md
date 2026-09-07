# Impeccable Integration - Design Language Setup

> Read this when the [impeccable-integration](../SKILL.md) root sends you here
> for installation, initialization, design-language authoring, or artifact
> detail. The sections below are preserved verbatim from the original root.

<!--
Source: Impeccable design language and detector by Paul Bakaus,
  https://github.com/pbakaus/impeccable (Apache-2.0). AgentX orchestrates
  the upstream tool; it does not vendor or fork it. See repository NOTICE.
-->

# Impeccable Integration

> WHEN: Defining the design language for a target app, or checking any UI
> surface against it. Impeccable owns visual design language and slop
> detection. AgentX owns process, compliance evidence, and lifecycle
> integration. Read the division table before assuming which side owns a
> check.

## When to Use This Skill

- Establishing the design language for a target app (the UX Designer's first phase)
- Running design-language conformance on a prototype (Pass 0 of `prototype-audit`)
- Choosing an intervention command when a surface is wrong but the fix is unclear
- Deciding whether a finding belongs to Impeccable or to an AgentX skill

## Prerequisites

- Node 22.18 or newer in the environment that runs the detector.
- A target app repository. Impeccable is installed there, never into AgentX.
- `impeccable` pinned as a devDependency so the gate is reproducible offline.
- Write access to the target app's `PRODUCT.md` and `DESIGN.md`.

When any of these is missing the detector cannot run and the gate reports
`DEGRADED`. That is a supported path, not a failure -- see Troubleshooting.

## Install: target app only

Impeccable installs by copying a skill tree into the project. AgentX is
zero-copy, so it is **never** installed into the AgentX repository or its
bundled distribution. It is installed into the **target app** being designed.

```bash
# In the target app repo, not in AgentX
npm install --save-dev impeccable   # pin the resolved version in the lockfile
npm exec --offline -- impeccable install --scope=project
```

Then, inside the AI harness, run `/impeccable init` once. It asks whether the
surface is brand or product and writes `PRODUCT.md` plus `DESIGN.md`.

**Pin the version.** Bare `npx impeccable` resolves the latest release. For a
blocking gate that is disqualifying: an upstream rule addition can fail a build
that passed yesterday with no local change, and it executes unpinned
third-party code at gate time. Install as a devDependency and invoke the local
binary so the gate is reproducible and runs offline after `npm ci`.

Teams that prefer vendoring may use the upstream submodule flow
(`git submodule add` + `impeccable link`). This is a valid alternative; the
zero-copy rule still forbids copying it into AgentX's own asset tree.

## Quick Start

1. Confirm prerequisites. If the detector cannot run, record `DEGRADED` and
   continue on AgentX-only checks rather than stopping the design work.
2. Install into the target app and pin the version in the lockfile.
3. Run `/impeccable init` once. Answer brand or product. This writes
   `PRODUCT.md` and `DESIGN.md`.
4. Cite both artifacts from the UX Spec so downstream agents inherit the
   design language instead of re-deriving it.
5. Build the surface against `DESIGN.md`.
6. Run the detector as Pass 0 of `prototype-audit` before any LLM critique.
7. Fix findings, or waive them through the AgentX protocol with rationale.
8. Re-run until exit `0`, then continue to Pass 1.

## Decision Tree

Route on two questions: does a design language exist yet, and can the detector
run here. If no design language exists, authoring it comes first and the branch
depends only on whether the user supplied a reference. If one exists, the
question becomes whether the problem is measurable drift, which the detector
owns, or a judgement call about hierarchy and resonance, which `critique` owns.
Never route a judgement question to the detector; it has no opinion on whether
a layout communicates.

```
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
    -> Record DEGRADED with a reason, fall back to AgentX-only checks
```

When both a drift finding and a judgement concern are open, fix the drift
first. Conforming the surface to its own tokens often resolves the judgement
complaint, and it costs no LLM tokens to verify.

## Core Rules

1. **Design language before pixels** - `PRODUCT.md` and `DESIGN.md` exist and
   are cited before any wireframe, prototype, or HTML is emitted. A direction
   that lives only in chat cannot be conformed to or verified later.
2. **Deterministic before judgement** - the detector runs as Pass 0, ahead of
   any LLM critique, so reviewers spend judgement on what machines cannot see.
3. **Never install into AgentX** - the tool is installed into the target app.
   Copying it into AgentX's asset tree violates the zero-copy rule.
4. **Pin the version** - bare `npx` resolves the latest release, which makes a
   blocking gate non-reproducible and executes unpinned third-party code.
5. **DEGRADED is not PASS** - when the detector cannot run, say so in writing
   with the reason and the list of checks that did not execute.
6. **One waiver system** - the AgentX waiver protocol is authoritative;
   upstream ignores may only mirror an existing AgentX waiver.
7. **Do not assume coverage** - AgentX retains fabrication, emoji, WCAG,
   heuristics, and visual regression. Check the division table before
   deleting or skipping an AgentX check.

## Artifacts

| Artifact | Contains | Tracked |
|----------|----------|---------|
| `PRODUCT.md` | Audience, mode, brand voice, anti-references | yes |
| `DESIGN.md` | Visual system in Google Stitch format -- palette, type ramp, radii, components | yes |
| `.impeccable/design.json` | Token sidecar the detector reads | yes |
| `.impeccable/critique/*.md` | Review reports | yes |
| `.impeccable/*.png`, `live/`, `config.local.json` | Screenshots, session state, per-dev config | no -- gitignore |

`DESIGN.md` is plain Markdown. This matters: when the detector is unavailable,
the design language still exists and is still readable by AgentX skills. Only
automated conformance verification degrades.
