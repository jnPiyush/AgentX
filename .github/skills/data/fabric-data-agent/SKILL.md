---
name: "fabric-data-agent"
description: 'Build, configure, and validate conversational data agents on Microsoft Fabric Lakehouses using the Data Agent SDK. Use when creating Fabric data agents, configuring few-shot examples, managing Livy sessions, or validating agent responses against Lakehouse data.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-07-13"
 updated: "2025-07-13"
compatibility:
 languages: ["python", "sql", "pyspark"]
 frameworks: ["microsoft-fabric", "fabric-data-agent-sdk"]
 platforms: ["windows", "linux", "macos"]
prerequisites:
 - "Microsoft Fabric workspace with active capacity"
 - "Fabric MCP Server (ms-fabric-mcp-server)"
 - "fabric-data-agent-sdk (pre-installed in Fabric environment)"
 - "Lakehouse with populated Delta tables"
---

# Fabric Data Agent

> Build conversational data agents that answer natural language questions against Fabric Lakehouses.

## When to Use

Use this skill when creating or validating a Fabric Data Agent over Lakehouse data for self-service analytics or natural-language SQL generation.

## Prerequisites

- Workspace, Lakehouse, and target business scope are known.
- Gold-layer tables and documented relationships are available.
- A validation query set exists or can be produced during planning.

## Decision Guide

Use a Data Agent when the goal is governed natural-language access to a curated analytical model, not arbitrary exploration of raw engineering tables. Keep Bronze and Silver out of the agent surface unless there is an explicit governed reason.

## Workflow

1. Plan against real schema, measures, and business questions.
2. Create the agent from curated tables and validated few-shot examples.
3. Validate responses against expected outputs before widening scope.
4. Preserve a checkpointed handoff between phases.

## Error Handling

If required inputs, scope, or SQL dialect confidence are missing, stop in the current phase and resolve them before progressing. Treat wrong-table scope, invalid few-shots, or unvalidated answers as blockers to publication.

## Checklist

Before handoff, confirm the current phase is complete, Gold-table scope is intentional, few-shot SQL is valid T-SQL, validation queries ran, and phase artifacts are reproducible.

<a id="decision-tree"></a>

<a id="workflow-overview"></a>

<a id="phase-1-plan"></a>

<a id="phase-2-create"></a>

<a id="phase-3-validate"></a>

<a id="core-concepts"></a>

<a id="data-agent-architecture"></a>

<a id="agent-configuration-components"></a>

<a id="table-selection-strategy"></a>

<a id="few-shot-example-best-practices"></a>

<a id="sql-syntax-fabric-sql-endpoint-t-sql"></a>

<a id="example-quality-checklist"></a>

<a id="livy-session-management"></a>

<a id="output-artifacts"></a>

## Core Rules

1. **One phase per conversation turn** - Execute Plan, Create, or Validate in a single turn; never combine phases to prevent context rot.
2. **Gold tables only** - Configure agents with Gold-layer fact and dimension tables; never expose Bronze or Silver tables to the agent.
3. **T-SQL syntax in few-shots** - Use `SELECT TOP N`, `DATEPART`, `ISNULL` in examples; never use Spark SQL syntax like `LIMIT` or `DATE_FORMAT`.
4. **Validate SQL before adding** - Test every few-shot example query against the SQL endpoint before adding it to agent configuration.
5. **Checkpoint between phases** - Present summary and get explicit user approval before moving from Plan to Create to Validate.
6. **Reuse Livy sessions** - Check for existing idle sessions before creating new ones; session cold start is 3-6+ minutes.
7. **Timestamped output folders** - Save all artifacts to `run/{timestamp}_{lakehouse}/`; never overwrite previous runs.
8. **Top-10 coverage** - Few-shot examples MUST cover the 10 most common business questions for the target domain.
9. **Focused instructions** - Keep agent system prompts concise and domain-specific; long unfocused prompts cause agent confusion.
10. **Reproducible notebooks** - Generate notebooks for all SDK operations so agents can be recreated without manual steps.

<a id="anti-patterns"></a>

## Boundaries

### Always Do

- Gather workspace and lakehouse inputs before starting
- Discover and verify schema before creating agent
- Validate all few-shot SQL against the SQL endpoint
- Get user approval at checkpoint between phases
- Generate reproducible notebooks for all SDK operations
- Use timestamped output folders (never overwrite)
- Document decisions in completion report

### Ask First

- Creating new Data Agents (confirm name and scope)
- Running expensive queries on large tables
- Modifying existing agent configurations
- Any operation that affects production data

### Never Do

- Proceed without required inputs (workspace, lakehouse)
- Execute modifications without user approval
- Delete Data Agents without confirmation
- Hardcode credentials or connection strings
- Assume table relationships without verification
- Include unvalidated SQL in few-shot examples
- Close Livy sessions that were already open

<a id="reference-index"></a>

<a id="asset-templates"></a>

## References

MUST read the applicable topic reference before design, implementation or validation; root rules do not replace its detailed contract.

- [Workflow phases and agent configuration](references/details-workflow-and-configuration.md) - must read before implementation.
- [Validation, artifacts, and operations](references/details-validation-artifacts-and-operations.md) - must read during validation.
- [agent sdk patterns](references/agent-sdk-patterns.md)
- [instruction templates](references/instruction-templates.md)
