---
description: 'PostgreSQL database development with JSONB, arrays, full-text search, and performance optimization'
---

# PostgreSQL Database Development

> **Purpose**: Production-ready PostgreSQL development for high-performance, scalable applications.  
> **Audience**: Backend engineers and database administrators working with PostgreSQL.  
> **Standard**: Follows [github/awesome-copilot](https://github.com/github/awesome-copilot) PostgreSQL patterns.

---

## Quick Reference

| Need | Solution | Pattern |
|------|----------|---------|
| **JSONB query** | Containment operator | `WHERE data @> '{"status": "active"}'::jsonb` |
| **Array operations** | ANY operator | `WHERE id = ANY(ARRAY[1,2,3])` |
| **Full-text search** | GIN index + tsvector | `CREATE INDEX ON posts USING gin(to_tsvector('english', content))` |
| **Window functions** | ROW_NUMBER, RANK | `ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC)` |
| **Upsert** | INSERT ... ON CONFLICT | `ON CONFLICT (id) DO UPDATE SET ...` |
| **JSON aggregation** | jsonb_agg | `SELECT jsonb_agg(row_to_json(t)) FROM ...` |

---

## PostgreSQL Version

**Current**: PostgreSQL 16+  
**Minimum**: PostgreSQL 14+

---

## JSONB Operations

### Basic JSONB Queries

```sql
-- ✅ GOOD: JSONB containment queries
-- Find users with active status
SELECT * FROM users
WHERE profile @> '{"status": "active"}'::jsonb;

-- Find users in a specific city
SELECT * FROM users
WHERE profile @> '{"address": {"city": "New York"}}'::jsonb;

-- Check if key exists
SELECT * FROM users
WHERE profile ? 'phone';

-- Check if any key exists
SELECT * FROM users
WHERE profile ?| ARRAY['email', 'phone'];

-- Check if all keys exist
SELECT * FROM users
WHERE profile ?& ARRAY['email', 'phone'];
```

### JSONB Path Operators

```sql
-- Extract JSON field as text
SELECT profile->>'name' AS name FROM users;

-- Extract nested JSON field
SELECT profile->'address'->>'city' AS city FROM users;

-- Extract JSON field as JSON
SELECT profile->'preferences' AS preferences FROM users;

-- Extract JSON array element
SELECT tags->0 AS first_tag FROM posts;

-- Path with multiple levels
SELECT profile #> '{address,coordinates,lat}' AS latitude FROM users;

-- Path extraction as text
SELECT profile #>> '{address,city}' AS city FROM users;
```

### JSONB Modification

```sql
-- ✅ GOOD: Update JSONB fields
-- Set a value
UPDATE users
SET profile = jsonb_set(profile, '{status}', '"inactive"');

-- Set nested value
UPDATE users
SET profile = jsonb_set(profile, '{address,city}', '"Boston"');

-- Remove a key
UPDATE users
SET profile = profile - 'temporary_field';

-- Concatenate JSONB
UPDATE users
SET profile = profile || '{"verified": true}'::jsonb;

-- Build JSONB object
INSERT INTO events (data)
VALUES (jsonb_build_object(
    'event_type', 'login',
    'user_id', 123,
    'timestamp', NOW()
));
```

### JSONB Indexes

```sql
-- ✅ GOOD: GIN index for JSONB
-- General JSONB index
CREATE INDEX idx_users_profile ON users USING gin(profile);

-- Index specific JSON path
CREATE INDEX idx_users_profile_status 
ON users USING gin((profile->'status'));

-- Index for containment queries
CREATE INDEX idx_events_data 
ON events USING gin(data jsonb_path_ops);
```

---

## Array Operations

### Basic Array Queries

```sql
-- ✅ GOOD: Array queries
-- Check if value is in array
SELECT * FROM posts
WHERE 'postgresql' = ANY(tags);

-- Check if all values match
SELECT * FROM posts
WHERE tags @> ARRAY['postgresql', 'database'];

-- Check for overlap
SELECT * FROM posts
WHERE tags && ARRAY['sql', 'nosql'];

-- Array length
SELECT *, array_length(tags, 1) AS tag_count
FROM posts;
```

### Array Aggregation

```sql
-- ✅ GOOD: Array aggregation
-- Aggregate into array
SELECT 
    user_id,
    array_agg(DISTINCT category) AS categories,
    array_agg(product_name ORDER BY created_at DESC) AS recent_products
FROM orders
GROUP BY user_id;

-- Unnest array to rows
SELECT unnest(tags) AS tag
FROM posts;

-- Unnest with ordinality (index)
SELECT tag, idx
FROM posts, unnest(tags) WITH ORDINALITY AS t(tag, idx);
```

### Array Operations

```sql
-- Append to array
UPDATE posts
SET tags = array_append(tags, 'new-tag')
WHERE id = 1;

-- Prepend to array
UPDATE posts
SET tags = array_prepend('featured', tags)
WHERE id = 1;

-- Remove from array
UPDATE posts
SET tags = array_remove(tags, 'deprecated')
WHERE id = 1;

-- Concatenate arrays
UPDATE posts
SET tags = tags || ARRAY['tag1', 'tag2']
WHERE id = 1;
```

---

## Full-Text Search

```sql
-- ✅ GOOD: Full-text search setup
-- Add tsvector column
ALTER TABLE posts
ADD COLUMN search_vector tsvector;

-- Update search vector
UPDATE posts
SET search_vector = 
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'B');

-- Create GIN index
CREATE INDEX idx_posts_search 
ON posts USING gin(search_vector);

-- Create trigger to auto-update
CREATE FUNCTION posts_search_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_trigger
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION posts_search_update();

-- ✅ GOOD: Full-text search queries
-- Basic search
SELECT * FROM posts
WHERE search_vector @@ to_tsquery('english', 'postgresql & performance');

-- Search with ranking
SELECT 
    *,
    ts_rank(search_vector, query) AS rank
FROM posts, to_tsquery('english', 'postgresql | database') AS query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Phrase search
SELECT * FROM posts
WHERE search_vector @@ phraseto_tsquery('english', 'full text search');

-- Prefix search
SELECT * FROM posts
WHERE search_vector @@ to_tsquery('english', 'postgre:*');
```

---

## Window Functions

```sql
-- ✅ GOOD: Window functions
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
-- ✅ GOOD: Recursive CTE for hierarchical data
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

-- ✅ GOOD: Multiple CTEs
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
-- ✅ GOOD: Index types
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
-- ✅ GOOD: Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123
AND created_at > NOW() - INTERVAL '30 days';

-- ✅ GOOD: Efficient pagination
-- Use cursor-based pagination
SELECT * FROM posts
WHERE id > 1000  -- Last seen ID
ORDER BY id
LIMIT 20;

-- Avoid OFFSET for large datasets
-- ❌ BAD: OFFSET is slow for large offsets
SELECT * FROM posts
ORDER BY id
LIMIT 20 OFFSET 10000;

-- ✅ GOOD: Batching with CTEs
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

## Transactions and Locking

```sql
-- ✅ GOOD: Transaction with proper error handling
BEGIN;

    -- Lock row for update
    SELECT * FROM accounts
    WHERE id = 123
    FOR UPDATE;
    
    -- Perform updates
    UPDATE accounts
    SET balance = balance - 100
    WHERE id = 123;
    
    UPDATE accounts
    SET balance = balance + 100
    WHERE id = 456;

COMMIT;

-- ✅ GOOD: Advisory locks for application-level locking
-- Try to acquire lock (returns immediately)
SELECT pg_try_advisory_lock(12345);

-- Release lock
SELECT pg_advisory_unlock(12345);

-- ✅ GOOD: Row-level locking strategies
-- FOR UPDATE: exclusive lock, prevents reads and writes
-- FOR NO KEY UPDATE: allows foreign key checks
-- FOR SHARE: allows reads, prevents writes
-- FOR KEY SHARE: allows everything except FOR UPDATE
```

---

## PostgreSQL-Specific Types

```sql
-- ✅ GOOD: Use PostgreSQL-specific types
-- UUID
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL
);

-- Array types
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    tags TEXT[],
    ratings INTEGER[]
);

-- ENUM types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'banned');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    status user_status NOT NULL DEFAULT 'active'
);

-- Range types
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    room_id INTEGER,
    period TSTZRANGE NOT NULL,
    EXCLUDE USING gist (room_id WITH =, period WITH &&)
);

-- CITEXT (case-insensitive text)
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email CITEXT UNIQUE NOT NULL
);
```

---

## Row Level Security (RLS)

```sql
-- ✅ GOOD: Row-level security
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY user_posts_policy ON posts
    FOR ALL
    USING (user_id = current_setting('app.user_id')::INTEGER);

-- Policy for SELECT
CREATE POLICY view_published_posts ON posts
    FOR SELECT
    USING (published = true OR user_id = current_setting('app.user_id')::INTEGER);

-- Policy for INSERT
CREATE POLICY insert_own_posts ON posts
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.user_id')::INTEGER);

-- Set user context in application
SET app.user_id = '123';
```

---

## Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **N+1 queries** | Loading relations one by one | Use JOINs or array_agg |
| **Missing indexes** | Slow queries | Add indexes on WHERE, JOIN, ORDER BY columns |
| **OFFSET pagination** | Slow for large offsets | Use cursor-based pagination |
| **SELECT *** | Unnecessary data transfer | Select only needed columns |
| **Unparameterized queries** | SQL injection risk | Always use parameterized queries |
| **No connection pooling** | Too many connections | Use pgBouncer or application pooling |

---

## Resources

- **PostgreSQL Docs**: [postgresql.org/docs](https://www.postgresql.org/docs/)
- **pgAdmin**: GUI tool for PostgreSQL
- **pg_stat_statements**: Query performance monitoring
- **EXPLAIN Visualizer**: [explain.depesz.com](https://explain.depesz.com)
- **Awesome Copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md) • [Database Skill](.github/skills/architecture/database/SKILL.md)

**Last Updated**: January 27, 2026
