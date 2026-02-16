---
description: 'SQL development instructions for PostgreSQL and SQL Server database work.'
applyTo: "**/*.sql,**/migrations/**,**/Migrations/**"
---

# SQL Development Instructions

Instructions for PostgreSQL and SQL Server database development.

## Query Best Practices

### Parameterized Queries (CRITICAL)
```sql
-- NEVER do this (SQL injection vulnerability)
-- SELECT * FROM users WHERE id = ' + userId + '

-- ALWAYS use parameters
-- PostgreSQL
SELECT * FROM users WHERE id = $1;

-- SQL Server
SELECT * FROM users WHERE id = @UserId;
```

### Efficient Joins
```sql
-- Prefer explicit JOIN syntax over implicit
-- Good
SELECT u.name, o.order_date
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed';

-- Avoid: implicit joins
SELECT u.name, o.order_date
FROM users u, orders o
WHERE u.id = o.user_id AND o.status = 'completed';
```

### Indexing Strategy
```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- Composite index for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- PostgreSQL partial index
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';

-- SQL Server filtered index
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';
```

## PostgreSQL Specific

### JSONB Operations
```sql
-- Store JSON data
CREATE TABLE products (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 attributes JSONB DEFAULT '{}'::jsonb
);

-- Query JSONB
SELECT * FROM products
WHERE attributes->>'color' = 'red';

-- Index JSONB
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);
```

### Array Operations
```sql
-- Array column
CREATE TABLE articles (
 id SERIAL PRIMARY KEY,
 title TEXT NOT NULL,
 tags TEXT[] DEFAULT '{}'
);

-- Query arrays
SELECT * FROM articles WHERE 'sql' = ANY(tags);

-- Array aggregation
SELECT array_agg(name) FROM users WHERE active = true;
```

### Full-Text Search
```sql
-- Create search vector
ALTER TABLE articles ADD COLUMN search_vector tsvector;

CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);

-- Update search vector
UPDATE articles SET search_vector =
 setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
 setweight(to_tsvector('english', coalesce(body, '')), 'B');

-- Search
SELECT * FROM articles
WHERE search_vector @@ plainto_tsquery('english', 'search terms');
```

## SQL Server Specific

### Common Table Expressions (CTE)
```sql
WITH OrderTotals AS (
 SELECT user_id, SUM(amount) as total
 FROM orders
 GROUP BY user_id
)
SELECT u.name, ot.total
FROM users u
JOIN OrderTotals ot ON u.id = ot.user_id
WHERE ot.total > 1000;
```

### Window Functions
```sql
SELECT
 name,
 department,
 salary,
 ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank,
 AVG(salary) OVER (PARTITION BY department) as dept_avg
FROM employees;
```

### Temporal Tables
```sql
CREATE TABLE employees (
 id INT PRIMARY KEY,
 name NVARCHAR(100),
 salary DECIMAL(10,2),
 ValidFrom DATETIME2 GENERATED ALWAYS AS ROW START,
 ValidTo DATETIME2 GENERATED ALWAYS AS ROW END,
 PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo)
) WITH (SYSTEM_VERSIONING = ON);

-- Query historical data
SELECT * FROM employees
FOR SYSTEM_TIME AS OF '2024-01-01';
```

## Transactions

### PostgreSQL
```sql
BEGIN;

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- Check constraint
SELECT balance FROM accounts WHERE id = 1;
-- If balance < 0, rollback

COMMIT;
-- or ROLLBACK;
```

### SQL Server
```sql
BEGIN TRANSACTION;

BEGIN TRY
 UPDATE accounts SET balance = balance - 100 WHERE id = 1;
 UPDATE accounts SET balance = balance + 100 WHERE id = 2;

 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 ROLLBACK TRANSACTION;
 THROW;
END CATCH
```

## Migrations

### Naming Convention
```
YYYYMMDDHHMMSS_descriptive_name.sql
20240205120000_add_users_table.sql
20240205130000_add_email_index_to_users.sql
```

### Migration Template
```sql
-- Migration: Add orders table
-- Created: 2024-02-05

-- UP
CREATE TABLE orders (
 id SERIAL PRIMARY KEY, -- PostgreSQL
 -- id INT IDENTITY(1,1) PRIMARY KEY, -- SQL Server
 user_id INT NOT NULL REFERENCES users(id),
 total DECIMAL(10,2) NOT NULL,
 status VARCHAR(50) DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);

-- DOWN (rollback)
DROP TABLE IF EXISTS orders;
```

## Performance Optimization

### Query Analysis
```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- SQL Server
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
SELECT * FROM users WHERE email = 'test@example.com';
```

### Avoid N+1 Queries
```sql
-- Bad: N+1 query pattern
-- SELECT * FROM orders;
-- then for each order: SELECT * FROM users WHERE id = ?

-- Good: Single query with JOIN
SELECT o.*, u.name as user_name
FROM orders o
JOIN users u ON o.user_id = u.id;
```

### Pagination
```sql
-- PostgreSQL
SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

-- SQL Server
SELECT * FROM products
ORDER BY created_at DESC
OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;

-- Keyset pagination (better for large datasets)
SELECT * FROM products
WHERE created_at < @last_created_at
ORDER BY created_at DESC
LIMIT 20;
```

## Security Checklist

- [ ] Always use parameterized queries
- [ ] Use least privilege database accounts
- [ ] Encrypt sensitive data at rest
- [ ] Audit access to sensitive tables
- [ ] Regular security patches
- [ ] Backup and test restore procedures

## References

- [Skill #24: PostgreSQL](.github/skills/development/postgresql/SKILL.md)
- [Skill #25: SQL Server](.github/skills/development/sql-server/SKILL.md)
- [Skill #04: Security](.github/skills/architecture/security/SKILL.md)
- [Skill #08: Database](.github/skills/architecture/database/SKILL.md)
