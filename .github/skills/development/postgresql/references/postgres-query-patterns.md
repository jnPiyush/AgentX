# PostgreSQL Window Functions, CTEs & Performance

## Window Functions

```sql
-- [PASS] GOOD: Window functions
-- Row number
SELECT 
 id,
 name,
 category,
 ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC) AS row_num
FROM products;

-- Ranking
SELECT 
 id,
 score,
 RANK() OVER (ORDER BY score DESC) AS rank,
 DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank
FROM scores;

-- Running totals
SELECT 
 date,
 amount,
 SUM(amount) OVER (ORDER BY date) AS running_total
FROM transactions;

-- Moving average
SELECT 
 date,
 value,
 AVG(value) OVER (
 ORDER BY date 
 ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
 ) AS moving_avg_7day
FROM metrics;

-- Lag and Lead
SELECT 
 date,
 value,
 LAG(value, 1) OVER (ORDER BY date) AS previous_value,
 LEAD(value, 1) OVER (ORDER BY date) AS next_value,
 value - LAG(value, 1) OVER (ORDER BY date) AS change
FROM metrics;
```

---

## Common Table Expressions (CTEs)

```sql
-- [PASS] GOOD: Recursive CTE for hierarchical data
WITH RECURSIVE category_tree AS (
 -- Base case: root categories
 SELECT id, name, parent_id, 1 AS level, name AS path
 FROM categories
 WHERE parent_id IS NULL
 
 UNION ALL
 
 -- Recursive case: child categories
 SELECT 
 c.id, 
 c.name, 
 c.parent_id,
 ct.level + 1,
 ct.path || ' > ' || c.name
 FROM categories c
 INNER JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree
ORDER BY path;

-- [PASS] GOOD: Multiple CTEs
WITH active_users AS (
 SELECT id, name FROM users WHERE is_active = true
),
recent_orders AS (
 SELECT user_id, COUNT(*) AS order_count
 FROM orders
 WHERE created_at > NOW() - INTERVAL '30 days'
 GROUP BY user_id
)
SELECT 
 u.name,
 COALESCE(ro.order_count, 0) AS recent_orders
FROM active_users u
LEFT JOIN recent_orders ro ON u.id = ro.user_id
ORDER BY recent_orders DESC;
```

---

## Performance Optimization

### Index Strategies

```sql
-- [PASS] GOOD: Index types
-- B-tree (default, good for equality and range queries)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_created ON orders(created_at);

-- GIN (good for JSONB, arrays, full-text)
CREATE INDEX idx_posts_tags ON posts USING gin(tags);
CREATE INDEX idx_users_profile ON users USING gin(profile);

-- GiST (good for geometric and range types)
CREATE INDEX idx_locations_point ON locations USING gist(coordinates);

-- Partial index (smaller, faster)
CREATE INDEX idx_active_users ON users(email)
WHERE is_active = true;

-- Expression index
CREATE INDEX idx_users_lower_email ON users(LOWER(email));

-- Multi-column index
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

### Query Optimization

```sql
-- [PASS] GOOD: Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123
AND created_at > NOW() - INTERVAL '30 days';

-- [PASS] GOOD: Efficient pagination
-- Use cursor-based pagination
SELECT * FROM posts
WHERE id > 1000 -- Last seen ID
ORDER BY id
LIMIT 20;

-- Avoid OFFSET for large datasets
-- [FAIL] BAD: OFFSET is slow for large offsets
SELECT * FROM posts
ORDER BY id
LIMIT 20 OFFSET 10000;

-- [PASS] GOOD: Batching with CTEs
WITH batch AS (
 SELECT id FROM large_table
 WHERE needs_processing = true
 LIMIT 1000
 FOR UPDATE SKIP LOCKED
)
UPDATE large_table
SET needs_processing = false
FROM batch
WHERE large_table.id = batch.id;
```

---
