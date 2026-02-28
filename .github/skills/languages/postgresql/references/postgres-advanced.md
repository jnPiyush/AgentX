# PostgreSQL Transactions, Types & Row-Level Security

## Transactions and Locking

```sql
-- [PASS] GOOD: Transaction with proper error handling
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

-- [PASS] GOOD: Advisory locks for application-level locking
-- Try to acquire lock (returns immediately)
SELECT pg_try_advisory_lock(12345);

-- Release lock
SELECT pg_advisory_unlock(12345);

-- [PASS] GOOD: Row-level locking strategies
-- FOR UPDATE: exclusive lock, prevents reads and writes
-- FOR NO KEY UPDATE: allows foreign key checks
-- FOR SHARE: allows reads, prevents writes
-- FOR KEY SHARE: allows everything except FOR UPDATE
```

---

## PostgreSQL-Specific Types

```sql
-- [PASS] GOOD: Use PostgreSQL-specific types
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
-- [PASS] GOOD: Row-level security
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
