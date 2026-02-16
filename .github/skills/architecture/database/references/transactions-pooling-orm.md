# Transactions, Connection Pooling & ORM Patterns

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
READ UNCOMMITTED # Dirty reads possible, highest performance
READ COMMITTED # Default, good balance
REPEATABLE READ # Prevents non-repeatable reads
SERIALIZABLE # Full isolation, lowest performance
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
 minConnections: 5 # Always maintain this many
 maxConnections: 20 # Never exceed this limit
 connectionTimeout: 30s # Wait time for available connection
 idleTimeout: 600s # Close idle connections after 10 min
 maxLifetime: 1800s # Recycle connections after 30 min
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
 connectionPool.release(connection) # Return to pool
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
posts = user.posts # N+1 problem
```

**Eager Loading (Load Upfront):**
```
# Loads user and posts in single query
user = ORM.users().with('posts').find(1)

# No additional query
posts = user.posts # Already loaded
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
