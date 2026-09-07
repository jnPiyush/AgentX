# Impeccable Integration - Detector Governance

> Read this when the [impeccable-integration](../SKILL.md) root sends you here
> for responsibility boundaries, detector outcomes, waivers, commands,
> anti-patterns, troubleshooting, or the original verification checklist. The
> sections are relocated from the original root; the degraded report distinguishes
> required checks from execution evidence.

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
run -- no Node 22.18+, no resolved binary, no network on first use -- complete
this block with actual evidence in the audit report and the UX Spec:

```
Design language check: DEGRADED (AgentX-only)
Reason: <no network | binary unresolved | node <22.18 | other>
Required fallback checks: T1-T10 + Honest Placeholders + axe + Pass 9 critique
Actually run: <commands, results and evidence; do not prefill success>
Not run: 59 deterministic rules, 4 design-system conformance rules, <any unavailable fallback checks and why>
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
