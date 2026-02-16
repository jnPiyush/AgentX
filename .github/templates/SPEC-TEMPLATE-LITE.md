---
inputs:
 feature_name:
 description: "Name of the feature being specified"
 required: true
 default: ""
 issue_number:
 description: "GitHub issue number for this feature"
 required: true
 default: ""
 epic_id:
 description: "Parent Epic issue number"
 required: false
 default: ""
 author:
 description: "Spec author (agent or person)"
 required: false
 default: "Solution Architect Agent"
 date:
 description: "Specification date (YYYY-MM-DD)"
 required: false
 default: "${current_date}"
---

# Technical Specification (Lite): ${feature_name}

**Issue**: #${issue_number}
**Epic**: #${epic_id}
**Status**: Draft | Review | Approved
**Author**: ${author}
**Date**: ${date}

> **When to use Lite**: Stories 3 files, clear scope, no new services or data models. 
> **When to use Full**: New APIs, new database tables, cross-service changes, security-sensitive features. Use [SPEC-TEMPLATE.md](SPEC-TEMPLATE.md) instead.

> **Acceptance Criteria**: Defined in the PRD user stories - see [PRD-${epic_id}.md](../prd/PRD-${epic_id}.md#5-user-stories--features). Engineers should track AC completion against the originating Story issue.

---

## Overview

{2-3 sentences: what is being built and why.}

**Scope**: {In scope} | **Out of scope**: {Not covered}

---

## Approach

### Changes Required

| File/Component | Change | Reason |
|----------------|--------|--------|
| {file path} | {what changes} | {why} |
| {file path} | {what changes} | {why} |

### Key Decisions

- {Decision 1}: {Rationale}
- {Decision 2}: {Rationale}

---

## Testing Strategy

| Type | What to Test | Target |
|------|-------------|--------|
| Unit | {core logic} | 80% coverage |
| Integration | {API/DB interaction} | Happy + error paths |
| E2E | {user flow} | Critical path only |

---

## Rollout

- [ ] Feature flag: {flag name, if applicable}
- [ ] Migration: {needed / not needed}
- [ ] Rollback: {strategy}

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| {risk} | Low/Med/High | {plan} |
