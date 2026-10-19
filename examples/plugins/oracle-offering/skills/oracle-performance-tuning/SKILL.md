---
name: oracle-performance-tuning
description: Oracle AWR analysis, execution plan tuning, bind variables, and bulk collect optimization.
---

# Oracle Performance Tuning

1. Replace row-by-row cursor loops with `BULK COLLECT` and `FORALL` with bounded `LIMIT` clauses.
2. Require bind variables in dynamic SQL to eliminate hard-parse contention.
3. Inspect execution plans with `DBMS_XPLAN.DISPLAY_CURSOR` before adding optimizer hints.
