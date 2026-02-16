# T-SQL Basics, Stored Procedures & Functions

## T-SQL Basics

### Variables and Data Types

```sql
-- [PASS] GOOD: Variable declaration
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

-- [PASS] GOOD: Common data types
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
-- [PASS] GOOD: Stored procedure with parameters
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

-- [PASS] GOOD: Procedure with output parameters
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
-- [PASS] GOOD: Comprehensive error handling
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
-- [PASS] GOOD: Scalar function
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
-- [PASS] GOOD: Inline table-valued function (fast)
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

-- [PASS] GOOD: Multi-statement table-valued function
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
