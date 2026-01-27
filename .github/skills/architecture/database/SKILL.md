---
name: database
description: 'Language-agnostic database operations including migrations, indexing strategies, transactions, connection pooling, and ORM best practices.'
---

# Database

> **Purpose**: Efficient, reliable database operations with migrations, indexes, and transactions.  
> **Focus**: ORM patterns, query optimization, data integrity.  
> **Note**: For database-specific details, see [PostgreSQL](../../architecture/postgresql/SKILL.md) or [SQL Server](../../architecture/sql-server/SKILL.md).

---

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

- ✅ Never modify existing migrations
- ✅ Test rollback before deploying
- ✅ Include data migrations separately
- ✅ Version migrations with timestamps
- ✅ Review migrations in code review
- ❌ Never skip migrations
- ❌ Never modify production schema directly

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

**❌ N+1 Problem:**
```
# Fetches 1 query for users
users = database.query("SELECT * FROM users")

# Then N queries for each user's posts (N+1 total)
for user in users:
    posts = database.query("SELECT * FROM posts WHERE user_id = ?", user.id)
```

**✅ Solution - Eager Loading:**
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

**❌ Loading unnecessary data:**
```sql
SELECT * FROM users;  -- Loads all columns
```

**✅ Select only needed columns:**
```sql
SELECT id, email, name FROM users;  -- Only what you need
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
WHERE id > 1000  -- Last seen ID
ORDER BY id
LIMIT 20;
```

---

## Transactions

### ACID Properties

- **Atomicity**: All or nothing
- **Consistency**: Valid state before and after
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed data survives crashes

### Transaction Pattern

```
transaction = database.beginTransaction()

try:
    # Multiple operations in single transaction
    database.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
    database.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
    
    # All succeed or all fail together
    transaction.commit()
catch error:
    # Rollback on any error
    transaction.rollback()
    throw error
finally:
    transaction.close()
```

### Isolation Levels

**Isolation Level Trade-offs:**
```
READ UNCOMMITTED  # Dirty reads possible, highest performance
READ COMMITTED    # Default, good balance
REPEATABLE READ   # Prevents non-repeatable reads
SERIALIZABLE      # Full isolation, lowest performance
```

**Choose isolation level based on needs:**
```
# Financial transactions - use SERIALIZABLE
transaction = database.begin(isolationLevel: "SERIALIZABLE")

# Reporting queries - use READ COMMITTED
transaction = database.begin(isolationLevel: "READ COMMITTED")
```

---

## Connection Pooling

### Why Connection Pooling

**Without Pooling:**
- Create new connection for each request (slow)
- Close connection after request (wasteful)
- Limited by max connections

**With Pooling:**
- Reuse existing connections (fast)
- Maintain pool of open connections
- Handle connection limits gracefully

### Connection Pool Configuration

```
Pool Configuration:
  minConnections: 5        # Always maintain this many
  maxConnections: 20       # Never exceed this limit
  connectionTimeout: 30s   # Wait time for available connection
  idleTimeout: 600s        # Close idle connections after 10 min
  maxLifetime: 1800s       # Recycle connections after 30 min
```

**Connection Pool Pattern:**
```
# Application startup
connectionPool = createConnectionPool({
    host: "db.example.com",
    database: "myapp",
    minConnections: 5,
    maxConnections: 20
})

# In request handler
function handleGetUser(userId):
    connection = connectionPool.acquire()
    try:
        user = connection.query("SELECT * FROM users WHERE id = ?", userId)
        return user
    finally:
        connectionPool.release(connection)  # Return to pool
```

---

## ORM Best Practices

### ORM vs Raw SQL

**Use ORM for:**
- Simple CRUD operations
- Type safety and IDE support
- Automatic migrations
- Portable across databases

**Use Raw SQL for:**
- Complex queries with multiple JOINs
- Performance-critical queries
- Database-specific features
- Bulk operations

### Lazy Loading vs Eager Loading

**Lazy Loading (Load on Access):**
```
# Only loads user initially
user = ORM.users().find(1)

# Triggers additional query when accessed
posts = user.posts  # N+1 problem
```

**Eager Loading (Load Upfront):**
```
# Loads user and posts in single query
user = ORM.users().with('posts').find(1)

# No additional query
posts = user.posts  # Already loaded
```

---

## Data Integrity

### Foreign Key Constraints

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**ON DELETE options:**
- `CASCADE` - Delete related rows
- `SET NULL` - Set foreign key to NULL
- `RESTRICT` - Prevent deletion
- `NO ACTION` - Raise error

### Check Constraints

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  price DECIMAL(10,2),
  stock INTEGER,
  CHECK (price > 0),
  CHECK (stock >= 0)
);
```

### Unique Constraints

```sql
-- Single column unique
ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email);

-- Composite unique (combination must be unique)
ALTER TABLE user_roles ADD CONSTRAINT unique_user_role 
UNIQUE (user_id, role_id);
```

---

## Performance Best Practices

### Database Optimization Checklist

- [ ] Add indexes on foreign keys
- [ ] Add indexes on columns in WHERE/JOIN/ORDER BY
- [ ] Use composite indexes for multi-column queries
- [ ] Analyze query execution plans
- [ ] Fix N+1 queries with eager loading
- [ ] Use connection pooling
- [ ] Cache frequently accessed data
- [ ] Denormalize for read-heavy workloads
- [ ] Partition large tables
- [ ] Archive old data
- [ ] Monitor slow query logs

### Query Analysis

**Analyze Query Performance:**
```sql
-- PostgreSQL
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'test@example.com';

-- MySQL
EXPLAIN
SELECT * FROM users WHERE email = 'test@example.com';
```

**Look for:**
- **Seq Scan** - Table scan (bad for large tables)
- **Index Scan** - Uses index (good)
- **Nested Loop** - Join method (can be slow)
- **Hash Join** - Better for large datasets

---

## Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| **N+1 queries** | Loading relations one by one | Use eager loading, JOINs |
| **Missing indexes** | Slow queries | Add indexes on WHERE/JOIN columns |
| **SELECT *** | Loading unnecessary data | Select only needed columns |
| **No connection pooling** | Too many connections | Implement connection pooling |
| **Large transactions** | Locks held too long | Keep transactions short |
| **No query timeout** | Queries run forever | Set query timeout limits |

---

## ORM Frameworks

**Popular ORMs:**
- **.NET**: Entity Framework Core, Dapper, NHibernate
- **Python**: SQLAlchemy, Django ORM, Peewee
- **Node.js**: Sequelize, TypeORM, Prisma
- **Java**: Hibernate, JPA, MyBatis
- **PHP**: Doctrine, Eloquent (Laravel)
- **Ruby**: ActiveRecord (Rails)

---

## Resources

**Database Docs:**
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQL Server Documentation](https://learn.microsoft.com/sql/)

**Tools:**
- **Query Optimization**: EXPLAIN ANALYZE, query plan visualizers
- **Monitoring**: pg_stat_statements, slow query logs
- **Migration Tools**: Flyway, Liquibase, Alembic

---

**See Also**: [Skills.md](../../../../Skills.md) • [AGENTS.md](../../../../AGENTS.md) • [PostgreSQL](../postgresql/SKILL.md) • [SQL Server](../sql-server/SKILL.md)

**Last Updated**: January 27, 2026
