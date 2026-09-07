# Financial Services - Templates and Discovery Detail

> Read this when you need the original output templates, stakeholder map, discovery questions, and anti-patterns moved verbatim from the skill root.

## Output Templates

### Benchmarking Brief

```markdown
# Performance Benchmarking: [Client Name]

## Executive Summary
[2-3 sentences: institution type, overall position vs peers, primary finding]

## Peer Comparison

| Metric | Client | Peer Median | Top Quartile | Gap | Rating |
|--------|--------|------------|-------------|-----|--------|
| [e.g., NIM] | [X%] | [Y%] | [Z%] | [+/-] | [GREEN/YELLOW/RED] |

## Key Findings
1. [Strength or gap]: [evidence and context]
2. [Strength or gap]: [evidence and context]
3. [Strength or gap]: [evidence and context]

## Recommended Actions
| Priority | Action | Expected Impact | Timeline |
|----------|--------|----------------|----------|
| 1 | [action] | [impact] | [timeline] |

## Data Sources & Caveats
[List sources, note any data limitations]
```

### Regulatory Impact Memo

```markdown
# Regulatory Impact Assessment: [Regulation Name]

## Overview
- **Regulation**: [Name, jurisdiction, issuing body]
- **Effective Date**: [Date or phased timeline]
- **Applies To**: [Entity types, business lines]

## Impact Analysis

| Dimension | Impact (H/M/L) | Description | Cost Estimate |
|-----------|----------------|-------------|---------------|
| Capital | [H/M/L] | [description] | [range] |
| Operations | [H/M/L] | [description] | [range] |
| Revenue | [H/M/L] | [description] | [range] |
| Technology | [H/M/L] | [description] | [range] |

## Implementation Roadmap
| Phase | Deliverable | Deadline | Owner |
|-------|------------|----------|-------|
| 1 | [deliverable] | [date] | [team] |

## Risks & Dependencies
[Key risks if deadlines are missed, external dependencies]
```

---
## Stakeholder Map

| Role | Priorities | Language |
|------|-----------|----------|
| CEO / Board | Growth strategy, shareholder value, regulatory standing | Business, strategic |
| CFO / Treasurer | Capital adequacy, funding costs, NIM management | Financial, quantitative |
| CRO (Chief Risk Officer) | Credit risk, market risk, operational risk, model risk | Risk frameworks, scenarios |
| COO | Operational efficiency, cost-to-income, process automation | Operational, KPI-driven |
| CTO / CIO | Core modernization, cloud, API strategy, data platform | Technology, architecture |
| CCO (Chief Compliance Officer) | Regulatory change, AML/KYC, reporting obligations | Regulatory, legal |
| CMO / Head of Digital | Customer acquisition, digital channels, personalization | Customer, digital |
| Head of Wealth / Private Banking | Client retention, AUM growth, advisory model | Relationship, portfolio |
| Head of Trading | Execution quality, alpha generation, risk limits | Quantitative, markets |
| Actuary (Insurance) | Pricing adequacy, reserve sufficiency, catastrophe models | Statistical, actuarial |
## Discovery Questions

Use these to scope engagements and understand client context:

- What is your current cost-to-income ratio and where is the efficiency target?
- How are you approaching core banking/insurance platform modernization?
- What is your CET1 ratio trajectory and capital planning approach?
- Where are you on the open banking / API journey?
- What AI/ML use cases are in production vs pilot today?
- How do you manage regulatory change across jurisdictions?
- What is your customer acquisition cost (CAC) for digital channels?
- How do you measure and report ESG / climate risk exposure?
- What is the competitive threat from fintechs/neobanks in your market?
## Anti-Patterns

- **Ignoring regulation**: Financial Services is heavily regulated -- every recommendation must consider compliance impact
- **One-size-fits-all**: Retail banking, insurance, and capital markets have fundamentally different economics
- **Technology-first thinking**: Start with business outcomes and regulatory requirements, not technology
- **Stale rate assumptions**: Always verify current interest rate environment before margin analysis
- **Overlooking conduct risk**: Consumer protection and fair treatment are board-level concerns
- **Generic fintech comparisons**: Compare specific capabilities, not "fintech vs bank" generically
