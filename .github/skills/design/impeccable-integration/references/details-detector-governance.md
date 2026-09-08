# Impeccable Integration - Detector Governance

> Companion to [impeccable-integration](../SKILL.md): gate outcomes, waivers
> and honest audit evidence.

## Division of responsibility

Do not delete or duplicate an AgentX check because Impeccable has a
similar-sounding command.

| Concern | Owner | Why |
|---------|-------|-----|
| Visual slop tells, typography drift, layout rhythm, motion discipline | Impeccable | Versioned deterministic rules; applicability varies by source format |
| Design-system conformance (font / color / radius / size outside `DESIGN.md`) | Impeccable | No AgentX equivalent exists |
| Fabricated metrics, testimonials, trust badges | **AgentX** | Impeccable has no fabrication rules |
| Emoji as iconography, emoji-prefixed headings | **AgentX** | No Impeccable equivalent; AgentX is ASCII-only |
| WCAG 2.1 AA conformance -- keyboard, focus, ARIA, traps, gestures | **AgentX** | Impeccable covers contrast and heading order only |
| Nielsen H1-H10 severity scoring | **AgentX** | `/impeccable critique` is a review, not a scored gate |
| Visual-regression baselines | **AgentX** | Impeccable has live mode, not snapshot diffing |
| Waivers and rationale capture | **AgentX** | One waiver system, see below |

## The detector as a three-state gate

```powershell
.\.agentx\agentx.ps1 design-language check -Path src -Json
.\.agentx\agentx.ps1 design-language check -Path dist\index.html -Json
```

AgentX exits: `0` PASS, `2` BLOCKED, `1` DEGRADED. Native output is a bare
findings array, not an object. A native exit `0` may contain advisories
(`advisory: true` or `severity: advisory`). Exit `1` overrides findings from
partially successful scans. Unknown exits, malformed JSON, timeout, capture
overflow or stderr diagnostics never pass.

| State | Condition | Effect |
|-------|-----------|--------|
| `PASS` | Complete scan, no primary findings or coverage limitations | Deterministic gate only; retain advisories and manual checks |
| `BLOCKED` | Primary findings remain | Fix or request AgentX waiver review |
| `DEGRADED` | Execution, prerequisites or coverage incomplete | Continue AgentX-only checks with explicit evidence |

The executable gate does not approve waivers. It disables inline ignores;
custom `detector`, legacy `hook`, or `projectRoots` config requires manual
suppression/scope review and keeps the result DEGRADED. Do not delete settings
just to make the gate green. A reviewer can record accepted waivers separately
without changing raw detector evidence or waiving operational failures.

Evidence includes engine version/path/hash, argv, exit, diagnostics, input
hashes, primary/advisory findings, duration and coverage limitations.
`eligibleFileCount` is discovery evidence, NOT a measured `scannedFileCount`
(upstream does not report one). Nonempty token mappings are only a syntactic
preflight, not proof that every design rule was active. Review token semantics.

`DEGRADED` is never silently equivalent to `PASS`. When the detector cannot
run -- no Node 22.18+, missing native pin, invalid design tokens -- complete
this block with actual evidence in the audit report and the UX Spec:

```
Design language check: DEGRADED (AgentX-only)
Reason: <exact gate reason>
Required fallback checks: T1-T10 + Honest Placeholders + axe + Pass 9 critique
Actually run: <commands, results and evidence; do not prefill success>
Not run: <detector checks unavailable or incomplete, plus unavailable fallback checks and why>
```

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

Use `/impeccable <command> [target]` only when the upstream skill is available.
Confirm its installed command vocabulary; these are routing examples, not a
duplicated upstream specification.

Choosing one:

- Surface is wrong but you cannot name why -> `critique`
- Surface is boring -> `bolder`; shouting -> `quieter`
- Too many ideas competing -> `distill`
- Type, spacing, or color specifically -> `typeset`, `layout`, `colorize`
- Missing empty, error, or overflow states -> `harden`, `onboard`
- Final pass before review -> `polish`

`/impeccable audit` is the right call for native iOS or Android targets; the
deterministic detector is web-only. Local discovery also accepts stylesheet
preprocessors, JS/TS/JSX/TSX, Vue, Svelte, Astro and Blade sources; that does not
mean every rule has full framework or rendered-browser coverage.

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
| Missing pin or binary | Native engine not prepared in this app | Follow target-only setup or record `DEGRADED` |
| Launcher fetches on first run | npm offline does not constrain the shim | Use the verified native engine directly |
| Exit `1` | Detector itself failed, not a finding | Treat as `DEGRADED`, not `PASS`; capture stderr |
| Findings appear after an upstream bump | Unpinned version | Pin the version; review the new rules deliberately |
| Design-system rules never fire | Missing/invalid token frontmatter | Review tokens; use `/impeccable document` for existing UI |
| Every scan is `DEGRADED` | Read the exact reason and coverage limitations | Fix prerequisites/scope, not the verdict |
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
