# Audit & Assurance - Advisory Workflows Detail

> Read this when you need the original advisory workflows, scoring tables, and
> output templates relocated verbatim from the skill root to stay within the
> root token budget.

## Advisory Workflows

### Audit Readiness Assessment

Use this workflow when evaluating how prepared a client is for an upcoming external audit or regulatory inspection.

**Step 1 - Determine audit type and standards**:
Classify the engagement: Public Company (PCAOB), Private Company (AICPA), Government (Yellow Book/Single Audit), International (ISA). Map the applicable standards from the Professional Standards Hierarchy table.

**Step 2 - Assess readiness across seven dimensions** (1-5 scale: Unprepared / Basic / Developing / Prepared / Exemplary):
- Financial close process (timeliness, accuracy, reconciliation completeness)
- ICFR documentation (control narratives, flowcharts, risk-control matrices)
- IT general controls (access management, change management, operations)
- Evidence and documentation (PBC list readiness, supporting schedules)
- Management estimates (valuation models, judgmental areas, disclosures)
- Prior-year findings remediation (open items from prior audit/inspection)
- Communication protocols (audit committee, management representation process)

**Step 3 - Calculate readiness score**:
Average across seven dimensions. Map to overall readiness:
- 1.0-2.0: High Risk -- significant gaps, audit delays likely
- 2.1-3.0: Moderate Risk -- targeted remediation needed before audit start
- 3.1-4.0: Prepared -- minor items to address, on track
- 4.1-5.0: Exemplary -- audit-ready, proactive posture

**Step 4 - Generate remediation plan**:
For each dimension scoring below 3.0, define: specific gap, remediation action, responsible party, target date, and dependencies. Prioritize by impact on audit timeline.

### Control Environment Evaluation

Use this workflow when assessing the design and operating effectiveness of a client's internal control framework.

**Step 1 - Select control framework**:
Map to appropriate framework: COSO 2013 (ICFR), COSO ERM 2017 (enterprise risk), COBIT (IT governance), ISO 27001 (infosec). Most public companies use COSO 2013 for SOX compliance.

**Step 2 - Assess each COSO component**:

| Component | Principles | Assessment Focus |
|-----------|-----------|------------------|
| Control Environment | 1-5 | Tone at top, competence, governance structure |
| Risk Assessment | 6-9 | Objective setting, risk identification, change management |
| Control Activities | 10-12 | Policies, IT controls, deployment through practices |
| Info & Communication | 13-15 | Internal/external communication, quality information |
| Monitoring Activities | 16-17 | Ongoing/separate evaluations, deficiency reporting |

Rate each component: Effective / Partially Effective / Ineffective.

**Step 3 - Classify deficiencies**:

| Classification | Definition | Escalation |
|---------------|-----------|------------|
| Control Deficiency | Design or operation gap, risk not mitigated | Management action plan |
| Significant Deficiency | Reasonable possibility of material misstatement (more than remote, less than reasonably possible) | Audit committee notification |
| Material Weakness | Reasonable possibility that a material misstatement will not be prevented/detected timely | Public disclosure (SOX 302/404) |

**Step 4 - Document findings**:
Use the Findings Summary template below. For each finding, document: condition, criteria, cause, effect, and recommendation (the "5 C's" of audit findings).

### ESG Assurance Readiness

Use this workflow when advising a client on preparedness for ESG/sustainability reporting assurance.

**Step 1 - Identify reporting obligations**:
Map the client against applicable frameworks:
- CSRD (EU) -- mandatory for in-scope companies starting 2024-2026
- SEC Climate Disclosure (US) -- climate-related financial risk
- ISSB (IFRS S1/S2) -- investor-focused sustainability baseline
- Voluntary: GRI, SASB, TCFD, CDP

**Step 2 - Assess data readiness**:
For each ESG metric the client must report, evaluate:
- Data source reliability (automated vs manual, third-party vs internal)
- Control over ESG data (who collects, reviews, approves)
- Audit trail completeness (can amounts be traced to source documents)
- Methodology documentation (calculation methods, estimation approaches, scope definitions)

**Step 3 - Determine assurance level gap**:

| Level | Standard | Rigor | Typical Use |
|-------|---------|-------|-------------|
| Limited Assurance | ISAE 3000, ISSA 5000 | Inquiry + analytical procedures | Initial ESG reports |
| Reasonable Assurance | ISAE 3000, ISSA 5000 | Full evidence gathering + testing | Mature ESG programs |

Assess gap between current data quality and target assurance level. Most organizations start with limited and progress to reasonable over 2-3 years.

**Step 4 - Build assurance roadmap**:
Phase 1 (0-6 months): Data inventory, process documentation, gap assessment.
Phase 2 (6-12 months): Control implementation, dry-run assurance engagement.
Phase 3 (12-18 months): First formal assurance engagement (limited), remediation.
Phase 4 (18-36 months): Transition to reasonable assurance.

## Output Templates

### Audit Readiness Report

```markdown
# Audit Readiness Assessment: [Client Name]

## Executive Summary
[2-3 sentences: audit type, overall readiness score, primary risk area]

## Readiness Scorecard

| Dimension | Score (1-5) | Rating | Key Gap |
|-----------|------------|--------|----------|
| Financial Close | [X] | [rating] | [gap description] |
| ICFR Documentation | [X] | [rating] | [gap description] |
| IT General Controls | [X] | [rating] | [gap description] |
| Evidence & Documentation | [X] | [rating] | [gap description] |
| Management Estimates | [X] | [rating] | [gap description] |
| Prior-Year Remediation | [X] | [rating] | [gap description] |
| Communication Protocols | [X] | [rating] | [gap description] |
| **Overall** | **[avg]** | **[rating]** | |

## Priority Remediation Items
| # | Gap | Action | Owner | Target Date |
|---|-----|--------|-------|-------------|
| 1 | [gap] | [action] | [owner] | [date] |

## Recommended Timeline
[Milestones aligned to audit start date]
```

### Findings Summary

```markdown
# Control Findings Summary: [Client Name]

## Finding: [Title]
- **Classification**: [Control Deficiency / Significant Deficiency / Material Weakness]
- **Condition**: [What was observed]
- **Criteria**: [What was expected (standard, policy, framework)]
- **Cause**: [Why the gap exists]
- **Effect**: [Actual or potential impact]
- **Recommendation**: [Specific remediation action]
- **Management Response**: [To be completed by client]
- **Target Remediation Date**: [Date]

## Summary by Classification
| Classification | Count | Trend vs Prior Year |
|---------------|-------|--------------------|
| Material Weakness | [n] | [up/down/flat] |
| Significant Deficiency | [n] | [up/down/flat] |
| Control Deficiency | [n] | [up/down/flat] |
```
