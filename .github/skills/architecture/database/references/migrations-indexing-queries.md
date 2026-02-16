# Database Migrations, Indexing & Query Optimization

## Database Migrations

### Version-Controlled Schema Changes

**Migration Workflow:**
```
1. Create migration file (timestamp + description)
2. Define UP (apply changes) and DOWN (rollback) operations
3. Test migration in development
4. Apply to staging
5. Apply to production (with rollback plan)
```

**Migration File Structure:**
```
migrations/
 20260127120000_create_users_table.sql
 20260127130000_add_email_index.sql
 20260127140000_add_user_roles.sql
```

**Migration Example:**
```sql
-- UP Migration
CREATE TABLE users (
 id SERIAL PRIMARY KEY,
 email VARCHAR(255) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- DOWN Migration (rollback)
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
```

**Migration Tools by Language:**
- **.NET**: Entity Framework Core Migrations, FluentMigrator
- **Python**: Alembic (SQLAlchemy), Django Migrations
- **Node.js**: Knex.js, Sequelize Migrations, TypeORM
- **Java**: Flyway, Liquibase
- **PHP**: Doctrine Migrations, Laravel Migrations
- **Ruby**: ActiveRecord Migrations

### Migration Best Practices

- [PASS] Never modify existing migrations
- [PASS] Test rollback before deploying
- [PASS] Include data migrations separately
- [PASS] Version migrations with timestamps
- [PASS] Review migrations in code review
- [FAIL] Never skip migrations
- [FAIL] Never modify production schema directly

---

## Indexing Strategies

### When to Add Indexes

**Add indexes on columns used in:**
- WHERE clauses (filtering)
- JOIN conditions
- ORDER BY clauses
- GROUP BY clauses
- Foreign key columns

### Index Types

**B-Tree Index (Default):**
```sql
-- Best for: equality and range queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_date ON orders(created_at);
```

**Composite Index:**
```sql
-- Order matters! Most selective column first
CREATE INDEX idx_users_status_created 
ON users(status, created_at);

-- Useful for queries like:
-- WHERE status = 'active' AND created_at > '2024-01-01'
```

**Unique Index:**
```sql
-- Enforces uniqueness at database level
CREATE UNIQUE INDEX idx_users_email_unique 
ON users(email);
```

**Partial Index:**
```sql
-- Index only subset of rows (PostgreSQL)
CREATE INDEX idx_active_users 
ON users(email) 
WHERE status = 'active';
```

**Full-Text Index:**
```sql
-- For text search (PostgreSQL, MySQL)
CREATE INDEX idx_posts_content_fulltext 
ON posts USING GIN(to_tsvector('english', content));
```

### Index Maintenance

**Check Index Usage:**
```sql
-- Find unused indexes (PostgreSQL example)
SELECT 
 schemaname,
 tablename,
 indexname,
 idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
 AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Rebuild Fragmented Indexes:**
```sql
-- PostgreSQL
REINDEX INDEX idx_users_email;

-- MySQL
ALTER TABLE users ENGINE=InnoDB;
```

---

## Query Optimization

### N+1 Query Problem

**[FAIL] N+1 Problem:**
```
# Fetches 1 query for users
users = database.query("SELECT * FROM users")

# Then N queries for each user's posts (N+1 total)
for user in users:
 posts = database.query("SELECT * FROM posts WHERE user_id = ?", user.id)
```

**[PASS] Solution - Eager Loading:**
```
# Single query with JOIN
results = database.query("""
 SELECT users.*, posts.*
 FROM users
 LEFT JOIN posts ON posts.user_id = users.id
""")

# Or use ORM eager loading
users = ORM.users().with('posts').all()
```

### Use Projections

**[FAIL] Loading unnecessary data:**
```sql
SELECT * FROM users; -- Loads all columns
```

**[PASS] Select only needed columns:**
```sql
SELECT id, email, name FROM users; -- Only what you need
```

### Limit Results

**Always paginate large result sets:**
```sql
-- Offset pagination (simple, but slow for large offsets)
SELECT * FROM users
ORDER BY id
LIMIT 20 OFFSET 100;

-- Cursor pagination (better performance)
SELECT * FROM users
WHERE id > 1000 -- Last seen ID
ORDER BY id
LIMIT 20;
```

---
