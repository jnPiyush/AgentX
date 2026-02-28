# SQL Server Indexing, Query Optimization & Transactions

## Indexing Strategies

### Index Types

```sql
-- [PASS] GOOD: Clustered index (one per table, defines physical order)
CREATE CLUSTERED INDEX IX_Orders_OrderDate 
ON Orders(OrderDate);

-- [PASS] GOOD: Non-clustered index (up to 999 per table)
CREATE NONCLUSTERED INDEX IX_Users_Email 
ON Users(Email);

-- [PASS] GOOD: Covering index (includes additional columns)
CREATE NONCLUSTERED INDEX IX_Orders_UserId_Covering
ON Orders(UserId)
INCLUDE (OrderDate, TotalAmount);

-- [PASS] GOOD: Filtered index (smaller, faster for specific queries)
CREATE NONCLUSTERED INDEX IX_Users_Active_Email
ON Users(Email)
WHERE IsActive = 1;

-- [PASS] GOOD: Unique index
CREATE UNIQUE NONCLUSTERED INDEX IX_Users_Email_Unique
ON Users(Email);

-- [PASS] GOOD: Composite index (order matters!)
CREATE NONCLUSTERED INDEX IX_Orders_UserId_OrderDate
ON Orders(UserId, OrderDate DESC);
```

### Index Maintenance

```sql
-- Check index fragmentation
SELECT 
 OBJECT_NAME(ips.object_id) AS TableName,
 i.name AS IndexName,
 ips.avg_fragmentation_in_percent,
 ips.page_count
FROM sys.dm_db_index_physical_stats(
 DB_ID(), NULL, NULL, NULL, 'LIMITED'
) ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id 
 AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
 AND ips.page_count > 1000;

-- Rebuild index
ALTER INDEX IX_Orders_UserId ON Orders REBUILD;

-- Reorganize index (less resource intensive)
ALTER INDEX IX_Orders_UserId ON Orders REORGANIZE;

-- Update statistics
UPDATE STATISTICS Orders;
```

---

## Query Optimization

### Execution Plans

```sql
-- [PASS] GOOD: Analyze execution plan
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT 
 u.Name,
 COUNT(o.Id) AS OrderCount
FROM Users u
LEFT JOIN Orders o ON u.Id = o.UserId
WHERE u.IsActive = 1
GROUP BY u.Name;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;

-- Use execution plan (Ctrl+L in SSMS)
-- Look for:
-- - Index seeks vs scans
-- - Missing index suggestions
-- - Expensive operators
```

### Common Optimization Patterns

```sql
-- [PASS] GOOD: Use EXISTS instead of IN for large datasets
SELECT * FROM Users u
WHERE EXISTS (
 SELECT 1 FROM Orders o 
 WHERE o.UserId = u.Id
);

-- [FAIL] BAD: IN with subquery (slower for large datasets)
SELECT * FROM Users
WHERE Id IN (SELECT UserId FROM Orders);

-- [PASS] GOOD: Avoid functions on indexed columns
SELECT * FROM Users
WHERE CreatedAt >= '2024-01-01'
 AND CreatedAt < '2024-02-01';

-- [FAIL] BAD: Function prevents index usage
SELECT * FROM Users
WHERE YEAR(CreatedAt) = 2024 AND MONTH(CreatedAt) = 1;

-- [PASS] GOOD: Parameterized query (plan reuse)
DECLARE @Status NVARCHAR(20) = 'Active';
SELECT * FROM Users WHERE Status = @Status;

-- [PASS] GOOD: Use NOLOCK for read-only queries (dirty reads OK)
SELECT * FROM Users WITH (NOLOCK)
WHERE IsActive = 1;
```

---

## Transactions and Locking

```sql
-- [PASS] GOOD: Explicit transaction with error handling
BEGIN TRANSACTION;

BEGIN TRY
 UPDATE Accounts
 SET Balance = Balance - 100
 WHERE Id = 1;
 
 UPDATE Accounts
 SET Balance = Balance + 100
 WHERE Id = 2;
 
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 ROLLBACK TRANSACTION;
 THROW;
END CATCH;

-- [PASS] GOOD: Locking hints
-- UPDLOCK: Acquire update lock to prevent deadlocks
SELECT * FROM Accounts WITH (UPDLOCK, HOLDLOCK)
WHERE Id = 123;

-- ROWLOCK: Lock at row level instead of page/table
UPDATE Users WITH (ROWLOCK)
SET LastLogin = SYSDATETIME()
WHERE Id = 123;

-- [PASS] GOOD: Isolation levels
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- READ UNCOMMITTED (dirty reads)
-- READ COMMITTED (default)
-- REPEATABLE READ (no phantom reads within transaction)
-- SERIALIZABLE (full isolation)
-- SNAPSHOT (row versioning, no locks)
```

---
