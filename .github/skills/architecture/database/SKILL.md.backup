---
name: database
description: 'Efficient database operations with PostgreSQL, Entity Framework Core, migrations, indexing strategies, transactions, and connection pooling.'
---

# Database

> **Purpose**: Efficient, reliable database operations with migrations, indexes, and transactions.  
> **Stack**: PostgreSQL + Entity Framework Core + Npgsql.

---

## Entity Framework Core Setup

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(maxRetryCount: 3);
            npgsqlOptions.CommandTimeout(30);
        }));
```

---

## Migrations

```bash
# Create migration
dotnet ef migrations add InitialCreate

# Update database
dotnet ef database update

# Generate SQL script
dotnet ef migrations script --output migration.sql

# Rollback
dotnet ef database update PreviousMigration
```

### Migration Example

```csharp
public partial class CreateUsersTable : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", 
                        NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                Email = table.Column<string>(maxLength: 255, nullable: false),
                Name = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt = table.Column<DateTime>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Users", x => x.Id);
            });
        
        migrationBuilder.CreateIndex(
            name: "IX_Users_Email",
            table: "Users",
            column: "Email",
            unique: true);
    }
    
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Users");
    }
}
```

---

## Indexes

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // Single column index
    modelBuilder.Entity<User>()
        .HasIndex(u => u.Email)
        .IsUnique();
    
    // Composite index
    modelBuilder.Entity<Post>()
        .HasIndex(p => new { p.UserId, p.CreatedAt });
    
    // Filtered index
    modelBuilder.Entity<Order>()
        .HasIndex(o => o.Status)
        .HasFilter("Status = 'Active'");
}
```

**When to Add Indexes**:
- Foreign keys
- Columns in WHERE clauses
- Columns in JOIN conditions
- Columns in ORDER BY
- Unique constraints

---

## Transactions

```csharp
using var transaction = await _context.Database.BeginTransactionAsync();
try
{
    var user = new User { Email = "test@example.com" };
    _context.Users.Add(user);
    await _context.SaveChangesAsync();
    
    var profile = new Profile { UserId = user.Id };
    _context.Profiles.Add(profile);
    await _context.SaveChangesAsync();
    
    await transaction.CommitAsync();
}
catch
{
    await transaction.RollbackAsync();
    throw;
}
```

---

## Connection Pooling

```csharp
// Connection string with pooling
"Server=localhost;Database=myapp;User Id=user;Password=pass;Pooling=true;MinPoolSize=0;MaxPoolSize=100;"
```

---

## Query Optimization

### Use Projections

```csharp
// ❌ Loads entire entity
var users = await _context.Users.ToListAsync();

// ✅ Load only needed fields
var users = await _context.Users
    .Select(u => new { u.Id, u.Name, u.Email })
    .ToListAsync();
```

### Avoid N+1 Queries

```csharp
// ❌ N+1 queries
var users = await _context.Users.ToListAsync();
foreach (var user in users)
{
    var posts = await _context.Posts.Where(p => p.UserId == user.Id).ToListAsync();
}

// ✅ Eager loading
var users = await _context.Users
    .Include(u => u.Posts)
    .ToListAsync();
```

### Use AsNoTracking

```csharp
// For read-only queries
var users = await _context.Users
    .AsNoTracking()
    .ToListAsync();
```

---

## Repository Pattern

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(int id);
}

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    protected readonly DbSet<T> _dbSet;
    
    public Repository(AppDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }
    
    public async Task<T?> GetByIdAsync(int id) =>
        await _dbSet.FindAsync(id);
    
    public async Task<IEnumerable<T>> GetAllAsync() =>
        await _dbSet.ToListAsync();
    
    public async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
        return entity;
    }
}
```

---

## Best Practices

### ✅ DO

- **Use migrations** - Version control database schema
- **Add indexes** - On foreign keys and WHERE clauses
- **Use transactions** - For multi-step operations
- **Enable connection pooling** - Reuse connections
- **Use AsNoTracking** - For read-only queries
- **Use projections** - Select only needed fields
- **Eager load related data** - Avoid N+1 queries
- **Set command timeouts** - Prevent hanging queries
- **Use parameterized queries** - Always (prevent SQL injection)
- **Backup regularly** - Automated backups

### ❌ DON'T

- **Load entire tables** - Use pagination
- **Track read-only entities** - Use AsNoTracking
- **Ignore N+1 queries** - Profile and fix
- **Skip transactions** - For multi-step operations
- **Hardcode connection strings** - Use configuration
- **Create connections per query** - Use pooling
- **Forget to dispose** - Use using statements
- **Skip indexes** - Profile and add as needed

---

## Checklist

- [ ] Migrations created and tested
- [ ] Indexes on foreign keys and WHERE clauses
- [ ] Connection pooling enabled
- [ ] Transactions used for multi-step operations
- [ ] N+1 queries eliminated
- [ ] AsNoTracking for read-only queries
- [ ] Projections used (select specific fields)
- [ ] Command timeouts configured
- [ ] Backup strategy in place
- [ ] Connection strings externalized

---

**See Also**: [05-performance.md](05-performance.md) • [07-scalability.md](07-scalability.md)

**Last Updated**: January 13, 2026

