---
name: "sql-server"
description: 'Develop SQL Server databases with T-SQL, stored procedures, indexing, and performance optimization. Use when writing T-SQL queries, creating stored procedures/functions, designing index strategies, optimizing query execution plans, or troubleshooting SQL Server performance.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2025-01-15"
 updated: "2025-01-15"
compatibility:
 languages: ["sql", "tsql"]
 platforms: ["windows", "linux"]
---

# SQL Server Database Development

> **Purpose**: Production-ready SQL Server development for enterprise applications. 
> **Audience**: Backend engineers and database administrators working with Microsoft SQL Server. 
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) SQL Server patterns.

---

## When to Use This Skill

- Writing T-SQL queries and stored procedures
- Designing SQL Server index strategies
- Optimizing query execution plans
- Using window functions and CTEs
- Troubleshooting SQL Server performance issues

## Decision Tree

```
SQL Server Decision
+-- Writing a data access query?
|   +-- Simple CRUD? -> Parameterized inline SQL or stored procedure
|   +-- Complex business logic? -> Stored procedure with TRY...CATCH
|   +-- Reporting / analytics? -> CTEs + window functions
+-- Performance problem?
|   +-- Slow query? -> Check execution plan for table scans
|   +-- Missing indexes? -> Add nonclustered indexes on filter/join columns
|   +-- Parameter sniffing? -> OPTION (RECOMPILE) or local variables
+-- Data modification?
|   +-- Upsert needed? -> MERGE statement
|   +-- Bulk insert? -> BULK INSERT or SqlBulkCopy
|   +-- Audit trail? -> Temporal tables (system-versioned)
+-- Concurrency issues?
|   +-- Deadlocks? -> Consistent table access order + short transactions
|   +-- Read consistency? -> SNAPSHOT isolation level
```

## Prerequisites

- SQL Server 2019+ or Azure SQL Database
- SSMS, Azure Data Studio, or DBeaver client

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **Stored procedure** | CREATE PROCEDURE | `CREATE PROCEDURE GetUser @UserId INT AS BEGIN ... END` |
| **Transaction** | BEGIN/COMMIT/ROLLBACK | `BEGIN TRANSACTION; ... COMMIT;` |
| **Error handling** | TRY...CATCH | `BEGIN TRY ... END TRY BEGIN CATCH ... END CATCH` |
| **Indexing** | CREATE INDEX | `CREATE NONCLUSTERED INDEX ON Users(Email)` |
| **Query optimization** | Execution plan | `SET STATISTICS IO ON; SET STATISTICS TIME ON;` |
| **Upsert** | MERGE statement | `MERGE INTO target USING source ON ...` |

---

## SQL Server Version

**Current**: SQL Server 2022 
**Minimum**: SQL Server 2019

---

## Core Rules

1. **Parameterize All Queries** - Always use parameters (`@param`) in queries; never concatenate user input into SQL strings
2. **Use TRY...CATCH** - Wrap all stored procedures and batch operations in `BEGIN TRY...END TRY BEGIN CATCH...END CATCH`
3. **Avoid SELECT Star** - Select only the columns you need; `SELECT *` wastes I/O and prevents covering index usage
4. **Index Filter Columns** - Add nonclustered indexes on columns used in WHERE, JOIN, and ORDER BY clauses
5. **Prefer Set-Based Operations** - Use JOINs, CTEs, and window functions instead of cursors or row-by-row processing
6. **Keep Transactions Short** - Minimize lock duration by committing as soon as possible; avoid user interaction inside transactions
7. **Use Explicit Transactions** - Wrap multi-statement modifications in `BEGIN TRANSACTION...COMMIT` with proper rollback handling
8. **Review Execution Plans** - Use `SET STATISTICS IO ON` and actual execution plans to diagnose performance before optimizing

---

## Anti-Patterns

| Issue | Problem | Solution |
|-------|---------|----------|
| **SELECT *** | Unnecessary data transfer | Select only needed columns |
| **Missing indexes** | Table scans | Add indexes on WHERE/JOIN columns |
| **Functions on columns** | Prevents index usage | Rewrite without functions |
| **Implicit conversions** | Performance hit | Match data types |
| **CURSOR usage** | Slow row-by-row processing | Use set-based operations |
| **No error handling** | Silent failures | Use TRY...CATCH blocks |

---

## Resources

- **SQL Server Docs**: [learn.microsoft.com/sql/sql-server](https://learn.microsoft.com/sql/sql-server/)
- **Execution Plan Reference**: [use-the-index-luke.com](https://use-the-index-luke.com)
- **SQL Server Management Studio (SSMS)**: Official GUI tool
- **Azure Data Studio**: Cross-platform database tool
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) - [AGENTS.md](../../../../AGENTS.md) - [Database Skill](../../architecture/database/SKILL.md)

**Last Updated**: January 27, 2026

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Query timeout | Check execution plan for table scans, add missing indexes, update statistics |
| Deadlock victim errors | Access tables in consistent order, keep transactions short, use NOLOCK for read-only queries |
| Stored procedure parameter sniffing | Use OPTION (RECOMPILE) or local variables for parameter values |

## References

- [Tsql Basics](references/tsql-basics.md)
- [Indexing Optimization Transactions](references/indexing-optimization-transactions.md)
- [Advanced Tsql](references/advanced-tsql.md)