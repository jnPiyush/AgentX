---
description: 'Impeccable and Frontier check ownership, waiver protocol, command vocabulary and pitfalls.'
---

# Responsibility and Commands

MUST read before assigning checks, choosing an intervention, or accepting and
mirroring waivers. Raw detector status and Frontier review decisions stay separate.

## Division of responsibility

Do not delete or duplicate a Frontier check because Impeccable has a
similar-sounding command.

| Concern | Owner | Why |
|---------|-------|-----|
| Visual slop tells, typography drift, layout rhythm, motion discipline | Impeccable | 59 deterministic rules |
| Design-system conformance (font / color / radius / size outside `DESIGN.md`) | Impeccable | No Frontier equivalent exists |
| Fabricated metrics, testimonials, trust badges | **Frontier** | Impeccable has no fabrication rules |
| Emoji as iconography, emoji-prefixed headings | **Frontier** | No Impeccable equivalent; Frontier is ASCII-only |
| WCAG 2.1 AA conformance -- keyboard, focus, ARIA, traps, gestures | **Frontier** | Impeccable covers contrast and heading order only |
| Nielsen H1-H10 severity scoring | **Frontier** | `/impeccable critique` is a review, not a scored gate |
| Visual-regression baselines | **Frontier** | Impeccable has live mode, not snapshot diffing |
| Waivers and rationale capture | **Frontier** | One waiver system, see below |

MUST read [Accessibility](../../accessibility/SKILL.md) for WCAG AA,
[Usability Heuristics](../../usability-heuristics/SKILL.md) for Nielsen scoring
and [Visual Regression](../../visual-regression/SKILL.md) for baselines when
performing those separate checks. The detector does not replace them.

## Waivers: Frontier protocol is authoritative

Impeccable ships its own ignore mechanisms (`impeccable ignores add-value`,
`add-file`, and inline `impeccable-disable` comments). Do not use them as the
primary waiver path. Two parallel waiver systems is how gates rot -- a
finding silenced upstream never reaches the Frontier audit report or review.

- Record every accepted finding through the
  [anti-slop](../../anti-slop/SKILL.md) Waiver Protocol with rationale, in the
  audit report; MUST read that protocol before accepting a waiver.
- Use an Impeccable ignore only to suppress a rule already waived in
  Frontier, and cite the Frontier waiver in the `--reason` string so the two stay
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

- Silent fallback. Running Frontier-only checks without recording `DEGRADED`
  makes a low-bar prototype indistinguishable from a high-bar one.
- Ignore accumulation. Silencing a rule upstream so it never reaches the
  audit report. If a rule always fires, fix `DESIGN.md` instead.
- Assumed a11y coverage. Treating the detector as an accessibility audit.
  It checks contrast, heading order, and text sizing -- not keyboard, focus,
  ARIA, or traps.
- Waivers in `DESIGN.md`. `/impeccable document` regenerates that file
  from code, so hand-written waivers there are destroyed on the next run.
- Bare `npx` in a gate. Non-reproducible and a supply-chain risk.
- Duplicating rules. Re-listing deterministic tells in Frontier prose
  creates two catalogues that drift apart.

## Sources

Impeccable design language and detector by Paul Bakaus:
[upstream repository](https://github.com/pbakaus/impeccable) (Apache-2.0).
Frontier orchestrates, not vendors or forks, the tool; see repository NOTICE.
Upstream [documentation](https://impeccable.style/docs) and
[slop catalogue](https://impeccable.style/slop).