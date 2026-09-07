# Anti-Slop - Audit Protocol Detail

> Read this when applying the [anti-slop](../SKILL.md) gate to a specific
> task. Content below is relocated verbatim from the original root to stay
> within the root token budget.

## Honest Placeholders Rule

Until real data exists, ALL data in a prototype MUST be visibly
placeholder. Three permitted patterns:

1. **Dashed em-dash**: `--` in the spot where a number will go. Renders as
   "the value is intentionally unset".
2. **Labeled grey block**: a 1-line grey rectangle with the label
   `[metric pending]`, `[user name]`, `[product logo]`.
3. **Real but cited**: an actual value with a footnote like
   `<sup>1</sup>` linking to the source. Sources MUST be reviewable.

NEVER do: invented but plausible numbers, AI-generated names, stock-photo
avatars with random names, "Acme Inc" logos in a customer wall.

Why this matters: a prototype with invented data trains the team and the
stakeholder to read AI-confidence as evidence. Honest placeholders force
the next step (find the real number) instead of skipping it.

## Detection Procedure

For each emitted UI surface, scan in this order:

1. Open the page. Take a screenshot.
2. Check Pass 0 status. If it passed, run only the AgentX-retained tells
   (T2, T3, T8, T10). If it was `DEGRADED`, run the full T1-T10 list --
   nothing deterministic covered them. Each hit is one finding.
3. Run the honest-placeholders check: list every number, name, logo,
   testimonial, avatar, and metric on the page. For each, classify as
   real-and-cited, em-dash, labeled-grey-block, or invented. Each
   invented item is one finding.
4. Sum findings. Zero is required to pass. P0 findings block emit.

Record findings under Pass 9 of the prototype-audit report.

## Waiver Protocol

This protocol is the authoritative waiver path for design findings, including
findings raised by the Impeccable detector. `impeccable ignores` and inline
`impeccable-disable` comments MUST NOT be used as the primary record -- a rule
silenced upstream never reaches the audit report or the reviewer.

A forbidden tell may be retained only when:

- The brand-spec extracted from a real source explicitly mandates it
  (e.g. the company's actual brand uses a purple-pink gradient logo).
- An accessibility check still passes.
- The waiver is recorded in the prototype-audit report with the rule id,
  the rationale, and the citation that authorizes it.

Without those three conditions, the finding stands.

**Where waivers live.** Record them in
`docs/artifacts/reviews/PROTOTYPE-AUDIT-<issue>.md`, not in the target app's
root `DESIGN.md`. Impeccable regenerates that file from code on
`/impeccable document`, so hand-written waivers placed there are silently
lost. The AgentX design-system document from
`.github/templates/DESIGN-SYSTEM-TEMPLATE.md` Section 9 remains the right home
for durable project-level anti-pattern decisions; the two files are distinct
despite the similar name.

An Impeccable ignore may mirror an existing AgentX waiver so repeat scans stay
quiet. When it does, cite the AgentX waiver in its `--reason` string. A rule
that is always waived is a `DESIGN.md` bug -- fix the design language rather
than accumulating ignores.

## Self-Review

Before declaring an anti-slop pass complete:

- [ ] Pass 0 status was checked before deciding which tells to run.
- [ ] The AgentX-retained tells (T2, T3, T8, T10) were checked explicitly.
- [ ] Every number, name, and logo on the page was classified.
- [ ] Findings are recorded with the visible symptom and the replacement.
- [ ] Waivers live in the audit report and cite what authorizes them.
- [ ] No Impeccable ignore exists without a matching AgentX waiver.
