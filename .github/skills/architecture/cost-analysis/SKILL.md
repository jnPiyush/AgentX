---
name: "cost-analysis"
description: 'Estimate and attribute cloud running cost for a proposed architecture before it is built. Use when writing an ADR options table, sizing a prototype, comparing managed versus self-hosted services, or answering "what will this cost to leave running". Produces a load-enveloped estimate with an idle-versus-active split and per-option attribution.'
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2026-08-06"
  updated: "2026-08-06"
compatibility:
  providers: ["azure", "aws", "gcp", "on-prem"]
  platforms: ["windows", "linux", "macos"]
  agents: ["architect", "product-manager", "devops", "engineer"]
---

# Cost Analysis

> **Purpose**: Make running cost a first-class, comparable dimension of an architecture decision -- not a surprise discovered after deployment.

---

## When to Use This Skill

- Writing an ADR: every option in the comparison table needs a cost column
- Sizing a prototype that will sit idle most of its life
- Choosing between managed, serverless, and always-on compute
- A stakeholder asks "what does it cost to leave this running for a month?"

**Do NOT use** for billing forensics on already-deployed resources -- that is an
observability task, not an architecture task.

---

## Core Model: Idle Cost Is The Prototype Killer

A prototype is active for a small slice of the month and idle for the rest. Total
cost is therefore driven far more by the **idle floor** than by peak throughput.

```
monthly_cost = (active_hours * active_rate) + (idle_hours * idle_rate) + fixed_monthly
```

| Billing shape | `idle_rate` | Prototype impact |
|---|---|---|
| Consumption / serverless | ~0 | Cheap when idle -- prefer for prototypes |
| Auto-pause (serverless DB) | storage floor only | Cheap, small floor remains |
| Provisioned / always-on | full rate | **Dominates the bill** -- flag it |
| Fixed monthly (gateway, IP) | n/a | Unavoidable floor -- surface it explicitly |

> **Rule**: If a component's `idle_rate` equals its `active_rate`, the estimate MUST
> call it out as an always-on floor. That single line changes most prototype decisions.

---

## Load Envelopes

Estimate against three declared envelopes, never a single number. Each envelope is a
set of **stated assumptions**, so a reviewer can challenge the input rather than the total.

| Envelope | Intent | Typical assumptions |
|---|---|---|
| `pilot` | Demo / stakeholder review | Few users, hours per day, bursty |
| `team` | Real internal usage | Business hours, steady load |
| `org` | Scale sanity check | Continuous load, growth headroom |

Envelope assumptions live in the cost model file, not in prose, so they are diffable.

---

## Workflow

1. **Declare the model** -- copy [assets/cost-model.example.json](assets/cost-model.example.json)
   and list each billable component with its billing shape and rates.
2. **Source the rates** -- use the provider's public pricing page or calculator.
   Record `ratesSourcedOn` and the region; rates go stale.
3. **Compute** -- run the estimator:
   ```powershell
   pwsh .github/skills/architecture/cost-analysis/scripts/estimate-cost.ps1 `
     -ModelPath docs/artifacts/costs/cost-model.json -Format markdown
   ```
4. **Attribute** -- map each cost line to the ADR option that causes it, so a reader
   sees which decision drives which spend.
5. **Record** -- write the table into the ADR options section and save the full report
   to `docs/artifacts/costs/COST-<issue>.md`.

---

## Honesty Rules (NON-NEGOTIABLE)

Cost estimates are trusted and therefore easy to abuse. Apply these:

- **State the basis** -- region, currency, date, and rate source, every time.
- **Never invent a rate.** If a rate is unknown, emit `UNKNOWN` and list it as an open
  question. A missing number is honest; a guessed number is not.
- **Exclude what you did not model** -- egress, backup, support plans, and licence costs
  are excluded unless explicitly listed. Say so.
- **Estimates are ranges**, not commitments. Do not present a single figure as a quote.

---

## Decision Tree

```
Need a cost figure?
+- Comparing ADR options? -> price every option at the SAME envelope
+- Sizing one design? -> pilot + team + org envelopes
+- Rate unknown? -> emit UNKNOWN, list as open question, never guess
+- Already deployed? -> not this skill; use billing/observability data
```

---

## Error Handling

| Condition | Behaviour |
|---|---|
| Model file missing or invalid JSON | Exit 1 with the parse error |
| Required field absent | Exit 1 naming each missing field |
| `activeHoursPerDay` outside 0-24, `daysPerMonth` outside 0-31 | Exit 1 naming the envelope |
| Rate is `UNKNOWN`, malformed, or negative | Excluded from totals, listed as an open question, `[WARN]` emitted |

Totals containing an open question are **lower bounds**, and the report says so.

---

## Checklist (before quoting a number)

- [ ] Region, currency, rate source, and `ratesSourcedOn` recorded
- [ ] Every component classified by billing shape
- [ ] Always-on floors identified and challenged
- [ ] All options priced at the same envelope
- [ ] Open questions resolved or explicitly carried into the ADR
- [ ] Exclusions stated

---

## Progressive Disclosure

| Need | Read |
|---|---|
| Billing shapes, worked example, ADR wiring | [references/estimation-guide.md](references/estimation-guide.md) |
| Model file schema | [assets/cost-model.example.json](assets/cost-model.example.json) |
| Estimator script | [scripts/estimate-cost.ps1](scripts/estimate-cost.ps1) |

---

## See Also

- [Infra Governance](../infra-governance/SKILL.md) -- rule IG-09 requires a cost envelope for billable components
- [Architecture Core Principles](../core-principles/SKILL.md)
- [Performance & Scalability](../performance/SKILL.md) -- sizing inputs feed the envelopes
