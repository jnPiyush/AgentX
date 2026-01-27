---
description: 'SQL Server database development with T-SQL, stored procedures, indexing, and performance optimization'
---

# SQL Server Database Development

> **Purpose**: Production-ready SQL Server development for enterprise applications.  
> **Audience**: Backend engineers and database administrators working with Microsoft SQL Server.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) SQL Server patterns.

---

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

## T-SQL Basics

### Variables and Data Types

```sql
-- ✅ GOOD: Variable declaration
DECLARE @UserId INT = 123;
DECLARE @UserName NVARCHAR(100);
DECLARE @CreatedDate DATETIME = GETDATE();
DECLARE @IsActive BIT = 1;

-- Table variable
DECLARE @UserTable TABLE (
    Id INT,
    Name NVARCHAR(100),
    Email NVARCHAR(255)
);

-- Insert into table variable
INSERT INTO @UserTable (Id, Name, Email)
SELECT Id, Name, Email FROM Users WHERE IsActive = 1;

-- ✅ GOOD: Common data types
-- Use NVARCHAR instead of VARCHAR for Unicode
DECLARE @Name NVARCHAR(100);

-- Use DATETIME2 instead of DATETIME for better precision
DECLARE @CreatedAt DATETIME2 = SYSDATETIME();

-- Use DECIMAL for money (not FLOAT)
DECLARE @Price DECIMAL(10, 2) = 99.99;
```

---

## Stored Procedures

### Basic Stored Procedures

```sql
-- ✅ GOOD: Stored procedure with parameters
CREATE PROCEDURE GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        Id,
        Name,
        Email,
        CreatedAt
    FROM Users
    WHERE Id = @UserId;
END;
GO

-- Execute
EXEC GetUserById @UserId = 123;

-- ✅ GOOD: Procedure with output parameters
CREATE PROCEDURE CreateUser
    @Name NVARCHAR(100),
    @Email NVARCHAR(255),
    @UserId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO Users (Name, Email, CreatedAt)
    VALUES (@Name, @Email, SYSDATETIME());
    
    SET @UserId = SCOPE_IDENTITY();
END;
GO

-- Execute with output
DECLARE @NewUserId INT;
EXEC CreateUser 
    @Name = 'John Doe',
    @Email = 'john@example.com',
    @UserId = @NewUserId OUTPUT;
SELECT @NewUserId AS NewUserId;
```

### Error Handling in Procedures

```sql
-- ✅ GOOD: Comprehensive error handling
CREATE PROCEDURE TransferFunds
    @FromAccountId INT,
    @ToAccountId INT,
    @Amount DECIMAL(10, 2)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Check sufficient balance
        DECLARE @Balance DECIMAL(10, 2);
        SELECT @Balance = Balance 
        FROM Accounts WITH (UPDLOCK, HOLDLOCK)
        WHERE Id = @FromAccountId;
        
        IF @Balance < @Amount
        BEGIN
            THROW 50001, 'Insufficient funds', 1;
        END;
        
        -- Debit from account
        UPDATE Accounts
        SET Balance = Balance - @Amount
        WHERE Id = @FromAccountId;
        
        -- Credit to account
        UPDATE Accounts
        SET Balance = Balance + @Amount
        WHERE Id = @ToAccountId;
        
        COMMIT TRANSACTION;
        
        SELECT 1 AS Success;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        -- Log error
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        
        -- Re-throw error
        THROW;
    END CATCH;
END;
GO
```

---

## Functions

### Scalar Functions

```sql
-- ✅ GOOD: Scalar function
CREATE FUNCTION dbo.CalculateDiscount
(
    @Price DECIMAL(10, 2),
    @DiscountPercent DECIMAL(5, 2)
)
RETURNS DECIMAL(10, 2)
AS
BEGIN
    RETURN @Price * (1 - @DiscountPercent / 100);
END;
GO

-- Usage
SELECT 
    ProductName,
    Price,
    dbo.CalculateDiscount(Price, 10) AS DiscountedPrice
FROM Products;
```

### Table-Valued Functions

```sql
-- ✅ GOOD: Inline table-valued function (fast)
CREATE FUNCTION dbo.GetUserOrders (@UserId INT)
RETURNS TABLE
AS
RETURN
(
    SELECT 
        o.Id,
        o.OrderDate,
        o.TotalAmount
    FROM Orders o
    WHERE o.UserId = @UserId
);
GO

-- Usage
SELECT * FROM dbo.GetUserOrders(123);

-- ✅ GOOD: Multi-statement table-valued function
CREATE FUNCTION dbo.GetOrderSummary (@UserId INT)
RETURNS @OrderSummary TABLE
(
    OrderId INT,
    OrderDate DATETIME2,
    ItemCount INT,
    TotalAmount DECIMAL(10, 2)
)
AS
BEGIN
    INSERT INTO @OrderSummary
    SELECT 
        o.Id,
        o.OrderDate,
        COUNT(oi.Id),
        SUM(oi.Quantity * oi.Price)
    FROM Orders o
    INNER JOIN OrderItems oi ON o.Id = oi.OrderId
    WHERE o.UserId = @UserId
    GROUP BY o.Id, o.OrderDate;
    
    RETURN;
END;
GO
```

---

## Indexing Strategies

### Index Types

```sql
-- ✅ GOOD: Clustered index (one per table, defines physical order)
CREATE CLUSTERED INDEX IX_Orders_OrderDate 
ON Orders(OrderDate);

-- ✅ GOOD: Non-clustered index (up to 999 per table)
CREATE NONCLUSTERED INDEX IX_Users_Email 
ON Users(Email);

-- ✅ GOOD: Covering index (includes additional columns)
CREATE NONCLUSTERED INDEX IX_Orders_UserId_Covering
ON Orders(UserId)
INCLUDE (OrderDate, TotalAmount);

-- ✅ GOOD: Filtered index (smaller, faster for specific queries)
CREATE NONCLUSTERED INDEX IX_Users_Active_Email
ON Users(Email)
WHERE IsActive = 1;

-- ✅ GOOD: Unique index
CREATE UNIQUE NONCLUSTERED INDEX IX_Users_Email_Unique
ON Users(Email);

-- ✅ GOOD: Composite index (order matters!)
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
-- ✅ GOOD: Analyze execution plan
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
-- ✅ GOOD: Use EXISTS instead of IN for large datasets
SELECT * FROM Users u
WHERE EXISTS (
    SELECT 1 FROM Orders o 
    WHERE o.UserId = u.Id
);

-- ❌ BAD: IN with subquery (slower for large datasets)
SELECT * FROM Users
WHERE Id IN (SELECT UserId FROM Orders);

-- ✅ GOOD: Avoid functions on indexed columns
SELECT * FROM Users
WHERE CreatedAt >= '2024-01-01'
    AND CreatedAt < '2024-02-01';

-- ❌ BAD: Function prevents index usage
SELECT * FROM Users
WHERE YEAR(CreatedAt) = 2024 AND MONTH(CreatedAt) = 1;

-- ✅ GOOD: Parameterized query (plan reuse)
DECLARE @Status NVARCHAR(20) = 'Active';
SELECT * FROM Users WHERE Status = @Status;

-- ✅ GOOD: Use NOLOCK for read-only queries (dirty reads OK)
SELECT * FROM Users WITH (NOLOCK)
WHERE IsActive = 1;
```

---

## Transactions and Locking

```sql
-- ✅ GOOD: Explicit transaction with error handling
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

-- ✅ GOOD: Locking hints
-- UPDLOCK: Acquire update lock to prevent deadlocks
SELECT * FROM Accounts WITH (UPDLOCK, HOLDLOCK)
WHERE Id = 123;

-- ROWLOCK: Lock at row level instead of page/table
UPDATE Users WITH (ROWLOCK)
SET LastLogin = SYSDATETIME()
WHERE Id = 123;

-- ✅ GOOD: Isolation levels
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- READ UNCOMMITTED (dirty reads)
-- READ COMMITTED (default)
-- REPEATABLE READ (no phantom reads within transaction)
-- SERIALIZABLE (full isolation)
-- SNAPSHOT (row versioning, no locks)
```

---

## Window Functions

```sql
-- ✅ GOOD: Row numbering
SELECT 
    Name,
    Category,
    Price,
    ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Price DESC) AS RowNum
FROM Products;

-- ✅ GOOD: Ranking
SELECT 
    Name,
    Score,
    RANK() OVER (ORDER BY Score DESC) AS Rank,
    DENSE_RANK() OVER (ORDER BY Score DESC) AS DenseRank,
    NTILE(4) OVER (ORDER BY Score DESC) AS Quartile
FROM Students;

-- ✅ GOOD: Running totals
SELECT 
    OrderDate,
    Amount,
    SUM(Amount) OVER (ORDER BY OrderDate) AS RunningTotal
FROM Orders;

-- ✅ GOOD: Moving average
SELECT 
    Date,
    Value,
    AVG(Value) OVER (
        ORDER BY Date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS MovingAvg7Day
FROM Metrics;

-- ✅ GOOD: Lag and Lead
SELECT 
    Date,
    Price,
    LAG(Price, 1) OVER (ORDER BY Date) AS PreviousPrice,
    LEAD(Price, 1) OVER (ORDER BY Date) AS NextPrice,
    Price - LAG(Price, 1) OVER (ORDER BY Date) AS PriceChange
FROM StockPrices;
```

---

## Common Table Expressions (CTEs)

```sql
-- ✅ GOOD: Recursive CTE
WITH CategoryHierarchy AS (
    -- Anchor: Root categories
    SELECT 
        Id,
        Name,
        ParentId,
        1 AS Level,
        CAST(Name AS NVARCHAR(MAX)) AS Path
    FROM Categories
    WHERE ParentId IS NULL
    
    UNION ALL
    
    -- Recursive: Child categories
    SELECT 
        c.Id,
        c.Name,
        c.ParentId,
        ch.Level + 1,
        CAST(ch.Path + ' > ' + c.Name AS NVARCHAR(MAX))
    FROM Categories c
    INNER JOIN CategoryHierarchy ch ON c.ParentId = ch.Id
)
SELECT * FROM CategoryHierarchy
ORDER BY Path;

-- ✅ GOOD: Multiple CTEs
WITH ActiveUsers AS (
    SELECT Id, Name FROM Users WHERE IsActive = 1
),
RecentOrders AS (
    SELECT 
        UserId,
        COUNT(*) AS OrderCount,
        SUM(TotalAmount) AS TotalSpent
    FROM Orders
    WHERE OrderDate >= DATEADD(DAY, -30, SYSDATETIME())
    GROUP BY UserId
)
SELECT 
    u.Name,
    ISNULL(ro.OrderCount, 0) AS RecentOrders,
    ISNULL(ro.TotalSpent, 0) AS TotalSpent
FROM ActiveUsers u
LEFT JOIN RecentOrders ro ON u.Id = ro.UserId
ORDER BY TotalSpent DESC;
```

---

## MERGE Statement (Upsert)

```sql
-- ✅ GOOD: MERGE for upsert operations
MERGE INTO Users AS target
USING (
    SELECT 'john@example.com' AS Email, 'John Doe' AS Name
) AS source
ON target.Email = source.Email
WHEN MATCHED THEN
    UPDATE SET 
        Name = source.Name,
        UpdatedAt = SYSDATETIME()
WHEN NOT MATCHED THEN
    INSERT (Email, Name, CreatedAt)
    VALUES (source.Email, source.Name, SYSDATETIME());

-- ✅ GOOD: MERGE with DELETE
MERGE INTO Inventory AS target
USING StagingInventory AS source
ON target.ProductId = source.ProductId
WHEN MATCHED AND source.Quantity > 0 THEN
    UPDATE SET Quantity = source.Quantity
WHEN MATCHED AND source.Quantity = 0 THEN
    DELETE
WHEN NOT MATCHED THEN
    INSERT (ProductId, Quantity)
    VALUES (source.ProductId, source.Quantity);
```

---

## Pagination

```sql
-- ✅ GOOD: OFFSET-FETCH (SQL Server 2012+)
DECLARE @PageNumber INT = 2;
DECLARE @PageSize INT = 20;

SELECT 
    Id,
    Name,
    Email
FROM Users
ORDER BY Id
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;

-- ✅ GOOD: Keyset pagination (better for large datasets)
DECLARE @LastSeenId INT = 1000;
DECLARE @PageSize INT = 20;

SELECT TOP (@PageSize)
    Id,
    Name,
    Email
FROM Users
WHERE Id > @LastSeenId
ORDER BY Id;
```

---

## Temp Tables vs Table Variables

```sql
-- ✅ GOOD: Temp table (better for large datasets, can have indexes)
CREATE TABLE #TempOrders (
    OrderId INT,
    OrderDate DATETIME2,
    TotalAmount DECIMAL(10, 2)
);

CREATE INDEX IX_TempOrders_OrderDate ON #TempOrders(OrderDate);

INSERT INTO #TempOrders
SELECT Id, OrderDate, TotalAmount
FROM Orders
WHERE OrderDate >= DATEADD(DAY, -30, SYSDATETIME());

-- Use temp table
SELECT * FROM #TempOrders;

-- Cleanup (automatic when session ends)
DROP TABLE #TempOrders;

-- ✅ GOOD: Table variable (better for small datasets < 100 rows)
DECLARE @OrderSummary TABLE (
    UserId INT,
    OrderCount INT,
    TotalSpent DECIMAL(10, 2)
);

INSERT INTO @OrderSummary
SELECT 
    UserId,
    COUNT(*),
    SUM(TotalAmount)
FROM Orders
GROUP BY UserId;

SELECT * FROM @OrderSummary;
```

---

## Monitoring and Diagnostics

```sql
-- ✅ GOOD: Find expensive queries
SELECT TOP 10
    qs.total_elapsed_time / qs.execution_count AS avg_elapsed_time,
    qs.execution_count,
    SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
        ((CASE qs.statement_end_offset
            WHEN -1 THEN DATALENGTH(qt.text)
            ELSE qs.statement_end_offset
        END - qs.statement_start_offset)/2)+1) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY avg_elapsed_time DESC;

-- Check for blocking queries
SELECT 
    session_id,
    blocking_session_id,
    wait_type,
    wait_time,
    wait_resource
FROM sys.dm_exec_requests
WHERE blocking_session_id <> 0;

-- Database size and usage
EXEC sp_spaceused;

-- Index usage statistics
SELECT 
    OBJECT_NAME(s.object_id) AS TableName,
    i.name AS IndexName,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates
FROM sys.dm_db_index_usage_stats s
INNER JOIN sys.indexes i ON s.object_id = i.object_id 
    AND s.index_id = i.index_id
WHERE database_id = DB_ID()
ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC;
```

---

## Common Pitfalls

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

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md) • [Database Skill](.github/skills/architecture/database/SKILL.md)

**Last Updated**: January 27, 2026
