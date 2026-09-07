# Fabric Data Agent Details

This required-read reference preserves complete baseline sections relocated from `SKILL.md` during budget remediation.

## When to Use

- Creating a natural language query interface over Lakehouse data
- Building self-service analytics agents for business users
- Configuring a Data Agent with table selection, joins, and measures
- Validating agent accuracy against known metrics
- Generating reproducible notebooks for agent provisioning

## Decision Tree

```
Building a Fabric Data Agent?
+- First time with this Lakehouse?
| - Start at Phase 1 (Plan) - discover schema and relationships
+- Have an implementation plan already?
| - Start at Phase 2 (Create) - build and publish the agent
+- Agent exists but needs validation?
| - Start at Phase 3 (Validate) - test against expected metrics
+- Need to modify an existing agent?
| +- Schema changes -> Re-run Phase 1 (new plan)
| - Config tweaks -> Phase 2 only (update agent)
- Not sure if Data Agent is right tool?
 +- Users need ad-hoc SQL -> Use Warehouse + SQL endpoint instead
 +- Users need dashboards -> Use Semantic Model + Power BI
 - Users need chat-based Q&A -> Data Agent [PASS]
```

## Workflow Overview

Data Agent development follows a **3-phase workflow** with checkpoint stops between phases:

```
Phase 1: Plan --checkpoint---> Phase 2: Create --checkpoint---> Phase 3: Validate
```

**Critical Rule**: Execute ONE phase per conversation turn to prevent context rot. Use the completion report as a handover document between phases.

### Phase 1: Plan

**Goal**: Analyze the Lakehouse to produce a comprehensive implementation plan.

| Step | Action | Output |
|------|--------|--------|
| 1 | Gather inputs (workspace, lakehouse name, scope) | User requirements |
| 2 | Discover tables and row counts via SQL endpoint | Table inventory |
| 3 | Identify primary/foreign keys and relationships | Relationship map |
| 4 | Calculate baseline metrics for validation | Expected values |
| 5 | Generate implementation plan document | `implementation_plan.md` |

**Checkpoint**: Present plan summary, get user approval before proceeding.

### Phase 2: Create

**Goal**: Execute the plan to create and publish a configured Data Agent.

| Step | Action | Output |
|------|--------|--------|
| 1 | Initialize the Data Agent Management Client | SDK connection |
| 2 | Create agent with name and description | Agent instance |
| 3 | Configure instructions (system prompt for the agent) | Agent knowledge |
| 4 | Add Lakehouse datasources and select tables | Data bindings |
| 5 | Add few-shot examples for common queries | Query templates |
| 6 | Publish the agent | Live agent |
| 7 | Generate reproducible notebook | `agent_creation.ipynb` |

**Checkpoint**: Confirm agent is published and accessible before validation.

### Phase 3: Validate

**Goal**: Verify agent accuracy against the metrics from Phase 1.

| Step | Action | Output |
|------|--------|--------|
| 1 | Initialize the Query Client | SDK connection |
| 2 | Execute test queries from the plan | Query responses |
| 3 | Compare actual vs expected values | Accuracy metrics |
| 4 | Generate validation report | `validation_report.md` |
| 5 | Generate reproducible notebook | `agent_validation.ipynb` |

**Checkpoint**: Present accuracy results and recommendations.

## Core Concepts

### Data Agent Architecture

```
User Question (natural language)
 (down)
Data Agent (instructions + knowledge)
 (down)
SQL Generation (against Lakehouse SQL endpoint)
 (down) 
Query Execution
 (down)
Natural Language Answer
```

### Agent Configuration Components

| Component | Purpose | Example |
|-----------|---------|---------|
| **Instructions** | System prompt guiding agent behavior | "You are a sales analytics assistant..." |
| **Datasources** | Lakehouse bindings with table selection | Bronze_LH: [fact_sales, dim_product, ...] |
| **Few-shot examples** | Query-answer pairs for accuracy | Q: "Total sales?" -> SQL: `SELECT SUM(amount)...` |
| **Knowledge** | Additional context documents | Business rules, glossary, KPIs |

### Table Selection Strategy

| Include | Exclude |
|---------|---------|
| Gold-layer fact and dimension tables | Bronze/Silver raw tables |
| Tables with clear business meaning | System/metadata tables |
| Tables with documented relationships | Temp/staging tables |
| Tables referenced in business KPIs | Large log/event tables |

## Few-Shot Example Best Practices

Few-shot examples teach the agent how to generate correct SQL:

### SQL Syntax (Fabric SQL Endpoint = T-SQL)

| Correct (T-SQL) | Incorrect (Spark SQL) |
|-----------------|----------------------|
| `SELECT TOP 10` | `LIMIT 10` |
| `DATEPART(QUARTER, date)` | `QUARTER(date)` |
| `FORMAT(date, 'yyyy-MM')` | `DATE_FORMAT(date, '%Y-%m')` |
| `CONVERT(DATE, value)` | `CAST(value AS DATE)` |
| `ISNULL(col, default)` | `COALESCE(col, default)` |

### Example Quality Checklist

- [ ] Covers the top 10 most common business questions
- [ ] Uses correct T-SQL syntax (not Spark SQL)
- [ ] Includes aggregations (SUM, COUNT, AVG)
- [ ] Includes time-based filters (YTD, MTD, date ranges)
- [ ] Includes joins across fact and dimension tables
- [ ] All examples validated against SQL endpoint before adding
- [ ] Covers edge cases (nulls, empty results, large numbers)
