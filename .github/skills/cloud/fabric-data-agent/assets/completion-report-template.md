# Data Agent Completion Report

> Cross-phase handover document. Updated at the end of each phase.

---

## Agent Details

| Field | Value |
|-------|-------|
| **Agent Name** | {agent_name} |
| **Workspace** | {workspace_name} |
| **Lakehouse** | {lakehouse_name} |
| **Created** | {date} |
| **Author** | {author} |

---

## Phase 1: Plan

**Status**: Not Started / In Progress / Complete

### Schema Discovery

| Table | Row Count | Columns | Layer |
|-------|-----------|---------|-------|
| | | | |

### Relationships

| From Table | From Column | To Table | To Column | Type |
|------------|-------------|----------|-----------|------|
| | | | | |

### Baseline Metrics

| Metric | Query | Expected Value |
|--------|-------|----------------|
| | | |

### Plan Decisions

- [ ] Tables selected for agent scope
- [ ] Relationships mapped
- [ ] Baseline metrics calculated
- [ ] Implementation plan approved by user

---

## Phase 2: Create

**Status**: Not Started / In Progress / Complete

### Agent Configuration

| Setting | Value |
|---------|-------|
| Instructions | {summary} |
| Datasources | {lakehouse}: {table_count} tables |
| Few-shot examples | {example_count} queries |
| Published | Yes / No |

### Few-Shot Examples Added

| # | Question | Validated |
|---|----------|-----------|
| 1 | | |
| 2 | | |

### Creation Decisions

- [ ] Agent created successfully
- [ ] Instructions configured
- [ ] Tables bound
- [ ] Few-shot examples validated
- [ ] Agent published

---

## Phase 3: Validate

**Status**: Not Started / In Progress / Complete

### Test Results

| # | Question | Expected | Actual | Pass/Fail |
|---|----------|----------|--------|-----------|
| 1 | | | | |

### Accuracy Summary

| Metric | Value |
|--------|-------|
| Total tests | |
| Passed | |
| Failed | |
| Errors | |
| **Accuracy %** | |

### Validation Decisions

- [ ] Accuracy meets threshold (80%)
- [ ] Edge cases tested
- [ ] Validation report generated
- [ ] Agent ready for production use

---

## Checkpoint Log

| CP | Phase | Decision Needed | User Response |
|----|-------|----------------|---------------|
| | | | |

---

## Artifacts

| File | Status |
|------|--------|
| `implementation_plan.md` | Generated |
| `agent_creation.ipynb` | Generated |
| `agent_validation.ipynb` | Generated |
| `validation_report.md` | Generated |
