# Product Backlog Item Examples

> **Parent skill**: [PRD](../SKILL.md)
> **Purpose**: Reference examples for writing Product Backlog Items (PBIs), Features, and User Stories that are ready for downstream architecture, design, engineering, and review.
> **Rule**: A PBI is ready only when a downstream agent can understand the user outcome, scope boundary, acceptance tests, dependencies, and evidence expectation without guessing.

---

## PBI Quality Bar

Every PBI created by the Product Manager MUST include:

| Field | Quality bar |
|-------|-------------|
| Title | Starts with `[Feature]`, `[Story]`, `[Bug]`, or `[Spike]` and names the user-visible outcome, not the implementation task. |
| User / customer | Names the persona or operator who receives value. |
| Problem / opportunity | Explains the current pain, business risk, or measurable gap. |
| Outcome | States the value created when the PBI is done. |
| Scope | Lists what is included now and what is explicitly out of scope. |
| Acceptance criteria | Uses Given/When/Then or equivalent testable bullets, including at least one edge or failure case. |
| Evidence | Names how completion will be verified: test, metric, artifact, screenshot, report, or eval result. |
| Dependencies | Lists upstream blockers, linked PRD/ADR/spec/UX artifacts, and cross-team needs. |
| Priority rationale | Explains why this is P0/P1/P2 using impact, risk, or sequencing. |

Avoid PBIs that only say "build X" or "add Y". A good PBI explains why X matters, who benefits, how small the slice is, and what proof will close it.

---

## Splitting Rules

Split a PBI when any of these are true:

- More than one persona receives distinct value.
- The acceptance criteria require different release gates or owners.
- The work spans UI, API, data, AI, and DevOps in ways that cannot be completed in one sprint.
- A failure mode can be shipped independently from the happy path.
- The item depends on an unresolved architecture, UX, or data-science decision.

Do not split by technical layer alone. Prefer vertical slices that users can validate:

```text
[FAIL] Add database table
[FAIL] Add API endpoint
[FAIL] Add React screen

[PASS] As a compliance analyst, I can upload the monthly exception file and see row-level validation errors before submitting it.
```

---

## PBI Body Template

Use this shape for Feature, Story, and Scrum Product Backlog Item work items. Keep it concise enough for an issue tracker, but complete enough for handoff.

```markdown
## User Outcome
As a <persona>, I want <capability>, so that <measurable value or decision improves>.

## Problem
<Current pain, evidence, baseline, or risk. Link the PRD section.>

## Scope
Included:
- <behavior or capability in this PBI>

Out of scope:
- <nearby capability intentionally deferred>

## Acceptance Criteria
- Given <precondition>, when <action>, then <observable result>.
- Given <edge or failure condition>, when <action>, then <safe or expected behavior>.
- Given <permission / data / environment constraint>, when <action>, then <observable result>.

## Evidence Required
- <test command, metric target, artifact path, screenshot, eval score, or review evidence>

## Dependencies
- PRD: <path or issue link>
- ADR/Spec/UX/Data: <path or TBD>
- Blockers: <none or list>

## Priority Rationale
<Why now: user impact, compliance date, risk reduction, dependency unblock, or revenue impact.>
```

---

## Bad vs Good

### Weak PBI

```markdown
Title: Add dashboard filters

Description:
Users need better filtering on the dashboard.

Acceptance Criteria:
- Filters work.
- UI is easy to use.
```

Why this fails:

- Persona is missing.
- "Better" and "easy" are not testable.
- No baseline, failure case, dependency, or completion evidence.
- The engineer must guess which filters, which dashboard, and what counts as done.

### Strong PBI

```markdown
Title: [Story] Filter risk dashboard by region and control owner

## User Outcome
As a compliance manager, I want to filter the risk dashboard by region and control owner, so that I can prepare monthly exception review packs without exporting to Excel.

## Problem
Monthly review prep takes 45 minutes because managers export all open risks and manually filter by region and owner. PRD-128 section 3 targets reducing review prep time to <=15 minutes.

## Scope
Included:
- Add region and control-owner filters to the existing risk dashboard.
- Persist selected filters in the URL so links can be shared.
- Show an empty state when no risks match the selected filters.

Out of scope:
- Saved filter presets.
- New dashboard widgets.
- Changes to risk scoring logic.

## Acceptance Criteria
- Given the dashboard has risks across multiple regions, when I select `EMEA`, then the list shows only risks whose region is `EMEA` and the result count updates.
- Given I select control owner `A. Patel`, when I copy and reopen the URL, then the same owner filter is applied.
- Given selected filters match zero risks, when the dashboard loads, then an empty state states `No risks match these filters` and offers a clear-filters action.
- Given I do not have access to a region, when I open a shared filtered URL for that region, then restricted risks are not shown and no access details are leaked.

## Evidence Required
- Unit tests cover filter query parsing and result filtering.
- Browser test covers selecting both filters, sharing the URL, and clearing an empty state.
- Accessibility scan has zero High/Critical findings on the filtered dashboard route.

## Dependencies
- PRD: docs/artifacts/prd/PRD-128.md section 3.
- UX: docs/ux/UX-128.md dashboard filter pattern.
- Blockers: none.

## Priority Rationale
P0 because it directly supports the PRD metric to reduce monthly review prep from 45 minutes to <=15 minutes before the Q3 compliance review cycle.
```

---

## AI PBI Example

Use this shape when a PBI includes AI behavior. Keep the PBI product-facing; Architect and Data Scientist own implementation details.

```markdown
Title: [Story] Summarize support case history with cited source messages

## User Outcome
As a support lead, I want an AI-generated case summary with citations to source messages, so that I can review escalation context in <=2 minutes without reading the full thread.

## Problem
Escalation review currently takes 12 minutes median across 80 sampled cases because leads read long case histories manually. PRD-210 targets median review time <=2 minutes while preserving citation accuracy >=95%.

## Scope
Included:
- Generate a summary from messages already visible to the support lead.
- Include citations to source message IDs for each factual claim.
- Fall back to a manual review prompt when citation confidence is below threshold.

Out of scope:
- Auto-sending responses to customers.
- Reading private notes outside the lead's permissions.
- Training or fine-tuning a model.

## Acceptance Criteria
- Given a case with at least five messages, when the lead requests a summary, then the response includes `summary`, `key_events`, `open_questions`, and `citations` fields.
- Given the model cannot cite at least 95% of factual claims to source message IDs on the eval set, when CI runs the case-summary evaluation, then the build fails.
- Given retrieval confidence is <0.6 for the case thread, when the lead requests a summary, then the product shows `Summary unavailable. Review the case history directly.` and does not fabricate citations.
- Given the lead lacks permission for a private note, when generating the summary, then that note is excluded from grounding and citations.

## Evidence Required
- Evaluation dataset: evaluation/datasets/case-summary.jsonl with >=50 held-out cases.
- Quality gate: citation precision >=95% and faithfulness >=0.85.
- Security test proves unauthorized private notes are excluded.

## Dependencies
- PRD: docs/artifacts/prd/PRD-210.md AI contract.
- Data Scientist: eval rubric and dataset ownership.
- Architect: authorization and grounding-source contract.

## Priority Rationale
P0 because it validates the central AI value proposition while keeping high-risk autonomous customer actions out of scope.
```

---

## Ready Checklist

Before creating or moving a PBI to `Ready`, confirm:

- [ ] Persona, problem, outcome, and priority rationale are present.
- [ ] Scope includes explicit non-goals or deferred nearby capabilities.
- [ ] Acceptance criteria are observable and include a failure, permission, or edge case.
- [ ] Evidence required is concrete enough for Reviewer or Tester to verify.
- [ ] Dependencies are linked or marked `TBD` with an owner.
- [ ] The item is small enough for one sprint or explicitly split.
- [ ] AI-bearing PBIs include fallback behavior, grounding boundaries, and quality thresholds.
