---
inputs:
  issue_number:
    description: "GitHub/ADO issue number (required in 'agentx' mode; leave empty in 'standalone' mode)"
    required: false
    default: ""
  artifact_title:
    description: "Title of the ADR, document, or feature being reviewed"
    required: true
    default: ""
  adr_path:
    description: "Path to the ADR being reviewed (agentx mode)"
    required: false
    default: "docs/artifacts/adr/ADR-${issue_number}.md"
  spec_path:
    description: "Path to the Tech Spec being reviewed (agentx mode)"
    required: false
    default: "docs/artifacts/specs/SPEC-${issue_number}.md"
  prd_path:
    description: "Path to the parent PRD (for traceability; agentx mode)"
    required: false
    default: "docs/artifacts/prd/PRD-${issue_number}.md"
  document_paths:
    description: "Comma-separated paths to human-written document(s) under review (standalone mode). Supports .md, .txt, .docx, .doc, .pptx, .ppt, .pdf, .html, images (.png/.jpg/.svg), diagrams (.drawio/.vsdx/.puml/.mmd)"
    required: false
    default: ""
  document_formats:
    description: "Detected formats per document_paths entry (e.g. 'docx,pptx,png'); used in citations and the Inputs section"
    required: false
    default: ""
  architect:
    description: "Architect responsible for the ADR/Spec"
    required: false
    default: "AgentX Architect"
  reviewer:
    description: "Reviewer name (agent or person)"
    required: false
    default: "AgentX Architecture Reviewer"
  date:
    description: "Review date (YYYY-MM-DD)"
    required: false
    default: "${current_date}"
  domain_labels:
    description: "Domain labels on the issue (e.g. needs:ai, needs:realtime)"
    required: false
    default: ""
  mode:
    description: "Review mode: 'agentx' (issue-driven, full ADR+Spec+PRD) or 'standalone' (single human-written architecture document)"
    required: false
    default: "agentx"
---

# Architecture Review: ${artifact_title}

- **Mode**: `${mode}`
- **Issue**: #${issue_number} (omit in standalone mode)
- **Documents under review** (standalone mode): `${document_paths}` (formats: `${document_formats}`)
- **ADR** (agentx mode): [${adr_path}](../../${adr_path})
- **Tech Spec** (agentx mode): [${spec_path}](../../${spec_path})
- **PRD** (agentx mode): [${prd_path}](../../${prd_path})
- **Architect**: ${architect}
- **Reviewer**: ${reviewer}
- **Date**: ${date}
- **Domain labels**: ${domain_labels}
- **Decision**: APPROVED | CHANGES REQUESTED | BLOCKED

---

## Summary

- **Mode**: `${mode}` (`agentx` = issue-driven, `standalone` = human-written document review)
- **Pre-review gates**: PASS | FAIL (`<which gate>`)
- **Findings**: `<c>` Critical, `<h>` High, `<m>` Medium, `<l>` Low
- **Frameworks cited**: `<Azure WAF | AWS WAF | ATAM | STRIDE | ISO/IEC 25010 | NIST CSF | OWASP | C4 | TOGAF | arc42>`
- **Decision rationale (one paragraph)**: `<why APPROVED / CHANGES REQUESTED / BLOCKED>`

---

## Pre-Review Gates

If any required gate is FAIL, return `BLOCKED` and do not proceed to the 12 dimensions.

Use the **AgentX Workflow** gate table when the review is for an issue with PRD/ADR/Spec produced through AgentX. Use the **Standalone** gate table when the review is for a human-written architecture document, ADR, tech spec, design doc, or RFC outside the AgentX lifecycle (e.g. user asked the Reviewer to evaluate an existing document). Fill exactly one of the two tables.

### AgentX Workflow Mode

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | ADR file present at `${adr_path}` | PASS / FAIL | |
| 2 | Tech Spec present at `${spec_path}` | PASS / FAIL | |
| 3 | PRD present at `${prd_path}` (for traceability) | PASS / FAIL / N/A | |
| 4 | ADR contains 3+ options with explicit comparison | PASS / FAIL | |
| 5 | ADR records Decision and Consequences | PASS / FAIL | |
| 6 | Tech Spec contains diagrams (Mermaid / PlantUML / referenced images) | PASS / FAIL | |
| 7 | Tech Spec contains zero code examples (Architect zero-code policy) | PASS / FAIL | |
| 8 | Data Scientist alignment present (only when `needs:ai`) | PASS / FAIL / N/A | |

### Standalone Document Mode (Human-Written Doc / ADR / Spec / RFC)

Use these gates when the review target is a single architecture document outside the AgentX issue lifecycle. The 12-dimension review still applies in full -- only the upstream presence checks change.

| # | Standalone Gate | Status | Notes |
|---|------------------|--------|-------|
| S1 | Document present at the provided path | PASS / FAIL | |
| S2 | Document states a Decision or recommended approach | PASS / FAIL | |
| S3 | Document records rationale (why this, not why something else) | PASS / FAIL | |
| S4 | Document considers at least one alternative (or explicitly states none was viable, with reason) | PASS / FAIL | |
| S5 | Document states non-functional requirements or quality attributes | PASS / FAIL | |
| S6 | Document includes at least one diagram OR a clear component model in prose | PASS / FAIL | |

---

## Dimension Coverage Matrix

Mark each dimension `OK` (no findings), `Issues` (one or more findings), or `N/A` (with one-sentence rationale only when the dimension genuinely does not apply).

| # | Dimension | Status | Findings | Frameworks Applied |
|---|-----------|--------|----------|--------------------|
| 1 | Business and Requirements Alignment | OK / Issues / N/A | `<count>` | ATAM, ISO/IEC 25010 |
| 2 | Scalability and Performance | | | Azure WAF (Performance Efficiency), AWS WAF (Performance) |
| 3 | Reliability and Resilience | | | Azure WAF (Reliability), AWS WAF (Reliability) |
| 4 | Security | | | STRIDE, OWASP ASVS, NIST CSF, Azure WAF (Security) |
| 5 | Data Architecture | | | ISO/IEC 25010 (compatibility, portability) |
| 6 | Integration and APIs | | | C4 (component), arc42 |
| 7 | Observability | | | RED, USE, OpenTelemetry |
| 8 | Deployment and Operations | | | Azure WAF (Operational Excellence), AWS WAF (Operational Excellence) |
| 9 | Cost and Efficiency | | | Azure WAF (Cost Optimization), AWS WAF (Cost) |
| 10 | Maintainability and Evolution | | | Conway's Law, ISO/IEC 25010 (maintainability) |
| 11 | Compliance and Governance | | | TOGAF, NIST CSF |
| 12 | Risks and Trade-offs | | | ATAM (sensitivity points, tradeoffs) |

---

## Findings

> Order strictly by severity: Critical -> High -> Medium -> Low.
> Every finding MUST cite the specific ADR/Spec section and line range, and MUST include evidence-of-harm (a concrete failure scenario or compliance citation). No speculative warnings.

### CRITICAL: `<title>`

- **Dimension**: `<1..12>`
- **Artifact**: `<ADR | Spec>` -- section "`<heading>`" (lines `<a>`-`<b>`)
- **Framework**: `<Azure WAF | STRIDE | ATAM | ...>`
- **Evidence of harm**: `<concrete failure scenario, regulatory citation, or measured shortfall vs PRD NFR>`
- **Recommendation**: `<what to change in the ADR/Spec, not how to code it>`

### HIGH: `<title>`

- **Dimension**:
- **Artifact**:
- **Framework**:
- **Evidence of harm**:
- **Recommendation**:

### MEDIUM: `<title>`

- **Dimension**:
- **Artifact**:
- **Framework**:
- **Evidence of harm**:
- **Recommendation**:

### LOW: `<title>`

- **Dimension**:
- **Artifact**:
- **Framework**:
- **Evidence of harm**:
- **Recommendation**:

---

## Severity Rubric

| Severity | Criteria | Blocks Approval |
|----------|----------|-----------------|
| **Critical** | Architectural defect that will cause data loss, security breach, regulatory violation, or production outage; or pre-review gate failure | Yes |
| **High** | NFR not satisfied (latency, availability, throughput, security control); SPOF without mitigation; missing required compliance control; broken contract with upstream/downstream system | Yes |
| **Medium** | Quality attribute risk under realistic load or failure; observability or operability gap; cost overrun risk; incomplete trade-off analysis | Recommend fix; do not block unless multiple Medium findings cluster on same dimension |
| **Low** | Documentation gap, missing diagram detail, minor convention deviation, unstated assumption | Do not block |

---

## STRIDE Threat Model Coverage (Dimension 4)

For every component or boundary that crosses a trust boundary, confirm STRIDE coverage. Mark `Addressed`, `Gap`, or `N/A` per row. Open a Finding for any `Gap`.

| Trust Boundary | Spoofing | Tampering | Repudiation | Information Disclosure | Denial of Service | Elevation of Privilege |
|----------------|----------|-----------|-------------|------------------------|-------------------|------------------------|
| `<boundary 1>` | | | | | | |
| `<boundary 2>` | | | | | | |
| `<boundary 3>` | | | | | | |

---

## NFR Traceability (Dimensions 1, 2, 3)

Map each PRD non-functional requirement to a component or section in the Spec. Open a Finding for any `Unmapped`.

| PRD NFR | Target | Spec Section / Component | Status |
|---------|--------|--------------------------|--------|
| `<latency>` | `<value>` | `<section>` | Mapped / Partial / Unmapped |
| `<availability>` | `<value>` | `<section>` | |
| `<throughput>` | `<value>` | `<section>` | |
| `<RTO>` | `<value>` | `<section>` | |
| `<RPO>` | `<value>` | `<section>` | |
| `<security control>` | `<value>` | `<section>` | |

---

## Trade-offs and Sensitivity Points (Dimension 12)

ATAM-style summary of explicit trade-offs in the ADR Decision.

| Trade-off | Chosen | Rejected | Sensitivity Point | Risk if Wrong |
|-----------|--------|----------|-------------------|----------------|
| `<e.g. consistency vs availability>` | | | | |
| `<e.g. cost vs resilience>` | | | | |

---

## Open Questions for Architect

- `<question 1>`
- `<question 2>`

---

## Decision Rationale

`<2-4 sentences explaining why APPROVED / CHANGES REQUESTED / BLOCKED, referencing the highest-severity findings and the dimensions they affect>`

---

## Self-Review Checklist (Reviewer)

- [ ] Pre-review gates evaluated first; `BLOCKED` returned if any gate failed
- [ ] Every one of the 12 dimensions has a status (`OK`, `Issues`, or `N/A` with rationale)
- [ ] Every finding cites specific ADR/Spec section and line range
- [ ] Every finding has evidence-of-harm (concrete scenario or compliance citation)
- [ ] No findings outside ADR/Spec scope (no code, no implementation critique)
- [ ] No new architecture options proposed (critique only)
- [ ] STRIDE table populated for every trust boundary; gaps converted into Findings
- [ ] NFR traceability table populated; unmapped NFRs converted into Findings
- [ ] Severity levels match the rubric (no inflated Highs)
- [ ] Findings ordered Critical -> High -> Medium -> Low
- [ ] Decision (`APPROVED` / `CHANGES REQUESTED` / `BLOCKED`) is consistent with finding severity
- [ ] Report saved to `docs/artifacts/reviews/ARCH-REVIEW-${issue_number}.md`