---
inputs:
  artifact_title: "AgentX Integration with VS Code Agents Window (Preview)"
  adr_path: "docs/artifacts/adr/ADR-400.md"
  spec_path: "docs/artifacts/specs/SPEC-400.md"
  prd_path: "N/A (architecture-driven feature, no PM phase)"
  architect: "AgentX Architect"
  reviewer: "AgentX Architecture Reviewer"
  date: "2026-06-01"
  domain_labels: ""
  mode: "agentx"
---

# Architecture Review: AgentX Integration with VS Code Agents Window (Preview)

- **Mode**: ``agentx``
- **ADR**: [docs/artifacts/adr/ADR-400.md](../adr/ADR-400.md)
- **Tech Spec**: [docs/artifacts/specs/SPEC-400.md](../specs/SPEC-400.md)
- **PRD**: N/A -- self-initiated architecture task (no product feature behind it)
- **Council**: [docs/artifacts/adr/COUNCIL-400.md](../adr/COUNCIL-400.md)
- **Architect**: AgentX Architect
- **Reviewer**: AgentX Architecture Reviewer (internal sub-agent)
- **Date**: 2026-06-01
- **Domain labels**: (none -- not ``needs:ai``; AI contract unchanged per SPEC s.13)
- **Decision**: APPROVED WITH MINOR FINDINGS

---

## Summary

- **Mode**: ``agentx`` (issue-driven)
- **Pre-review gates**: PASS (gate 3 N/A with documented rationale; all other gates PASS)
- **Findings**: 0 Critical, 0 High, 3 Medium, 4 Low
- **Frameworks cited**: Azure WAF (Reliability, Operational Excellence), ATAM (tradeoffs), arc42 (decision record completeness), C4 (component diagrams), ISO/IEC 25010 (maintainability, portability)
- **Decision rationale**: ADR-400, COUNCIL-400, and SPEC-400 form a coherent, evidence-based architecture package. The Decision (Option C, Agents-Window-Native Customizations + CLI Bridge + Thin Extension) is the council-consensus option, the evaluation matrix is weighted and scored explicitly (C=4.30 vs A=2.95 next best), and the Skeptic-raised failure modes are demonstrably promoted into the Spec risk register (s.11) and the ADR Consequences. No Critical or High findings were identified. Three Medium findings address concrete observability, rollback, and platform-approach gaps that the Engineer phase should resolve before Phase 1 ships. Four Low findings are documentation polish.

---

## Pre-Review Gates

### AgentX Workflow Mode

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1 | ADR file present at ``docs/artifacts/adr/ADR-400.md`` | PASS | 4 options, weighted matrix, Decision + Consequences + Implementation |
| 2 | Tech Spec present at ``docs/artifacts/specs/SPEC-400.md`` | PASS | 13 sections + Selected Tech Stack + Open Questions |
| 3 | PRD present | N/A | Self-initiated architecture task; no PM phase. Origin is the VS Code Agents Window Preview (May 2026) creating a platform-fit requirement. Architect documented this in ADR Context. |
| 4 | ADR contains 3+ options with explicit comparison | PASS | 4 options (A/B/C/D) each with Mermaid diagram + pros/cons/Effort/Risk; weighted 7-criteria evaluation matrix |
| 5 | ADR records Decision and Consequences | PASS | Decision = Option C with 5 architectural choices enumerated; Consequences split Positive/Negative/Neutral |
| 6 | Tech Spec contains diagrams (Mermaid) | PASS | 4 Mermaid diagrams (two-surface delivery, Hub-and-Spoke frontmatter, quality-loop sequence, customizations bundle tree) |
| 7 | Tech Spec contains zero code examples | PASS | All 8 fenced blocks are ``mermaid``; verified by code-fence audit |
| 8 | Data Scientist alignment present (``needs:ai`` only) | N/A | SPEC s.13 explicitly states no AI contract added/changed/removed; alignment not required per WORKFLOW.md rules |
| 9 | Platform approach stated with rationale | PARTIAL | Implicit (pro-code TypeScript extension + pro-code PowerShell/bash hooks + low-code-style Markdown frontmatter for ``.agent.md``). Not explicitly documented in the Low-Code vs Pro-Code rubric framing. See MED-3. |

---

## Dimension Coverage Matrix

| # | Dimension | Status | Findings | Frameworks Applied |
|---|-----------|--------|----------|--------------------|
| 1 | Business and Requirements Alignment | OK | 0 | ATAM, ISO/IEC 25010 |
| 2 | Scalability and Performance | OK | 0 | Azure WAF (Performance Efficiency) |
| 3 | Reliability and Resilience | Issues | 1 Medium | Azure WAF (Reliability) |
| 4 | Security | OK | 0 | STRIDE, OWASP -- no new trust boundary introduced |
| 5 | Data Architecture | N/A | 0 | No new persistent data; only ``loop-state.json`` + ``hook-trace.jsonl`` extensions to existing files |
| 6 | Integration and APIs | OK | 1 Low | C4 (component), arc42 |
| 7 | Observability | Issues | 1 Medium | RED, USE |
| 8 | Deployment and Operations | Issues | 1 Low | Azure WAF (Operational Excellence) |
| 9 | Cost and Efficiency | OK | 0 | Azure WAF (Cost Optimization) -- no new external dependency |
| 10 | Maintainability and Evolution | Issues | 1 Medium + 1 Low | Conway's Law, ISO/IEC 25010 |
| 11 | Compliance and Governance | N/A | 0 | No regulated data; internal tooling |
| 12 | Risks and Trade-offs | OK | 1 Low | ATAM (sensitivity points) |

---

## Platform Approach (Pro-Code vs Low-Code vs Hybrid)

| Field | Value |
|-------|-------|
| Selected approach | **Hybrid** (declarative ``.agent.md`` + ``.skill.md`` Markdown surface, backed by pro-code TypeScript extension activation and PowerShell/bash hook scripts) |
| Platforms / SDKs named in ADR/Spec | VS Code Customizations API, ``.agent.md`` schema, ``tools: ['agent']`` + ``agents:`` allowlist, VS Code Hooks API, AgentX CLI v8.x (PowerShell 7.4+ / bash 4+), Customizations Plugin bundle, VS Code Marketplace |
| Alternatives considered in ADR | Yes -- Option A (Customizations-only, no extension), Option B (Dual-surface), Option D (MCP-only) all rejected with documented reasoning |
| Hybrid boundary (if Hybrid) | Declarative layer (``.agent.md``, ``.skill.md``, ``hooks.json``) owned by Agents Window; imperative bridge (hook scripts, ``agentx.ps1``) owned by AgentX CLI; thin extension layer only for activation registration and folder-trust handshake |
| Rubric score summary | Not run formally against the Low-Code vs Pro-Code 12-dimension rubric. See MED-3. |
| Anti-patterns checked | "Big-bang rewrite" avoided (kept chat participant active during Phase 1-2 per s.10); "Hidden imperative logic in declarative surface" avoided (frontmatter is advisory only, hooks carry the enforcement) |
| AI-specific call-out | N/A -- AI contract unchanged per SPEC s.13 |
| Decision risk | Low (with documented Skeptic-raised Preview-API dependency as the residual risk) |

---

## Findings

> Ordered Critical -> High -> Medium -> Low. Every finding cites the artifact section and evidence-of-harm.

### MEDIUM: Rollback criterion for Phase 1 -> Phase 2 promotion is not measurable

- **Dimension**: 3 (Reliability and Resilience), also 8 (Deployment and Operations)
- **Artifact**: SPEC -- section "10. Rollout Plan" (Phase 1 entry + Phase 2 promotion criteria)
- **Framework**: Azure WAF (Operational Excellence -- deployment strategy and rollback criteria)
- **Evidence of harm**: Phase 1 ships the Customizations bundle behind ``extensions.supportAgentsWindow`` opt-in while keeping the chat participant active. The Spec does not state a measurable rollback trigger (e.g., "if loop-start hook failure rate > N% over 7 days, disable Hooks and fall back to pre-commit-only enforcement"). Without a measurable trigger, a regression in hook reliability could persist across multiple AgentX versions before being noticed. The COUNCIL Skeptic explicitly flagged "hook portability" as a Medium failure mode (council file, Skeptic perspective row 3); the Spec accepted the mitigation but did not encode an SLO.
- **Recommendation**: Add to SPEC s.10 a Phase 2 promotion criterion of the form "Hooks succeed on >=99% of session-start / pre-tool / post-tool / session-end invocations measured across N user-weeks, sampled from ``hook-trace.jsonl``." Also add the symmetric rollback condition for Phase 1 -> Phase 0 disabled.

### MEDIUM: Observability section defines instrumentation but no alerting thresholds tied to SLOs

- **Dimension**: 7 (Observability)
- **Artifact**: SPEC -- section "12. Monitoring and Observability" (4 bullets)
- **Framework**: RED, USE (Azure WAF Operational Excellence)
- **Evidence of harm**: s.12 lists what is captured (``loop-state.json`` extension, ``hook-trace.jsonl``, install-latency metric, hook-failure logging) but does not state thresholds at which a human or the AgentX runtime is expected to act. Per RED, a Duration / Error-rate signal without a budget is a metric with no decision boundary. The Architecture Reviewer agent's own checklist (line "Alerting thresholds tied to SLOs, not arbitrary numbers") flags this as a Medium gap. This becomes operationally relevant in Phase 2 (default-on for AgentX users) where silent hook failures degrade the very enforcement gate the architecture relies on.
- **Recommendation**: Extend SPEC s.12 with a small SLO table -- e.g., "hook p95 duration < 500ms; hook error rate < 1% rolling 24h; loop-state staleness alarm at > 30 minutes since last ``loop iterate``". Do not specify the alerting transport (that is an Engineer-phase decision); just commit the thresholds in the Spec.

### MEDIUM: Platform-approach rubric not formally applied even though the design straddles declarative and imperative surfaces

- **Dimension**: 10 (Maintainability and Evolution); secondary 12 (Risks and Trade-offs)
- **Artifact**: ADR -- "Decision" section (5 architectural choices) and SPEC -- s.1.1 "Selected Tech Stack"
- **Framework**: ISO/IEC 25010 (maintainability, portability)
- **Evidence of harm**: The design is genuinely hybrid: ``.agent.md`` / ``.skill.md`` / ``hooks.json`` are declarative Markdown-or-JSON surfaces consumed by Agents Window, while ``agentx.ps1``, the hook scripts, and the thin TypeScript extension are pro-code. The Low-Code vs Pro-Code skill rubric was not run against this split, even though pre-review gate 9 marks it required for AI-bearing solutions and recommended otherwise. Without the rubric, the hybrid boundary risk surfaces during the Engineer phase rather than being acknowledged in the ADR (e.g., who owns ``.agent.md`` schema drift -- AgentX or VS Code? What is the contract test that prevents an AgentX-internal ``.agent.md`` extension field from breaking the dropdown?). The COUNCIL Skeptic flagged ``.agent.md`` schema churn as a Medium failure mode (council file, Skeptic row 2); the rubric would have made the boundary explicit.
- **Recommendation**: Append a one-page section to ADR-400 titled "Platform Approach" running the [Low-Code vs Pro-Code skill](../../.github/skills/architecture/low-code-vs-pro-code/SKILL.md) 12-dimension rubric across the hybrid boundary; or, if the Architect judges this disproportionate for an internal tooling ADR, explicitly mark pre-review gate 9 as accepted-risk in the ADR Consequences and reference this review's finding.

### LOW: Open Questions in SPEC have no owner or target resolution date

- **Dimension**: 12 (Risks and Trade-offs); secondary 10 (Maintainability)
- **Artifact**: SPEC -- "Open Questions" section (3 questions)
- **Framework**: arc42 (decision-record completeness)
- **Evidence of harm**: All three Open Questions are correctly deferred to the Engineer phase, but none carries an owner or a "must-be-resolved-before" milestone (e.g., "before Phase 1 ships" vs "before Phase 2 default-on"). Without that, a deferred question can silently outlive the rollout phase that should have answered it.
- **Recommendation**: For each Open Question, append ``Owner: Engineer phase`` and ``Resolve by: Phase <N> entry`` to make the deferral auditable.

### LOW: Hooks event-to-CLI mapping table does not enumerate failure-mode behavior per event

- **Dimension**: 6 (Integration and APIs)
- **Artifact**: SPEC -- section "5. Hooks Lifecycle" (event-to-CLI mapping table)
- **Framework**: arc42 (integration contract completeness)
- **Evidence of harm**: The table maps each of the 4 used hook events to a CLI command and a portability rule, but does not state what happens when the CLI command itself fails. For ``post-tool`` -> ``loop iterate``, a non-zero exit could plausibly mean "tool ran but loop unrecorded" or "tool succeeded but loop now broken". The Engineer phase will have to invent this convention; capturing it in the Spec prevents inconsistency across the 4 hook scripts.
- **Recommendation**: Add a 5th column "On CLI failure" to the table -- e.g., "warn-only (do not block the Agents Window action)" vs "block session (return non-zero exit from hook)". Suggested default: warn-only for ``post-tool`` and ``session-end``; block for ``session-start`` and ``pre-tool``.

### LOW: ``.agent.md`` frontmatter migration is described in s.10 but the conversion contract is not specified

- **Dimension**: 10 (Maintainability and Evolution)
- **Artifact**: SPEC -- s.10 Phase 0 (frontmatter compatibility) and s.4 Customizations Bundle Layout
- **Framework**: ISO/IEC 25010 (portability)
- **Evidence of harm**: The 24 existing ``.agent.md`` files were authored before the VS Code Agents Window schema was finalized (per ADR Context). The Spec implies the existing frontmatter is forward-compatible but does not name the exact fields that map (e.g., ``tools:``, ``agents:``, ``visibility:``, ``model:``, ``reasoning:``) vs the AgentX-internal fields that the VS Code schema will ignore (e.g., ``constraints:``, ``boundaries:``). Without this mapping table, an Engineer adding a new field cannot tell whether it lands in the dropdown or only in the AgentX runtime.
- **Recommendation**: Add a small "Frontmatter Field Compatibility" table to SPEC s.4 with three columns: Field, Consumed by Agents Window, Consumed by AgentX runtime.

### LOW: Council "fallback runner-up" decision (Option A vs B) is recorded in COUNCIL but not echoed in ADR Consequences

- **Dimension**: 12 (Risks and Trade-offs)
- **Artifact**: ADR -- "Consequences (Negative)" section vs COUNCIL -- "Synthesis -- Divergences"
- **Framework**: ATAM (sensitivity points)
- **Evidence of harm**: The COUNCIL records a real divergence: Analyst/Strategist would fall back to Option A, Skeptic would fall back to Option B, with the Synthesis resolving in favor of Option A. The ADR Consequences mention "Preview-API dependency" as a negative but do not state the fallback plan. If Option C has to be abandoned mid-rollout (e.g., Customizations API changes shape), an Engineer reading only the ADR will not know that the council pre-decided "fall back to A".
- **Recommendation**: Add one bullet to ADR-400 "Consequences (Neutral)" of the form: "Pre-decided fallback if Option C becomes unviable: Option A (Customizations-only, no extension). See [COUNCIL-400](./COUNCIL-400.md) Synthesis."

---

## Severity Rubric

| Severity | Criteria | Blocks Approval |
|----------|----------|-----------------|
| **Critical** | Architectural defect that will cause data loss, security breach, regulatory violation, or production outage; or pre-review gate failure | Yes |
| **High** | NFR not satisfied; SPOF without mitigation; missing required compliance control; broken contract | Yes |
| **Medium** | Quality attribute risk under realistic load or failure; observability or operability gap; cost overrun risk; incomplete trade-off analysis | Recommend fix; do not block unless multiple Medium findings cluster on same dimension |
| **Low** | Documentation gap, missing diagram detail, minor convention deviation, unstated assumption | Do not block |

The 3 Medium findings in this review do not cluster on a single dimension (Reliability, Observability, Maintainability) and each has a small, surgical recommendation. Decision is APPROVED WITH MINOR FINDINGS; Architect should incorporate the 3 Medium findings before Engineer-phase entry, and the 4 Low findings before Phase 1 ships.

---

## STRIDE Threat Model Coverage (Dimension 4)

No new trust boundary is introduced by this architecture. The Customizations bundle, ``.agent.md`` files, and hook scripts all run inside the user's existing VS Code trust boundary (folder-trust required, per SPEC s.6 Security Considerations). STRIDE table marked N/A.

| Trust Boundary | Spoofing | Tampering | Repudiation | Information Disclosure | Denial of Service | Elevation of Privilege |
|----------------|----------|-----------|-------------|------------------------|-------------------|------------------------|
| N/A -- no new boundary | -- | -- | -- | -- | -- | -- |

---

## NFR Traceability (Dimensions 1, 2, 3)

No formal PRD NFRs exist (self-initiated architecture). The SPEC s.7 Performance Targets table acts as the NFR substitute and is internally consistent.

| SPEC NFR | Target | Spec Section | Status |
|----------|--------|--------------|--------|
| Extension activation latency | < 300ms cold | s.7 | Mapped to s.9 Implementation Notes |
| Customizations bundle install | < 2s first run | s.7 | Mapped to s.4 bundle layout |
| Hook p95 duration | (gap -- see MED-2) | s.7 / s.12 | Partial -- threshold not stated |
| Loop-state write latency | < 50ms | s.7 | Mapped to s.5 |
| Subagent invocation overhead | <= existing CLI | s.7 | Mapped to s.3 surface contracts |
| Marketplace bundle size | < 5MB | s.7 | Mapped to s.4 |

---

## Trade-offs and Sensitivity Points (Dimension 12)

| Trade-off | Chosen | Rejected | Sensitivity Point | Risk if Wrong |
|-----------|--------|----------|-------------------|----------------|
| Native fit vs API stability | Native (Option C) | Defensive (Option B dual-surface) | Customizations API GA timing | Phase 1 ships against Preview; if API churns, all 24 agents need re-emission. Mitigated by code-gen in Phase 0 and pre-decided Option A fallback (LOW-3). |
| Maintenance simplicity vs editor UX | Native customizations | Keep chat participant only | Agents Window discoverability | If users do not adopt Agents Window, the existing chat participant remains; risk is low because both surfaces coexist through Phase 2. |
| Loop enforceability in declarative surface | Hook-driven (imperative bridge) | Frontmatter-only declarative | Hook reliability (Skeptic Medium) | Silent hook failure -> loop bypass. Mitigated by ``hook-trace.jsonl``; MED-1 + MED-2 strengthen the mitigation. |

---

## Open Questions for Architect

1. Will the Architect incorporate the 3 Medium findings into ADR-400/SPEC-400 before handing to Engineer, or accept-risk one or more of them with explicit ADR Consequences entries?
2. For LOW-3 (frontmatter field compatibility table): does the Architect want this in SPEC s.4 or as a separate companion doc that the Engineer phase owns?
3. For MED-3 (Low-Code vs Pro-Code rubric): is a one-page rubric pass acceptable, or does the Architect prefer to skip it and record accept-risk?

---

## Decision Rationale

APPROVED WITH MINOR FINDINGS. ADR-400, COUNCIL-400, and SPEC-400 form a high-quality architecture package: 4 evaluated options with a weighted scoring matrix, an actually-convened Model Council with a clean Synthesis, a 13-section Spec with explicit Selected Tech Stack and pinned version sources, and a Skeptic-raised risk register that visibly informs the Spec mitigations. No Critical or High findings exist. The 3 Medium findings (rollback measurability, SLO thresholds, Low-Code vs Pro-Code rubric) and 4 Low findings (Open-Question owners, hook-failure behavior, frontmatter field-mapping, fallback-runner-up echo) are small, surgical, and should be addressed before Engineer-phase entry rather than blocking it. Recommend the Architect close the 3 Medium findings in-place (or explicitly accept-risk them in ADR Consequences) and then promote SPEC-400 to ``Ready``.

---

## Self-Review Checklist (Reviewer)

- [x] Pre-review gates evaluated first; no BLOCKED return
- [x] All 12 dimensions have a status (OK / Issues / N/A with rationale)
- [x] Every finding cites specific ADR/Spec section
- [x] Every finding has evidence-of-harm (concrete scenario or framework citation)
- [x] No findings outside ADR/Spec scope (no code review, no implementation critique)
- [x] No new architecture options proposed
- [x] STRIDE table populated (marked N/A with rationale; no new trust boundary)
- [x] NFR traceability table populated; MED-2 raised for the partial mapping
- [x] Severity levels match the rubric (no inflated Highs; gap findings are Medium, polish findings are Low)
- [x] Findings ordered Critical -> High -> Medium -> Low
- [x] Decision (APPROVED WITH MINOR FINDINGS) is consistent with finding severity
- [x] Report saved to ``docs/artifacts/reviews/ARCH-REVIEW-400.md``
