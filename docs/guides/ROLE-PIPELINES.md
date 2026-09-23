# Role Pipelines

Each Frontier FDE follows its phases in order; each phase gate passes before the
next phase starts. The agent file in `.github/agents/` is authoritative for its
own role. This table is the cross-role summary the Orchestration FDE uses when it
runs specialist phases in one session. The pre-commit hook validates PRD, ADR and
UX structure, and `frontier validate <issue> <role>` runs the stage gate for
PRD, UX, ADR/Spec, review and certification deliverables (advisory by default;
see `evaluation/rubrics/stage-gates.md`).

| Role | Phases (in order) | Key delivery gate |
|------|-------------------|-------------------|
| Frontier (Hub) | Classify -> Route -> Execute specialist phases -> Validate handoffs | All specialist phase gates pass before advancing |
| Product Manager | Research -> Classify intent -> Model Council (prd-scope) -> PRD -> Backlog -> Self-review | PRD complete; backlog linked to PRD; council convened or skip rationale recorded; `requirements` stage gate passes |
| UX Designer | Read PRD -> Design research -> UX spec -> HTML/CSS prototypes -> Self-review | WCAG 2.1 AA prototypes in `docs/ux/prototypes/`; `ux` stage gate passes |
| Architect | Research -> ADR (3+ options) -> Model Council (adr-options) -> Tech spec -> AI alignment (if `needs:ai`) -> PM fit check -> Self-review | Decision matches council consensus or records an override; zero code examples in the spec; `architecture` stage gate passes |
| Engineer | Research -> Brainstorm -> Plan -> Design -> Conditional design alignment -> Implement -> Scrub -> Test -> Review | Loop complete; coverage >= 80%; code-quality rubric >= 80 |
| Reviewer | Read context -> Verify loop -> Functional review -> Code review -> Run tests -> Model Council (code-review) -> Write review -> Decision | Decision stated; findings reflect council synthesis or record an override; `review` stage gate passes |
| Auto-Fix Reviewer | Read context -> Verify loop -> Review -> Apply safe fixes -> Document -> Decision | Auto-fixes pass the relevant suite; review document complete |
| DevOps Engineer | Read context -> Design pipeline -> Implement workflows -> Validate -> Self-review | Pipelines lint and run; deployment docs updated |
| Data Scientist | Research -> Model Council (ai-design) -> Pipeline design -> Eval plan -> Implementation -> Drift monitoring -> Self-review | Eval baseline and model card exist |
| Tester | Read context -> Write tests -> Execute suite -> Report defects -> Certification report | Test pyramid complete; certification report signed off; `certification` stage gate passes |
| Fabric Engineer | Read context -> Discover sources -> Design data product -> Implement -> Validate data quality -> Document | Parameterized, idempotent artifacts; quality, lineage and recovery gates pass |
| Power Platform Builder | Read context -> Select components -> Scaffold -> Generate -> Validate package -> Document | Portable unmanaged source; package validation passes; no tenant-mutating command ran |
| Power BI Analyst | Read context -> Semantic model -> DAX -> Power Query -> Report layout -> Optimize -> Docs | Semantic model validated; DAX measures tested |
| Consulting Research | Understand request -> Research -> Model Council (research) -> Calibrate audience -> Deliverable | Key claims sourced and triangulated |
| Agile Coach | Mode selection -> Create/refine/decompose story -> Confirm -> Output | INVEST met; acceptance criteria in Given/When/Then |

`frontier workflow <role>` prints the role's handoff chain, not these phases.
