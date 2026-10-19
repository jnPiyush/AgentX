---
name: oracle-schema-design
description: Oracle tablespace, partitioning, indexing, and PL/SQL package schema design patterns.
---

# Oracle Schema Design

1. Separate transactional and archival tablespaces and prefer range-interval partitioning for time-series tables.
2. Encapsulate data-manipulation logic inside versioned PL/SQL package specifications (`.pks`) and bodies (`.pkb`).
3. Define explicit foreign-key indexes to prevent table-level locks during parent modifications.
