# Cost Estimation Guide

Extended guidance for the [cost-analysis](../SKILL.md) skill.

---

## 1. Classify Every Component By Billing Shape

Before pricing anything, classify each component. The shape determines whether idle time
costs money, which is the single biggest driver of prototype spend.

| Shape | Bills when idle? | Model it as | Typical examples |
|---|---|---|---|
| `consumption` | No | `idleRatePerHour: 0` | Serverless functions, per-request compute, scale-to-zero containers |
| `auto-pause` | Storage floor only | small `idleRatePerHour` | Serverless databases that pause after inactivity |
| `always-on` | Yes, full rate | `idleRatePerHour == activeRatePerHour` | Provisioned VMs, reserved capacity, most gateway tiers |
| `fixed` | Flat, usage-independent | `fixedMonthly` | Static IPs, minimum-tier managed services, per-vault fees |

**Reclassifying one component from `always-on` to `consumption` is usually the largest
single cost lever available to a prototype** -- larger than any rate negotiation.

---

## 2. Worked Example

Using the shipped example model, the `pilot` envelope (2 h/day, 20 days/month) yields:

| Component | Shape | Active | Idle | Monthly |
|---|---|---|---|---|
| api | consumption | 2.08 | 0.00 | 2.08 |
| database | auto-pause | 7.20 | 4.14 | 11.34 |
| gateway | always-on | 2.80 | **48.30** | **51.10** |
| blob-storage | fixed | 0.00 | 0.00 | 2.30 |
| **Total** | | | | **66.82** |

The gateway is used for 40 hours and idle for 690, yet accounts for roughly three
quarters of the bill. Peak-throughput sizing would never have surfaced that; the
idle split does.

The right follow-up question is therefore not "can we get a cheaper gateway tier?" but
**"does the prototype need a managed gateway at all, or can the container runtime expose
the endpoint directly?"** That is an architecture decision, which is why cost belongs in
the ADR rather than in a post-deployment report.

---

## 3. Sourcing Rates Honestly

1. Use the provider's public pricing page or calculator for the **exact region** you
   will deploy to. Regional variance is routinely 10-30 percent.
2. Record the date in `ratesSourcedOn`. Cloud rates change; an undated estimate is
   unauditable.
3. Prefer the provider's own calculator export over a blog post or a model's recollection.
4. If a rate cannot be sourced, set it to `"UNKNOWN"`. The estimator excludes it from the
   total and lists it as an open question, so the number stays defensible.

> **Never let a model invent a rate.** A fabricated figure that looks precise is more
> damaging than an explicit gap, because reviewers stop questioning it.

---

## 4. Wiring Cost Into An ADR

The Architect agent compares at least three options. Add a cost column driven by the
same envelope across every option so the comparison is like-for-like.

```markdown
| Option | Fit | Complexity | Pilot cost/mo | Org cost/mo | Notes |
|---|---|---|---|---|---|
| A: serverless-first | High | Low | USD 18 | USD 190 | No always-on floor |
| B: managed gateway + containers | High | Medium | USD 67 | USD 221 | Gateway is 76% of pilot cost |
| C: single VM | Medium | Low | USD 61 | USD 61 | Flat, but no scale path |
```

Two rules make this comparison trustworthy:

- **Same envelope across all options.** Comparing option A at `pilot` with option B at
  `org` is meaningless.
- **State the crossover.** Option C above is cheapest at `org` but worst at `pilot`. The
  ADR should name the load at which the ranking flips, because that is the actual decision.

---

## 5. Attribution

Set `attribution` on each component to the ADR option or requirement that causes it.
This turns a flat bill into a decision trail and answers "why are we paying for this?"
months later, when the original context is gone.

Components shared by every option should say so -- they are not a differentiator and
should be excluded when comparing options.

---

## 6. Limits Of This Skill

This is a **design-time** estimator. It deliberately does not:

- Query live pricing APIs -- estimates stay reproducible offline and in CI
- Read deployed resource inventory -- that is observability, not architecture
- Model committed-use discounts, reservations, or negotiated enterprise agreements
- Model egress, which is workload-specific and better measured than guessed

When any of those dominate, note the limitation in the report rather than extending
the model until it looks authoritative.

---

## See Also

- [SKILL.md](../SKILL.md)
- [Infra Governance rule IG-09](../../infra-governance/references/rule-catalog.md)
