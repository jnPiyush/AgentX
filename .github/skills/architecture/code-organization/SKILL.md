---
name: "code-organization"
description: "Structure projects for maintainability and scalability with clean architecture, separation of concerns, and consistent project layouts."
metadata:
  author: "AgentX"
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-15"
allowed-tools: "read_file semantic_search grep_search file_search create_file replace_string_in_file"
---

# Code Organization

> **Purpose**: Structure projects for maintainability, scalability, and team collaboration.

---

## Decision Tree

```
Structuring a project?
├─ New project?
│   ├─ Single app? → Standard layered structure (API/Domain/Infra)
│   ├─ Multiple services? → Monorepo or separate repos
│   └─ Library/package? → src/ + tests/ + docs/ + examples/
├─ Existing project, adding feature?
│   ├─ Follow existing patterns (consistency > perfection)
│   └─ Feature cuts across layers? → Consider vertical slices
├─ File getting too large (> 300 lines)?
│   └─ Split by responsibility (SRP)
├─ Folder getting too deep (> 4 levels)?
│   └─ Flatten or reorganize by feature
└─ Shared code between projects?
    └─ Extract to shared library / internal package
```

## Project Structure

### C# (.NET Solution)

```
Solution/
├── src/
│   ├── MyProject.Api/                      # Web API project
│   │   ├── Controllers/
│   │   │   ├── UsersController.cs
│   │   │   ├── ProductsController.cs
│   │   │   └── OrdersController.cs
│   │   ├── Middleware/
│   │   │   ├── AuthenticationMiddleware.cs
│   │   │   ├── LoggingMiddleware.cs
│   │   │   └── RateLimitingMiddleware.cs
│   │   ├── Filters/
│   │   │   ├── ValidationFilter.cs
│   │   │   └── ExceptionFilter.cs
│   │   ├── Program.cs
│   │   ├── Startup.cs                      # or configure in Program.cs
│   │   ├── appsettings.json
│   │   └── appsettings.Development.json
│   ├── MyProject.Core/                     # Domain/Business logic
│   │   ├── Entities/
│   │   │   ├── User.cs
│   │   │   ├── Product.cs
│   │   │   └── Order.cs
│   │   ├── Interfaces/
│   │   │   ├── IUserRepository.cs
│   │   │   ├── IEmailService.cs
│   │   │   └── IPaymentService.cs
│   │   ├── Services/
│   │   │   ├── UserService.cs
│   │   │   ├── PaymentService.cs
│   │   │   └── EmailService.cs
│   │   ├── DTOs/
│   │   │   ├── UserDto.cs
│   │   │   └── ProductDto.cs
│   │   └── Exceptions/
│   │       ├── UserNotFoundException.cs
│   │       └── DuplicateEmailException.cs
│   ├── MyProject.Infrastructure/           # Data access & external services
│   │   ├── Data/
│   │   │   ├── ApplicationDbContext.cs
│   │   │   └── Migrations/
│   │   ├── Repositories/
│   │   │   ├── UserRepository.cs
│   │   │   └── OrderRepository.cs
│   │   └── Services/
│   │       ├── EmailService.cs
│   │       └── BlobStorageService.cs
│   └── MyProject.Shared/                   # Shared utilities
│       ├── Constants/
│       │   └── AppConstants.cs
│       ├── Helpers/
│       │   └── StringHelper.cs
│       └── Validators/
│           └── EmailValidator.cs
├── tests/
│   ├── MyProject.UnitTests/
│   ├── MyProject.IntegrationTests/
│   └── MyProject.E2ETests/
├── docs/
├── scripts/
├── .gitignore
├── MyProject.sln
└── README.md
```

---

## Separation of Concerns

### Layered Architecture

```csharp
// ❌ Bad: Everything in one place
[HttpGet("users/{userId}")]
public IActionResult GetUser(int userId)
{
    using var conn = new NpgsqlConnection("Host=localhost;Database=mydb;Username=user;Password=pass");
    conn.Open();
    var cmd = new NpgsqlCommand("SELECT * FROM Users WHERE Id = @id", conn);
    cmd.Parameters.AddWithValue("id", userId);
    
    var reader = cmd.ExecuteReader();
    if (!reader.Read())
        return NotFound(new { error = "Not found" });
    
    var user = new { /* map reader */ };
    
    // Send email
    var smtp = new SmtpClient("smtp.gmail.com");
    smtp.Send("from@example.com", user.Email, "Subject", "Body");
    
    return Ok(user);
}
```

```csharp
// ✅ Good: Separated layers

// 1. Repository Layer (Data Access)
public interface IUserRepository
{
    Task<User?> FindByIdAsync(int userId);
    Task<User?> FindByEmailAsync(string email);
    Task<User> CreateAsync(User user);
}

public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _context;
    
    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }
    
    public async Task<User?> FindByIdAsync(int userId)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);
    }
    
    public async Task<User?> FindByEmailAsync(string email)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Email == email);
    }
    
    public async Task<User> CreateAsync(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user;
    }
}

// 2. Service Layer (Business Logic)
public interface IUserService
{
    Task<UserDto> GetUserProfileAsync(int userId);
    Task<User> RegisterUserAsync(RegisterDto data);
}

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailService _emailService;
    private readonly IPasswordHasher<User> _passwordHasher;
    
    public UserService(
        IUserRepository userRepository,
        IEmailService emailService,
        IPasswordHasher<User> passwordHasher)
    {
        _userRepository = userRepository;
        _emailService = emailService;
        _passwordHasher = passwordHasher;
    }
    
    public async Task<UserDto> GetUserProfileAsync(int userId)
    {
        var user = await _userRepository.FindByIdAsync(userId);
        if (user == null)
            throw new UserNotFoundException($"User {userId} not found");
        
        return user.ToDto();
    }
    
    public async Task<User> RegisterUserAsync(RegisterDto data)
    {
        // Business validation
        var existingUser = await _userRepository.FindByEmailAsync(data.Email);
        if (existingUser != null)
            throw new DuplicateEmailException("Email already exists");
        
        // Create user
        var user = new User
        {
            Email = data.Email,
            Name = data.Name
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, data.Password);
        
        user = await _userRepository.CreateAsync(user);
        
        // Send welcome email
        await _emailService.SendWelcomeEmailAsync(user);
        
        return user;
    }
}

// 3. API Layer (Presentation)
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;
    
    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }
    
    /// <summary>
    /// Get user profile by ID
    /// </summary>
    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUser(int userId)
    {
        try
        {
            var profile = await _userService.GetUserProfileAsync(userId);
            return Ok(profile);
        }
        catch (UserNotFoundException)
        {
            return NotFound(new { error = "User not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}
```

---

## Dependency Injection

```csharp
// Define interfaces
public interface IUserRepository
{
    Task<User?> FindByIdAsync(int userId);
    Task<User> CreateAsync(User user);
}

public interface IEmailService
{
    Task SendWelcomeEmailAsync(User user);
}

// Service depends on abstractions, not concrete implementations
public class UserService
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailService _emailService;
    
    public UserService(IUserRepository userRepository, IEmailService emailService)
    {
        _userRepository = userRepository;
        _emailService = emailService;
    }
    
    public async Task<User> RegisterUserAsync(RegisterDto data)
    {
        var user = new User
        {
            Email = data.Email,
            Name = data.Name
        };
        
        user = await _userRepository.CreateAsync(user);
        await _emailService.SendWelcomeEmailAsync(user);
        
        return user;
    }
}

// Dependency injection configuration in Program.cs
var builder = WebApplication.CreateBuilder(args);

// Register DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();

// Register services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();

// Register other dependencies
builder.Services.AddMemoryCache();
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
});

var app = builder.Build();

// Usage - ASP.NET Core automatically injects dependencies
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    
    // Constructor injection
    public UsersController(IUserService userService)
    {
        _userService = userService;
    }
    
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto request)
    {
        var user = await _userService.RegisterUserAsync(request);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }
}
```

---

## Module Organization

### Feature-Based Structure

```
src/
├── Features/
│   ├── Users/
│   │   ├── UsersController.cs
│   │   ├── User.cs                    # Entity
│   │   ├── UserDto.cs
│   │   ├── UserRepository.cs
│   │   ├── IUserRepository.cs
│   │   ├── UserService.cs
│   │   └── IUserService.cs
│   ├── Products/
│   │   ├── ProductsController.cs
│   │   ├── Product.cs
│   │   ├── ProductDto.cs
│   │   ├── ProductRepository.cs
│   │   └── ProductService.cs
│   └── Orders/
│       ├── OrdersController.cs
│       ├── Order.cs
│       ├── OrderDto.cs
│       ├── OrderRepository.cs
│       └── OrderService.cs
```

---

## Best Practices

### 1. Single Responsibility Principle

```csharp
// ❌ Bad: Class does too much
public class User
{
    public void SaveToDatabase() { }
    public void SendEmail() { }
    public void GenerateReport() { }
}

// ✅ Good: Separate concerns
public class User
{
    // Just data and behavior
    public int Id { get; set; }
    public string Email { get; set; }
    public string Name { get; set; }
}

public class UserRepository
{
    public async Task SaveAsync(User user) { }
}

public class EmailService
{
    public async Task SendToUserAsync(User user, string message) { }
}

public class ReportGenerator
{
    public async Task GenerateUserReportAsync(User user) { }
}
```

### 2. Keep Files Small

- Max 300-400 lines per file
- Split large files into smaller classes
- Group related functionality

### 3. Clear Naming

```csharp
// ✅ Good naming conventions
// Files: PascalCase.cs
// Classes: PascalCase
// Interfaces: IPascalCase
// Methods: PascalCase
// Variables/parameters: camelCase
// Constants: PascalCase or UPPER_SNAKE_CASE

// UserService.cs
public class UserService
{
    private const int MaxLoginAttempts = 3;
    
    public async Task<bool> AuthenticateUserAsync(string email, string password)
    {
        // Implementation
    }
}
```

### 4. Use Namespaces Properly

```csharp
// Organize by feature or layer
namespace MyProject.Core.Services
{
    public class UserService { }
}

namespace MyProject.Core.Entities
{
    public class User { }
}

namespace MyProject.Infrastructure.Repositories
{
    public class UserRepository { }
}

namespace MyProject.Api.Controllers
{
    public class UsersController { }
}
```

---

**Related Skills**:
- [Core Principles](01-core-principles.md)
- [Scalability](07-scalability.md)

