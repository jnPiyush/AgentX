---
name: "impeccable-integration"
description: 'Drive the Impeccable design language for a target app -- PRODUCT.md and DESIGN.md authoring, the 23-command intervention vocabulary, and the 59-rule deterministic detector wired as a three-state gate (PASS / BLOCKED / DEGRADED). Use when defining the design language for a target app, or when running design-language conformance on a prototype or shipped UI.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-26"
  updated: "2026-08-26"
compatibility:
  agents: ["ux-designer", "engineer", "reviewer", "prototype-auditor"]
  frameworks: ["html-css", "tailwind", "react", "vue", "svelte", "astro"]
  output-formats: ["markdown", "json"]
---

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

## Division of responsibility

Do not delete or duplicate an AgentX check because Impeccable has a
similar-sounding command.

| Concern | Owner | Why |
|---------|-------|-----|
| Visual slop tells, typography drift, layout rhythm, motion discipline | Impeccable | 59 deterministic rules |
| Design-system conformance (font / color / radius / size outside `DESIGN.md`) | Impeccable | No AgentX equivalent exists |
| Fabricated metrics, testimonials, trust badges | **AgentX** | Impeccable has no fabrication rules |
| Emoji as iconography, emoji-prefixed headings | **AgentX** | No Impeccable equivalent; AgentX is ASCII-only |
| WCAG 2.1 AA conformance -- keyboard, focus, ARIA, traps, gestures | **AgentX** | Impeccable covers contrast and heading order only |
| Nielsen H1-H10 severity scoring | **AgentX** | `/impeccable critique` is a review, not a scored gate |
| Visual-regression baselines | **AgentX** | Impeccable has live mode, not snapshot diffing |
| Waivers and rationale capture | **AgentX** | One waiver system, see below |

## The detector as a three-state gate

```bash
npm exec --offline -- impeccable detect --json src/          # whole tree
npm exec --offline -- impeccable detect --scope type src/    # narrow: type | layout
npm exec --offline -- impeccable detect --json dist/index.html
```

Exit codes: `0` no findings, `2` findings, `1` command failed.

| State | Condition | Effect |
|-------|-----------|--------|
| `PASS` | Exit `0`, or every finding carries an AgentX waiver | Gate satisfied |
| `BLOCKED` | Exit `2` with unwaived findings | Prototype is not review-ready |
| `DEGRADED` | Detector could not run | Falls back to AgentX-only checks, **recorded** |

`DEGRADED` is never silently equivalent to `PASS`. When the detector cannot
run -- no Node 22.18+, no resolved binary, no network on first use -- record
this block verbatim in the audit report and the UX Spec:

```
Design language check: DEGRADED (AgentX-only)
Reason: <no network | binary unresolved | node <22.18 | other>
Ran: T1-T10 + Honest Placeholders + axe + Pass 9 critique
Not run: 59 deterministic rules, 4 design-system conformance rules
```

Without that record, a prototype checked at the low bar is indistinguishable
from one checked at the high bar. If `DEGRADED` appears on most runs, the
dependency is not pinned correctly and the integration has become decorative.

## Waivers: AgentX protocol is authoritative

Impeccable ships its own ignore mechanisms (`impeccable ignores add-value`,
`add-file`, and inline `impeccable-disable` comments). **Do not use them as the
primary waiver path.** Two parallel waiver systems is how gates rot -- a
finding silenced upstream never reaches the AgentX audit report or review.

- Record every accepted finding through the `anti-slop` Waiver Protocol with
  rationale, in the audit report.
- Use an Impeccable ignore **only** to suppress a rule already waived in
  AgentX, and cite the AgentX waiver in the `--reason` string so the two stay
  traceable.
- A rule that fires often and is always waived is a `DESIGN.md` bug. Fix the
  design language instead of accumulating ignores.

## Command vocabulary

All 23 commands run through `/impeccable <command> [target]`.

| Group | Commands |
|-------|----------|
| Setup | `init`, `document`, `extract` |
| Plan | `shape`, `craft` (deprecated alias) |
| Review | `critique`, `audit`, `polish` |
| Intensity | `bolder`, `quieter`, `distill`, `overdrive`, `delight` |
| Craft | `typeset`, `layout`, `colorize`, `animate` |
| Robustness | `harden`, `onboard`, `clarify`, `adapt`, `optimize` |
| Iterate | `live` |

Choosing one:

- Surface is wrong but you cannot name why -> `critique`
- Surface is boring -> `bolder`; shouting -> `quieter`
- Too many ideas competing -> `distill`
- Type, spacing, or color specifically -> `typeset`, `layout`, `colorize`
- Missing empty, error, or overflow states -> `harden`, `onboard`
- Final pass before review -> `polish`

`/impeccable audit` is the right call for native iOS or Android targets; the
deterministic detector is web-only and reads HTML and CSS.

## Anti-Patterns

- **Silent fallback.** Running AgentX-only checks without recording `DEGRADED`
  makes a low-bar prototype indistinguishable from a high-bar one.
- **Ignore accumulation.** Silencing a rule upstream so it never reaches the
  audit report. If a rule always fires, fix `DESIGN.md` instead.
- **Assumed a11y coverage.** Treating the detector as an accessibility audit.
  It checks contrast, heading order, and text sizing -- not keyboard, focus,
  ARIA, or traps.
- **Waivers in `DESIGN.md`.** `/impeccable document` regenerates that file
  from code, so hand-written waivers there are destroyed on the next run.
- **Bare `npx` in a gate.** Non-reproducible and a supply-chain risk.
- **Duplicating rules.** Re-listing deterministic tells in AgentX prose
  creates two catalogues that drift apart.

## Troubleshooting

| Symptom | Cause | Recovery |
|---------|-------|----------|
| `command not found` | Not installed in this project | Install as devDependency, or record `DEGRADED` |
| Hangs on first run | `npx` fetching over a blocked network | Use the local binary after `npm ci` |
| Exit `1` | Detector itself failed, not a finding | Treat as `DEGRADED`, not `PASS`; capture stderr |
| Findings appear after an upstream bump | Unpinned version | Pin the version; review the new rules deliberately |
| Design-system rules never fire | No `DESIGN.md`, or stale | Run `/impeccable document` to regenerate |
| Every scan is `DEGRADED` | Dependency not pinned locally | Fix the install; the integration is otherwise decorative |
| Native iOS or Android target | Detector is web-only | Use `/impeccable audit` for the native pass |

## Verification Checklist

Before declaring a design-language pass complete:

- [ ] `PRODUCT.md` and `DESIGN.md` exist and are current for this surface
- [ ] Detector ran, or `DEGRADED` is recorded with a reason
- [ ] Every finding is fixed or waived through the AgentX protocol
- [ ] No Impeccable ignore exists without a matching AgentX waiver
- [ ] AgentX-owned concerns were checked separately, not assumed covered
- [ ] The UX Spec cites both artifacts so downstream agents inherit them

## References

- `.github/skills/design/anti-slop/SKILL.md` -- retained tells and the waiver protocol
- `.github/skills/design/prototype-audit/SKILL.md` -- Pass 0 wiring
- `.github/skills/design/accessibility/SKILL.md` -- WCAG AA, which this does not replace
- `.github/skills/design/design-system-reasoning/SKILL.md` -- posture and archetype selection
- Upstream: https://impeccable.style/docs and https://impeccable.style/slop
