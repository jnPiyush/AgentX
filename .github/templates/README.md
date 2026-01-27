# Templates

Reusable templates for agents to create consistent, high-quality documentation.

## Available Templates

### [ADR-TEMPLATE.md](ADR-TEMPLATE.md)
**Architecture Decision Record template**

**When to use**: Architect Agent creating architectural decisions for Epics/Features

**Sections**:
- Context (requirements, constraints, background)
- Decision (specific architectural choices)
- Options Considered (pros/cons/effort/risk for each option)
- Rationale (why the chosen option)
- Consequences (positive, negative, neutral)
- Implementation (reference to tech spec)
- References (internal/external documentation)

**Output location**: `docs/adr/ADR-{issue}.md`

**Quick start**:
```bash
cp .github/templates/ADR-TEMPLATE.md docs/adr/ADR-71.md
```

---

### [SPEC-TEMPLATE.md](SPEC-TEMPLATE.md)
**Technical Specification template**

**When to use**: Architect Agent creating implementation specs for Features/Stories

**12 sections**:
1. Overview (scope, success criteria)
2. Architecture Diagrams (system architecture, request/response flow, data flow, sequence diagrams, class diagrams, DI container)
3. API Design (endpoints, contracts, error responses)
4. Data Model Diagrams (ERD, schema tables)
5. Service Layer Diagrams (service architecture, interfaces)
6. Security Diagrams (authentication flow, RBAC, defense in depth)
7. Performance (caching strategy diagram, requirements table, optimizations)
8. Testing Strategy (test pyramid diagram, unit/integration/e2e)
9. Implementation Notes (directory structure, workflow)
10. Rollout Plan (phases with stories and timelines)
11. Risks & Mitigations (impact, probability, mitigation plans)
12. Monitoring & Observability (dashboard diagram, metrics, alerts, logs)

**Key Features**:
- Language-agnostic (no specific tech stack assumed)
- 25+ visual ASCII diagrams for architecture, flows, and security
- Sequence diagrams for authentication and CRUD operations
- Class/interface diagrams for domain and service layers
- Defense-in-depth security visualization

**Note**: Handoff checklist is in architect.agent.md (60+ items organized in 6 categories).

**Output location**: `docs/specs/SPEC-{issue}.md`

**Quick start**:
```bash
cp .github/templates/SPEC-TEMPLATE.md docs/specs/SPEC-50.md
```

---

### [PRD-TEMPLATE.md](PRD-TEMPLATE.md)
**Product Requirements Document template**

**When to use**: Product Manager Agent defining requirements for Epics

**12 sections**:
1. Problem Statement (what, why, consequences)
2. Target Users (personas, goals, pain points, behaviors)
3. Goals & Success Metrics (business KPIs, user success)
4. Requirements (functional P0/P1/P2, non-functional)
5. User Stories & Features (with acceptance criteria, estimates)
6. User Flows (primary, secondary, error scenarios)
7. Dependencies & Constraints (technical, business, resources)
8. Risks & Mitigations (impact, probability, ownership)
9. Timeline & Milestones (phases, deliverables, launch criteria)
10. Out of Scope (explicitly excluded items)
11. Open Questions (tracking decisions)
12. Appendix (research, glossary, related docs, approvals)

**Output location**: `docs/prd/PRD-{issue}.md`

**Quick start**:
```bash
cp .github/templates/PRD-TEMPLATE.md docs/prd/PRD-48.md
```

---

### [UX-TEMPLATE.md](UX-TEMPLATE.md)
**UX Design Specification template**

**When to use**: UX Designer Agent creating user interface designs for Features

**13 sections**:
1. Overview (summary, goals, success criteria)
2. User Research (personas, needs)
3. User Flows (diagrams with primary, alternative, error paths)
4. Wireframes (ASCII art layouts for each screen)
5. Component Specifications (states, variants, CSS)
6. Design System (grid, typography, colors, spacing, elevation, borders)
7. Interactions & Animations (transitions, micro-interactions, loading)
8. Accessibility (WCAG 2.1 AA: keyboard, screen readers, contrast)
9. Responsive Design (mobile/tablet/desktop breakpoints)
10. Interactive Prototypes (Figma/HTML links)
11. Implementation Notes (components, assets, testing checklist)
12. Open Questions (design decisions)
13. References (inspiration, research, standards)

**Note**: Handoff checklist is in ux-designer.agent.md (50+ items organized in 7 categories).

**Output location**: `docs/ux/UX-{issue}.md`

**Quick start**:
```bash
cp .github/templates/UX-TEMPLATE.md docs/ux/UX-51.md
```

---

### [REVIEW-TEMPLATE.md](REVIEW-TEMPLATE.md)
**Code Review Document template**

**When to use**: Reviewer Agent assessing Engineer's code for approval

**15 sections**:
1. Executive Summary (overview, verdict, confidence)
2. Code Quality (strengths, issues by severity with specific fixes)
3. Architecture & Design (patterns, SOLID principles, organization)
4. Testing (coverage metrics, test quality assessment, examples)
5. Security Review (checklist, vulnerabilities, security headers)
6. Performance Review (async patterns, N+1 queries, caching)
7. Documentation Review (XML docs, README, inline comments)
8. Acceptance Criteria Verification (Story requirements met)
9. Technical Debt (new debt, debt addressed)
10. Compliance & Standards (coding standards, Skills.md adherence)
11. Recommendations (must fix, should fix, nice to have)
12. Decision (approved/changes/rejected with detailed rationale)
13. Next Steps (for Engineer, Reviewer, PM/Architect)
14. Related Issues & PRs (dependencies, blockers)
15. Appendix (files reviewed, coverage report, CI/CD results)

**Output location**: `docs/reviews/REVIEW-{issue}.md`

**Quick start**:
```bash
cp .github/templates/REVIEW-TEMPLATE.md docs/reviews/REVIEW-50.md
```

---

## Usage Guidelines

### For Product Manager Agent

**PRD Creation**:
1. Copy PRD template to `docs/prd/PRD-{epic-id}.md`
2. Research requirements (`semantic_search`, `runSubagent`)
3. Define problem, users, goals with measurable KPIs
4. Break down into Features and User Stories (P0/P1/P2)
5. Document flows, dependencies, risks, timeline
6. Self-review for completeness
7. Commit and add `orch:pm-done` label

### For UX Designer Agent

**UX Spec Creation**:
1. Copy UX template to `docs/ux/UX-{feature-id}.md`
2. Read PRD for user needs and flows
3. Create wireframes (ASCII art) for all screens
4. Define component specs with states/variants
5. Document design system (colors, typography, spacing)
6. Ensure WCAG 2.1 AA accessibility compliance
7. Complete handoff checklist (see ux-designer.agent.md for 50+ items)
8. Commit and add `orch:ux-done` label

### For Architect Agent

**ADR Creation**:
1. Copy ADR template to `docs/adr/ADR-{epic-id}.md`
2. Read PRD (`docs/prd/PRD-{epic-id}.md`) for requirements
3. Read UX designs (`docs/ux/UX-*.md`) for user flows
4. Research existing patterns (`semantic_search`, `grep_search`)
5. Fill in ALL sections (no placeholders)
6. Complete handoff checklist (see architect.agent.md for 60+ items)
6. Self-review for completeness and clarity
7. Commit and add `orch:architect-done` label

**Tech Spec Creation**:
1. Copy SPEC template to `docs/specs/SPEC-{feature-id}.md`
2. Reference ADR for architectural decisions
3. Define ALL 13 sections with specific details
4. Include code examples, SQL schemas, API contracts
5. Specify exact files Engineer should create
6. List all dependencies and configuration
7. Self-review for implementation clarity
8. Commit and add `orch:architect-done` label

### For Reviewer Agent

**Review Doc Creation**:
1. Copy REVIEW template to `docs/reviews/REVIEW-{story-id}.md`
2. Use `get_changed_files` to see Engineer's diff
3. Review code quality, security, tests, performance
4. Document issues by severity with specific fixes
5. Verify acceptance criteria from Story
6. Make decision (approved/changes/rejected)
7. Commit review and close issue OR add `needs:changes`

### For Manual Contributors

**Without Copilot**:
```bash
# Create ADR
cp .github/templates/ADR-TEMPLATE.md docs/adr/ADR-71.md
# Edit file, fill in all sections
git add docs/adr/ADR-71.md
git commit -m "arch: add ADR for Epic #71"

# Create Tech Spec
cp .github/templates/SPEC-TEMPLATE.md docs/specs/SPEC-50.md
# Edit file, fill in all 13 sections
git add docs/specs/SPEC-50.md
git commit -m "arch: add tech spec for Feature #50"
```

---

## Template Maintenance

**When to update**:
- New best practices emerge
- Additional sections needed
- Feedback from agents/engineers

**How to update**:
1. Create GitHub Issue: `[Docs] Update [Template Name]`
2. Make changes to template file
3. Update this README if structure changes
4. Commit: `docs: update [template] template`
5. Update agent definitions if workflow changes

---

## References

- **Architect Agent**: [.github/agents/architect.agent.md](../agents/architect.agent.md)
- **Workflow Guide**: [AGENTS.md](../../AGENTS.md)
- **Skills**: [Skills.md](../../Skills.md)

---

**Last Updated**: January 22, 2026
