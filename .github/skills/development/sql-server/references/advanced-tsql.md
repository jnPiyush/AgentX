# Advanced T-SQL: Window Functions, CTEs, MERGE & Diagnostics

## Window Functions

```sql
-- [PASS] GOOD: Row numbering
SELECT 
 Name,
 Category,
 Price,
 ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Price DESC) AS RowNum
FROM Products;

-- [PASS] GOOD: Ranking
SELECT 
 Name,
 Score,
 RANK() OVER (ORDER BY Score DESC) AS Rank,
 DENSE_RANK() OVER (ORDER BY Score DESC) AS DenseRank,
 NTILE(4) OVER (ORDER BY Score DESC) AS Quartile
FROM Students;

-- [PASS] GOOD: Running totals
SELECT 
 OrderDate,
 Amount,
 SUM(Amount) OVER (ORDER BY OrderDate) AS RunningTotal
FROM Orders;

-- [PASS] GOOD: Moving average
SELECT 
 Date,
 Value,
 AVG(Value) OVER (
 ORDER BY Date
 ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
 ) AS MovingAvg7Day
FROM Metrics;

-- [PASS] GOOD: Lag and Lead
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
-- [PASS] GOOD: Recursive CTE
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

-- [PASS] GOOD: Multiple CTEs
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
-- [PASS] GOOD: MERGE for upsert operations
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

-- [PASS] GOOD: MERGE with DELETE
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
-- [PASS] GOOD: OFFSET-FETCH (SQL Server 2012+)
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

-- [PASS] GOOD: Keyset pagination (better for large datasets)
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
-- [PASS] GOOD: Temp table (better for large datasets, can have indexes)
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

-- [PASS] GOOD: Table variable (better for small datasets < 100 rows)
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
-- [PASS] GOOD: Find expensive queries
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
