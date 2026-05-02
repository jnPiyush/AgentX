# Execution Plan: Templates Upgrade with Industry Best Practices and Mermaid Diagrams

**Date**: 2026-05-01
**Owner**: Agent X (Auto)
**Scope**: All 12 templates under `.github/templates/`

## Purpose

Upgrade every template to current industry best practice and add Mermaid-first diagrams for key concepts and complex flows. Reference standards: MADR 4.0, C4 Model, Conventional Comments, NN/g Journey/Service Blueprint, OWASP Threat Modeling, MITRE ATT&CK, NIST CSF, Now/Next/Later roadmap, ATAM, Fitness Functions.

## Progress

- [x] Plan created
- [x] PRD-TEMPLATE.md
- [x] ADR-TEMPLATE.md
- [x] SPEC-TEMPLATE.md
- [x] UX-TEMPLATE.md
- [x] REVIEW-TEMPLATE.md
- [x] ARCH-REVIEW-TEMPLATE.md
- [x] SECURITY-PLAN-TEMPLATE.md
- [x] EXEC-PLAN-TEMPLATE.md
- [x] PROGRESS-TEMPLATE.md
- [x] ROADMAP-TEMPLATE.md
- [x] CONTRACT-TEMPLATE.md
- [x] EVIDENCE-SUMMARY-TEMPLATE.md
- [ ] Validation pass (frontmatter + references)
- [ ] Loop iterate + complete

## Decision Log

- 2026-05-01: Additive-only edits to preserve backwards compatibility for already-generated artifacts.
- 2026-05-01: Mermaid is sole diagram format; ASCII-only rule preserved.
- 2026-05-01: New sections appended after existing sections; existing frontmatter and headings preserved.

## Plan of Work

1. PRD: add JTBD, North Star driver tree, opportunity-solution tree (Mermaid), journey map (Mermaid journey), Now/Next/Later, hypotheses table, instrumentation plan.
2. ADR: add MADR 4.0 frontmatter (deciders/consulted/informed), Decision Drivers, Confirmation, decision-driver fan-in Mermaid, status state-diagram, supersedes graph, Y-statement, weighted decision matrix.
3. SPEC: add C4 Context+Container+Component diagrams, Deployment topology, ER diagram, entity state-diagram, DFD handoff, ADR back-link table, error/idempotency/retry matrix.
4. UX: add NN/g journey map (Mermaid journey), service blueprint Mermaid, IA sitemap Mermaid, per-screen state-diagram, NN/g 10-heuristics checklist, microcopy table, dark-mode tokens, state matrix.
5. REVIEW: add Conventional Comments format guidance, review-state-machine Mermaid, risk heat map (quadrantChart), test-pyramid Mermaid.
6. ARCH-REVIEW: add ATAM utility tree Mermaid, WAF scoring radar (quadrantChart), attack-tree Mermaid, fitness-functions table, sustainability dimension.
7. SECURITY-PLAN: add OWASP-shaped DFD, entry/exit/trust-levels tables, threat-tree Mermaid, use/misuse case Mermaid, MITRE ATT&CK mapping table, NIST CSF coverage matrix, kill-chain timeline.
8. EXEC-PLAN: add Mermaid gantt, dependency flowchart, plan state-diagram, reset/compact/continue decision tree.
9. PROGRESS: add session timeline gantt, status state-diagram, checkpoint-chain flowchart.
10. ROADMAP: add Now/Next/Later flowchart, theme->initiative->release hierarchy, inter-release dependency graph, OKR alignment table.
11. CONTRACT: add plan-to-evidence flow Mermaid, contract status state-diagram, AC traceability table.
12. EVIDENCE-SUMMARY: add three-class -> decision flow Mermaid, filled mini-example block.

## Validation and Acceptance

- `pwsh scripts/validate-frontmatter.ps1` -> pass
- `pwsh scripts/validate-references.ps1` -> no new broken links introduced by these edits
- All Mermaid blocks parseable (manual visual scan)
- ASCII-only preserved
- No backwards-incompatible heading renames

## Idempotence and Recovery

- Edits are additive: rerunning would no-op via guard headings.
- If a template breaks, revert via git for that single file.

## Artifacts

- 12 modified template files under `.github/templates/`
- This plan: `docs/execution/plans/PLAN-templates-upgrade-2026-05-01.md`

## Outcomes

- Pending until edits complete and validation passes.
