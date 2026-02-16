# Entity Framework Core, Error Handling & Testing

## Entity Framework Core

### DbContext Configuration

```csharp
// Startup/Program.cs
builder.Services.AddDbContext<AppDbContext>(options =>
 options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
 .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
 .LogTo(Console.WriteLine, LogLevel.Information));

// DbContext
public class AppDbContext : DbContext
{
 public AppDbContext(DbContextOptions<AppDbContext> options) 
 : base(options) { }

 public DbSet<User> Users => Set<User>();
 public DbSet<Order> Orders => Set<Order>();

 protected override void OnModelCreating(ModelBuilder modelBuilder)
 {
 // Configure entities
 modelBuilder.Entity<User>(entity =>
 {
 entity.HasKey(e => e.Id);
 entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
 entity.HasIndex(e => e.Email).IsUnique();
 });

 // Relationships
 modelBuilder.Entity<Order>()
 .HasOne(o => o.User)
 .WithMany(u => u.Orders)
 .HasForeignKey(o => o.UserId)
 .OnDelete(DeleteBehavior.Cascade);
 }
}
```

### Query Patterns

```csharp
// [PASS] GOOD: Async queries with CancellationToken
public async Task<List<User>> GetActiveUsersAsync(CancellationToken ct)
{
 return await _context.Users
 .Where(u => u.IsActive)
 .OrderBy(u => u.Name)
 .ToListAsync(ct);
}

// [PASS] GOOD: Projection to avoid over-fetching
public async Task<List<UserDto>> GetUserSummariesAsync()
{
 return await _context.Users
 .Select(u => new UserDto
 {
 Id = u.Id,
 Name = u.Name,
 Email = u.Email
 })
 .ToListAsync();
}

// [PASS] GOOD: Include for eager loading
public async Task<Order?> GetOrderWithDetailsAsync(int id)
{
 return await _context.Orders
 .Include(o => o.User)
 .Include(o => o.OrderItems)
 .ThenInclude(oi => oi.Product)
 .FirstOrDefaultAsync(o => o.Id == id);
}

// [FAIL] BAD: N+1 query problem
foreach (var order in orders)
{
 var user = await _context.Users.FindAsync(order.UserId); // N+1!
}
```

---

## Error Handling

### Exception Patterns

```csharp
// [PASS] GOOD: Specific exceptions
public class UserService
{
 public async Task<User> GetUserAsync(int id)
 {
 ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id); // .NET 8+

 var user = await _repository.FindByIdAsync(id);
 if (user is null)
 throw new NotFoundException($"User {id} not found");

 return user;
 }
}

// [PASS] GOOD: Global exception handler (ASP.NET Core 8+)
app.UseExceptionHandler(exceptionHandlerApp =>
{
 exceptionHandlerApp.Run(async context =>
 {
 var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
 
 var response = exception switch
 {
 NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
 ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
 _ => (StatusCodes.Status500InternalServerError, "An error occurred")
 };

 context.Response.StatusCode = response.Item1;
 await context.Response.WriteAsJsonAsync(new { error = response.Item2 });
 });
});

// Custom exceptions
public class NotFoundException : Exception
{
 public NotFoundException(string message) : base(message) { }
}

public class ValidationException : Exception
{
 public ValidationException(string message) : base(message) { }
}
```

---

## Testing

### xUnit Patterns

```csharp
public class UserServiceTests
{
 private readonly Mock<IUserRepository> _mockRepo;
 private readonly UserService _sut; // System Under Test

 public UserServiceTests()
 {
 _mockRepo = new Mock<IUserRepository>();
 _sut = new UserService(_mockRepo.Object);
 }

 [Fact]
 public async Task GetUserAsync_ValidId_ReturnsUser()
 {
 // Arrange
 var expectedUser = new User { Id = 1, Name = "John" };
 _mockRepo.Setup(r => r.FindByIdAsync(1))
 .ReturnsAsync(expectedUser);

 // Act
 var result = await _sut.GetUserAsync(1);

 // Assert
 Assert.NotNull(result);
 Assert.Equal("John", result.Name);
 _mockRepo.Verify(r => r.FindByIdAsync(1), Times.Once);
 }

 [Theory]
 [InlineData(0)]
 [InlineData(-1)]
 public async Task GetUserAsync_InvalidId_ThrowsException(int id)
 {
 // Act & Assert
 await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
 () => _sut.GetUserAsync(id));
 }
}
```

---
